import httpx
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json
from app.services.sport_service import SportAdapter
from typing import List, Dict, Any

# Football scoring constants
POINTS_GOAL = 6
POINTS_ASSIST = 3
POINTS_CLEAN_SHEET = 4
POINTS_PENALTY_SAVED = 5
POINTS_MINUTES_60 = 1
POINTS_YELLOW_CARD = -1
POINTS_RED_CARD = -3
POINTS_OWN_GOAL = -2
POINTS_PENALTY_MISSED = -2


class FootballAdapter(SportAdapter):
    """API-Football integration for live football data.

    API: https://v3.football.api-sports.io
    Auth: x-apisports-key header
    """

    def _api_key(self) -> str:
        return settings.FOOTBALL_API_KEY

    def _api_host(self) -> str:
        return settings.FOOTBALL_API_HOST

    def _headers(self) -> dict:
        return {
            "x-apisports-key": self._api_key(),
        }

    async def get_live_matches(self) -> List[Dict[str, Any]]:
        if not self._api_key():
            return []

        cached = await redis_get_json("football:live_matches")
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://{self._api_host()}/fixtures",
                params={"live": "all"},
                headers=self._headers(),
            )
            data = res.json()
            matches = data.get("response", [])
            await redis_set_json("football:live_matches", matches, ex=120)
            return matches

    async def get_match_score(self, match_id: str) -> Dict[str, Any]:
        if not self._api_key():
            return {}

        cache_key = f"football:score:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://{self._api_host()}/fixtures",
                params={"id": match_id},
                headers=self._headers(),
            )
            data = res.json()
            fixtures = data.get("response", [])
            match_data = fixtures[0] if fixtures else {}
            await redis_set_json(cache_key, match_data, ex=30)
            return match_data

    async def get_match_players(self, match_id: str) -> List[Dict[str, Any]]:
        if not self._api_key():
            return []

        cache_key = f"football:players:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://{self._api_host()}/fixtures/lineups",
                params={"fixture": match_id},
                headers=self._headers(),
            )
            data = res.json()
            lineups = data.get("response", [])

            # Normalize to standard format
            normalized = []
            for team_lineup in lineups:
                team_name = team_lineup.get("team", {}).get("name", "")
                for player in team_lineup.get("startXI", []):
                    p = player.get("player", {})
                    normalized.append({
                        "player_id": str(p.get("id", "")),
                        "player_name": p.get("name", ""),
                        "team": team_name[:10],
                        "role": p.get("pos", ""),  # G, D, M, F
                    })
                for player in team_lineup.get("substitutes", []):
                    p = player.get("player", {})
                    normalized.append({
                        "player_id": str(p.get("id", "")),
                        "player_name": p.get("name", ""),
                        "team": team_name[:10],
                        "role": p.get("pos", "SUB"),
                    })

            await redis_set_json(cache_key, normalized, ex=600)
            return normalized

    def calculate_player_points(self, player_id: str, match_data: dict, weightage: int) -> tuple[int, dict]:
        """Calculate football fantasy points for a player."""
        events = match_data.get("events", [])
        player_stats = match_data.get("players", [])

        breakdown = {}
        raw_points = 0

        # Count events
        goals = 0
        assists = 0
        yellow_cards = 0
        red_cards = 0
        own_goals = 0
        penalty_missed = 0

        for event in events:
            ep = event.get("player", {})
            ea = event.get("assist", {})
            event_type = event.get("type", "")
            detail = event.get("detail", "")

            if str(ep.get("id")) == player_id:
                if event_type == "Goal" and detail != "Own Goal":
                    goals += 1
                elif event_type == "Goal" and detail == "Own Goal":
                    own_goals += 1
                elif event_type == "Card" and detail == "Yellow Card":
                    yellow_cards += 1
                elif event_type == "Card" and detail == "Red Card":
                    red_cards += 1
                elif event_type == "Goal" and detail == "Missed Penalty":
                    penalty_missed += 1

            if str(ea.get("id")) == player_id and event_type == "Goal":
                assists += 1

        if goals > 0:
            raw_points += goals * POINTS_GOAL
            breakdown["goals"] = goals
        if assists > 0:
            raw_points += assists * POINTS_ASSIST
            breakdown["assists"] = assists
        if yellow_cards > 0:
            raw_points += yellow_cards * POINTS_YELLOW_CARD
            breakdown["yellow_cards"] = yellow_cards
        if red_cards > 0:
            raw_points += red_cards * POINTS_RED_CARD
            breakdown["red_cards"] = red_cards
        if own_goals > 0:
            raw_points += own_goals * POINTS_OWN_GOAL
            breakdown["own_goals"] = own_goals
        if penalty_missed > 0:
            raw_points += penalty_missed * POINTS_PENALTY_MISSED
            breakdown["penalty_missed"] = penalty_missed

        # Minutes played bonus
        # (simplified — full implementation needs player stats from API)
        if raw_points >= 0:
            raw_points += POINTS_MINUTES_60
            breakdown["minutes_bonus"] = 1

        total = raw_points * weightage
        return total, breakdown

    def extract_match_progress(self, match_data: dict) -> dict:
        fixture = match_data.get("fixture", {}) if "fixture" in match_data else match_data
        status = fixture.get("status", {})
        elapsed = status.get("elapsed", 0) or 0
        half = 1 if elapsed <= 45 else 2
        return {"half": half, "minute": elapsed}

    def is_edit_window(self, current_progress: dict, last_edit_progress: dict) -> bool:
        """Edit window opens at halftime (half changes from 1 to 2)."""
        current_half = current_progress.get("half", 1)
        last_half = last_edit_progress.get("half", 1)
        return current_half > last_half

    def get_edit_trigger(self, current_progress: dict) -> str:
        half = current_progress.get("half", 1)
        return "halftime" if half == 2 else "kickoff"

    def get_quiz_context(self, match_data: dict, room_name: str) -> dict:
        fixture = match_data.get("fixture", {}) if "fixture" in match_data else match_data
        teams = match_data.get("teams", {})
        goals = match_data.get("goals", {})
        status = fixture.get("status", {})

        home = teams.get("home", {}).get("name", "")
        away = teams.get("away", {}).get("name", "")
        score = f"{goals.get('home', 0)} - {goals.get('away', 0)}"

        return {
            "sport": "football",
            "match_name": room_name,
            "home_team": home,
            "away_team": away,
            "current_score": score,
            "minute": status.get("elapsed", 0),
        }
