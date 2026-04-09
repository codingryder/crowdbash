import httpx
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json
from app.services.sport_service import SportAdapter
from typing import List, Dict, Any

CRICKETDATA_BASE = "https://api.cricapi.com/v1"
CACHE_TTL = 60


class CricketAdapter(SportAdapter):
    """CricketData.org integration for live cricket data."""

    def _api_key(self) -> str:
        return settings.CRICKETDATA_API_KEY

    async def get_live_matches(self) -> List[Dict[str, Any]]:
        if not self._api_key():
            return []

        cached = await redis_get_json("cricket:live_matches")
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{CRICKETDATA_BASE}/cricScore",
                params={"apikey": self._api_key()}
            )
            data = res.json()
            matches = data.get("data", [])
            await redis_set_json("cricket:live_matches", matches, ex=300)
            return matches

    async def get_match_score(self, match_id: str) -> Dict[str, Any]:
        if not self._api_key():
            return {}

        cache_key = f"cricket:score:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{CRICKETDATA_BASE}/match_scorecard",
                params={"apikey": self._api_key(), "id": match_id}
            )
            data = res.json()
            score_data = data.get("data", {})
            await redis_set_json(cache_key, score_data, ex=CACHE_TTL)
            return score_data

    async def get_match_players(self, match_id: str) -> List[Dict[str, Any]]:
        if not self._api_key():
            return []

        cache_key = f"cricket:players:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{CRICKETDATA_BASE}/match_info",
                params={"apikey": self._api_key(), "id": match_id}
            )
            data = res.json()
            raw_players = data.get("data", {}).get("players", [])

            # Normalize to standard format
            normalized = []
            for team in raw_players:
                team_name = team.get("teamName", "")
                for player in team.get("players", []):
                    normalized.append({
                        "player_id": player.get("id", ""),
                        "player_name": player.get("name", ""),
                        "team": team_name[:10],
                        "role": player.get("role", ""),
                    })

            await redis_set_json(cache_key, normalized, ex=600)
            return normalized

    def calculate_player_points(self, player_id: str, match_data: dict, weightage: int) -> tuple[int, dict]:
        runs = self._extract_player_runs(match_data, player_id)
        points = runs * weightage
        return points, {"runs": runs}

    def extract_match_progress(self, match_data: dict) -> dict:
        over = self._extract_current_over(match_data)
        return {"over": over}

    def is_edit_window(self, current_progress: dict, last_edit_progress: dict) -> bool:
        current_over = current_progress.get("over", 0)
        last_over = last_edit_progress.get("over", 0)
        current_5 = int(float(current_over) / 5)
        last_5 = int(float(last_over) / 5)
        return current_5 > last_5

    def get_edit_trigger(self, current_progress: dict) -> str:
        over = current_progress.get("over", 0)
        return f"over_{int(float(over))}"

    def get_quiz_context(self, match_data: dict, room_name: str) -> dict:
        return {
            "sport": "cricket",
            "match_name": room_name,
            "current_score": str(match_data.get("score", "")),
            "batting_team": match_data.get("batting_team", ""),
            "over": self._extract_current_over(match_data),
            "players": str(match_data.get("players", [])),
        }

    # --- Internal helpers ---

    def _extract_player_runs(self, scorecard: dict, player_id: str) -> int:
        for innings in scorecard.get("scorecard", []):
            for batting_entry in innings.get("batting", []):
                if batting_entry.get("batsman", {}).get("id") == player_id:
                    return batting_entry.get("r", 0)
        return 0

    def _extract_current_over(self, scorecard: dict) -> float:
        try:
            for innings in scorecard.get("scorecard", []):
                if innings.get("inningsId") == 1:
                    overs_str = innings.get("overs", "0")
                    return float(overs_str)
        except Exception:
            pass
        return 0.0
