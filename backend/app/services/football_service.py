from app.core.redis import redis_get_json, redis_set_json
from app.services.sport_service import SportAdapter
from typing import List, Dict, Any

# Football scoring constants
POINTS_GOAL = 6
POINTS_ASSIST = 3
POINTS_CLEAN_SHEET = 4
POINTS_YELLOW_CARD = -1
POINTS_RED_CARD = -3
POINTS_OWN_GOAL = -2
POINTS_MINUTES_PLAYED = 1


class FootballAdapter(SportAdapter):
    """Football adapter: Football-Data.org primary → Gemini fallback."""

    _current_match_name: str = ""

    def set_match_context(self, match_name: str):
        self._current_match_name = match_name

    async def get_live_matches(self) -> List[Dict[str, Any]]:
        cached = await redis_get_json("football:live_matches")
        if cached:
            return cached

        # Try Football-Data.org first
        try:
            from app.services.footballdata_service import get_matches
            matches = await get_matches(status="IN_PLAY,PAUSED")
            if matches:
                await redis_set_json("football:live_matches", matches, ex=60)
                return matches
        except Exception as e:
            print(f"Football-Data.org live_matches error: {e}")

        return []

    async def get_match_score(self, match_id: str) -> Dict[str, Any]:
        """Get match score: Football-Data.org → Gemini fallback."""
        cache_key = f"football:score:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        score_data = {}

        # Layer 1: Try Football-Data.org
        try:
            from app.services.footballdata_service import get_match_detail
            fd_data = await get_match_detail(match_id)
            if fd_data and fd_data.get("homeTeam"):
                score_data = fd_data
                print(f"Football score from Football-Data.org: {match_id}")
        except Exception as e:
            print(f"Football-Data.org match detail error: {e}")

        # Layer 2: Gemini fallback
        if not score_data:
            print(f"Football-Data returned None for {match_id}, trying Gemini for '{self._current_match_name}'")
            if not self._current_match_name:
                print("WARNING: No match_name set — Gemini fallback will be skipped!")
            try:
                from app.services.live_score_service import fetch_live_score_via_gemini
                if self._current_match_name:
                    gemini_data = await fetch_live_score_via_gemini(self._current_match_name, "football")
                    if gemini_data:
                        score_data = gemini_data
                        print(f"Football score from Gemini: {self._current_match_name}")
                    else:
                        print(f"Gemini returned no score data for '{self._current_match_name}'")
            except Exception as e:
                print(f"Gemini football error: {e}")

        if score_data:
            await redis_set_json(cache_key, score_data, ex=45)
        return score_data

    async def get_match_players(self, match_id: str) -> List[Dict[str, Any]]:
        """Get squad: Football-Data.org lineups → Gemini fallback."""
        cache_key = f"football:players:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        # Layer 1: Try Football-Data.org lineups
        try:
            from app.services.footballdata_service import get_match_detail, extract_lineups_as_players
            detail = await get_match_detail(match_id)
            if detail:
                players = extract_lineups_as_players(detail)
                if players:
                    await redis_set_json(cache_key, players, ex=600)
                    return players
        except Exception as e:
            print(f"Football-Data.org lineups error: {e}")

        # Layer 2: Gemini fallback
        try:
            from app.services.live_score_service import fetch_squad_via_gemini
            if self._current_match_name:
                players = await fetch_squad_via_gemini(self._current_match_name, "football")
                if players:
                    await redis_set_json(cache_key, players, ex=600)
                    return players
        except Exception as e:
            print(f"Gemini football squad error: {e}")
        return []

    def calculate_player_points(self, player_id: str, match_data: dict, weightage: int, player_name: str = "") -> tuple[int, dict]:
        breakdown: Dict[str, int] = {}
        raw_points = 0

        goals_list = match_data.get("goals", [])
        bookings = match_data.get("bookings", [])

        goals = assists = own_goals = yellow_cards = red_cards = 0

        for goal in goals_list:
            scorer = goal.get("scorer", {})
            assist = goal.get("assist", {})
            goal_type = goal.get("type", "REGULAR")
            scorer_name = (scorer.get("name") or "").lower()
            pn = player_name.lower()

            if scorer_name and pn and (scorer_name == pn or scorer_name.split()[-1:] == pn.split()[-1:]):
                if goal_type == "OWN_GOAL": own_goals += 1
                else: goals += 1

            assist_name = (assist.get("name") or "").lower() if assist else ""
            if assist_name and pn and (assist_name == pn or assist_name.split()[-1:] == pn.split()[-1:]):
                assists += 1

        for booking in bookings:
            bp = booking.get("player", {})
            bp_name = (bp.get("name") or "").lower()
            pn = player_name.lower()
            if bp_name and pn and (bp_name == pn or bp_name.split()[-1:] == pn.split()[-1:]):
                card = booking.get("card", "")
                if card == "YELLOW": yellow_cards += 1
                elif card in ("RED", "YELLOW_RED"): red_cards += 1

        if goals > 0: raw_points += goals * POINTS_GOAL; breakdown["goals"] = goals
        if assists > 0: raw_points += assists * POINTS_ASSIST; breakdown["assists"] = assists
        if own_goals > 0: raw_points += own_goals * POINTS_OWN_GOAL; breakdown["own_goals"] = own_goals
        if yellow_cards > 0: raw_points += yellow_cards * POINTS_YELLOW_CARD; breakdown["yellow_cards"] = yellow_cards
        if red_cards > 0: raw_points += red_cards * POINTS_RED_CARD; breakdown["red_cards"] = red_cards
        if red_cards == 0: raw_points += POINTS_MINUTES_PLAYED; breakdown["minutes_bonus"] = 1

        total = raw_points * weightage
        return total, breakdown

    def normalize_score(self, match_data: dict, room_name: str) -> dict:
        score = match_data.get("score", {})
        home_team = match_data.get("homeTeam", {}).get("name", "") or match_data.get("home_team", "")
        away_team = match_data.get("awayTeam", {}).get("name", "") or match_data.get("away_team", "")

        if not home_team or not away_team:
            parts = room_name.split(" vs ")
            home_team = home_team or (parts[0].strip() if len(parts) > 0 else "Home")
            away_team = away_team or (parts[1].strip() if len(parts) > 1 else "Away")

        ft = score.get("fullTime", score) if isinstance(score, dict) else {}
        home_goals = ft.get("home", match_data.get("home_goals", 0))
        away_goals = ft.get("away", match_data.get("away_goals", 0))
        status = match_data.get("status", "")
        minute = match_data.get("minute", 0) or 0
        half = 1 if minute <= 45 else 2

        return {
            "sport": "football",
            "home": {"name": home_team, "goals": home_goals},
            "away": {"name": away_team, "goals": away_goals},
            "minute": minute,
            "half": half,
            "status": status,
        }

    def extract_match_progress(self, match_data: dict) -> dict:
        minute = match_data.get("minute", 0) or 0
        status = match_data.get("status", "")
        half = 1 if minute <= 45 or status == "PAUSED" else 2
        return {"half": half, "minute": minute, "status": status}

    def is_edit_window(self, current_progress: dict, last_edit_progress: dict) -> bool:
        current_half = current_progress.get("half", 1)
        last_half = last_edit_progress.get("half", 1)
        return current_half > last_half

    def get_edit_trigger(self, current_progress: dict) -> str:
        return "halftime" if current_progress.get("half", 1) == 2 else "kickoff"

    def format_match_summary(self, match_data: dict, room_name: str) -> dict:
        normalized = self.normalize_score(match_data, room_name)
        hg = normalized["home"]["goals"]
        ag = normalized["away"]["goals"]
        hn = normalized["home"]["name"]
        an = normalized["away"]["name"]
        result = f"{hn} won" if hg > ag else f"{an} won" if ag > hg else "Draw"

        return {
            "status": "completed",
            "sport": "football",
            "match_name": room_name,
            "home_team": hn,
            "away_team": an,
            "home_goals": hg,
            "away_goals": ag,
            "result": result,
            "scorers": match_data.get("scorers", match_data.get("goals", [])),
            "cards": match_data.get("cards", match_data.get("bookings", [])),
        }

    def is_match_finished(self, match_data: dict) -> bool:
        # Never trust Gemini — it always says matchEnded=false
        if match_data.get("source") == "gemini":
            return False
        # Football-Data.org returns real matchEnded flag
        if match_data.get("matchEnded") is True:
            return True
        status = match_data.get("status", "")
        return status in ("FINISHED", "AWARDED", "CANCELLED")

    def get_quiz_context(self, match_data: dict, room_name: str) -> dict:
        return {"sport": "football", "match_name": room_name}
