import httpx
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json
from app.services.sport_service import SportAdapter
from typing import List, Dict, Any

# Football-Data.org API v4 (free tier: 12 leagues, 10 req/min)
FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"

# Free tier competitions
# PL=Premier League, BL1=Bundesliga, SA=Serie A, PD=La Liga,
# FL1=Ligue 1, DED=Eredivisie, PPL=Primeira Liga, ELC=Championship,
# CL=Champions League, WC=World Cup, BSA=Serie A Brazil, EC=Euro
FREE_COMPETITIONS = ["PL", "BL1", "SA", "PD", "FL1", "DED", "PPL", "ELC", "CL", "WC", "BSA", "EC"]

# Football scoring constants
POINTS_GOAL = 6
POINTS_ASSIST = 3
POINTS_CLEAN_SHEET = 4
POINTS_YELLOW_CARD = -1
POINTS_RED_CARD = -3
POINTS_OWN_GOAL = -2
POINTS_MINUTES_PLAYED = 1


class FootballAdapter(SportAdapter):
    """Football-Data.org v4 integration for live football data.

    Free tier: 12 competitions, 10 requests/minute, scores with ~1 min delay.
    Auth: X-Auth-Token header.
    Docs: https://docs.football-data.org/general/v4/index.html
    """

    def _api_key(self) -> str:
        return settings.FOOTBALL_API_KEY

    def _headers(self) -> dict:
        return {
            "X-Auth-Token": self._api_key(),
        }

    async def get_live_matches(self) -> List[Dict[str, Any]]:
        """Get all currently live matches across free-tier competitions."""
        if not self._api_key():
            return []

        cached = await redis_get_json("football:live_matches")
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            # Fetch matches with status IN_PLAY or PAUSED (pseudo-status LIVE)
            res = await client.get(
                f"{FOOTBALL_DATA_BASE}/matches",
                params={"status": "LIVE"},
                headers=self._headers(),
            )
            if res.status_code != 200:
                return []
            data = res.json()
            matches = data.get("matches", [])
            await redis_set_json("football:live_matches", matches, ex=60)
            return matches

    async def get_match_score(self, match_id: str) -> Dict[str, Any]:
        """Get match details including score, goals, bookings."""
        if not self._api_key():
            return {}

        cache_key = f"football:score:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{FOOTBALL_DATA_BASE}/matches/{match_id}",
                headers=self._headers(),
            )
            if res.status_code != 200:
                return {}
            match_data = res.json()
            await redis_set_json(cache_key, match_data, ex=30)
            return match_data

    async def get_match_players(self, match_id: str) -> List[Dict[str, Any]]:
        """Get lineups for a match. Returns normalized player list."""
        if not self._api_key():
            return []

        cache_key = f"football:players:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{FOOTBALL_DATA_BASE}/matches/{match_id}",
                headers=self._headers(),
            )
            if res.status_code != 200:
                return []
            data = res.json()

            normalized = []
            for side in ["homeTeam", "awayTeam"]:
                team_data = data.get(side, {})
                team_name = team_data.get("shortName", team_data.get("name", ""))

                for player in team_data.get("lineup", []):
                    normalized.append({
                        "player_id": str(player.get("id", "")),
                        "player_name": player.get("name", ""),
                        "team": team_name[:10],
                        "role": player.get("position", ""),
                    })
                for player in team_data.get("bench", []):
                    normalized.append({
                        "player_id": str(player.get("id", "")),
                        "player_name": player.get("name", ""),
                        "team": team_name[:10],
                        "role": "SUB",
                    })

            await redis_set_json(cache_key, normalized, ex=600)
            return normalized

    def calculate_player_points(self, player_id: str, match_data: dict, weightage: int) -> tuple[int, dict]:
        """Calculate football fantasy points for a player from match data."""
        goals_list = match_data.get("goals", [])
        bookings = match_data.get("bookings", [])

        breakdown: Dict[str, int] = {}
        raw_points = 0

        # Count goals and assists
        goals = 0
        assists = 0
        own_goals = 0

        for goal in goals_list:
            scorer = goal.get("scorer", {})
            assist = goal.get("assist", {})
            goal_type = goal.get("type", "REGULAR")

            if str(scorer.get("id")) == player_id:
                if goal_type == "OWN_GOAL":
                    own_goals += 1
                else:
                    goals += 1

            if assist and str(assist.get("id")) == player_id:
                assists += 1

        # Count cards
        yellow_cards = 0
        red_cards = 0
        for booking in bookings:
            booked_player = booking.get("player", {})
            if str(booked_player.get("id")) == player_id:
                card = booking.get("card", "")
                if card == "YELLOW":
                    yellow_cards += 1
                elif card in ("RED", "YELLOW_RED"):
                    red_cards += 1

        if goals > 0:
            raw_points += goals * POINTS_GOAL
            breakdown["goals"] = goals
        if assists > 0:
            raw_points += assists * POINTS_ASSIST
            breakdown["assists"] = assists
        if own_goals > 0:
            raw_points += own_goals * POINTS_OWN_GOAL
            breakdown["own_goals"] = own_goals
        if yellow_cards > 0:
            raw_points += yellow_cards * POINTS_YELLOW_CARD
            breakdown["yellow_cards"] = yellow_cards
        if red_cards > 0:
            raw_points += red_cards * POINTS_RED_CARD
            breakdown["red_cards"] = red_cards

        # Minutes played bonus (simplified — assume playing if no red card)
        if red_cards == 0:
            raw_points += POINTS_MINUTES_PLAYED
            breakdown["minutes_bonus"] = 1

        total = raw_points * weightage
        return total, breakdown

    def extract_match_progress(self, match_data: dict) -> dict:
        """Extract minute and half from Football-Data.org match response."""
        minute = match_data.get("minute", 0) or 0
        status = match_data.get("status", "")

        # Determine half from status and minute
        if status == "PAUSED":
            half = 1  # Halftime break
        elif minute > 45:
            half = 2
        else:
            half = 1

        return {"half": half, "minute": minute, "status": status}

    def is_edit_window(self, current_progress: dict, last_edit_progress: dict) -> bool:
        """Edit window opens at halftime (status changes to PAUSED or half changes)."""
        current_status = current_progress.get("status", "")
        last_status = last_edit_progress.get("status", "")

        # Window opens when match enters PAUSED (halftime)
        if current_status == "PAUSED" and last_status != "PAUSED":
            return True

        # Also open when half changes from 1 to 2
        current_half = current_progress.get("half", 1)
        last_half = last_edit_progress.get("half", 1)
        return current_half > last_half

    def get_edit_trigger(self, current_progress: dict) -> str:
        status = current_progress.get("status", "")
        if status == "PAUSED":
            return "halftime"
        half = current_progress.get("half", 1)
        return "halftime" if half == 2 else "kickoff"

    def get_quiz_context(self, match_data: dict, room_name: str) -> dict:
        home = match_data.get("homeTeam", {}).get("name", "")
        away = match_data.get("awayTeam", {}).get("name", "")
        score = match_data.get("score", {})
        ft = score.get("fullTime", {}) or {}
        minute = match_data.get("minute", 0)

        return {
            "sport": "football",
            "match_name": room_name,
            "home_team": home,
            "away_team": away,
            "current_score": f"{ft.get('home', 0)} - {ft.get('away', 0)}",
            "minute": minute,
        }
