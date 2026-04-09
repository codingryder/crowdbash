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

    def normalize_score(self, match_data: dict, room_name: str) -> dict:
        """Normalize CricketData.org scorecard to frontend CricketScoreData format."""
        parts = room_name.split(" vs ")
        team1_name = parts[0].strip() if len(parts) > 0 else "Team 1"
        team2_name = parts[1].strip() if len(parts) > 1 else "Team 2"

        scorecard = match_data.get("scorecard", [])
        team1_score = "—"
        team1_overs = "—"
        team2_score = "—"
        team2_overs = "—"

        for i, innings in enumerate(scorecard):
            runs = innings.get("runs", 0)
            wickets = innings.get("wickets", 0)
            overs = str(innings.get("overs", "0"))
            score_str = f"{runs}/{wickets}"
            if i == 0:
                team1_score = score_str
                team1_overs = overs
            elif i == 1:
                team2_score = score_str
                team2_overs = overs

        status = match_data.get("status", "")
        current_over = self._extract_current_over(match_data)

        return {
            "sport": "cricket",
            "match_name": room_name,
            "team1": {"name": team1_name, "score": team1_score, "overs": team1_overs},
            "team2": {"name": team2_name, "score": team2_score, "overs": team2_overs},
            "status": status,
            "current_rate": 0,
            "batting_team": "",
        }

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

    def format_match_summary(self, match_data: dict, room_name: str) -> dict:
        """Extract full match summary for a completed cricket match."""
        status = match_data.get("status", "")
        scorecard = match_data.get("scorecard", [])

        teams = []
        top_batters = []
        top_bowlers = []

        for innings in scorecard:
            team_name = innings.get("team", {}).get("name", "") or innings.get("team", "")
            overs = innings.get("overs", "0")
            runs = innings.get("runs", 0)
            wickets = innings.get("wickets", 0)
            teams.append({
                "name": team_name,
                "score": f"{runs}/{wickets}",
                "overs": str(overs),
            })

            # Top batters from this innings
            batting = innings.get("batting", [])
            sorted_batting = sorted(batting, key=lambda b: b.get("r", 0), reverse=True)
            for b in sorted_batting[:3]:
                batsman = b.get("batsman", {})
                top_batters.append({
                    "name": batsman.get("name", "") if isinstance(batsman, dict) else str(batsman),
                    "runs": b.get("r", 0),
                    "balls": b.get("b", 0),
                    "team": team_name[:15],
                })

            # Top bowlers from this innings
            bowling = innings.get("bowling", [])
            sorted_bowling = sorted(bowling, key=lambda b: b.get("w", 0), reverse=True)
            for b in sorted_bowling[:2]:
                bowler = b.get("bowler", {})
                top_bowlers.append({
                    "name": bowler.get("name", "") if isinstance(bowler, dict) else str(bowler),
                    "wickets": b.get("w", 0),
                    "runs_conceded": b.get("r", 0),
                    "overs": str(b.get("o", 0)),
                })

        return {
            "status": "completed",
            "sport": "cricket",
            "match_name": room_name,
            "result": status,
            "teams": teams[:2],
            "top_batters": top_batters[:6],
            "top_bowlers": top_bowlers[:4],
        }

    def is_match_finished(self, match_data: dict) -> bool:
        """Check if cricket match is finished from scorecard data."""
        status = match_data.get("status", "")
        ms = match_data.get("ms", "")
        # CricketData.org uses "result" for finished, or status contains "won"/"draw"/"tie"
        if ms == "result":
            return True
        status_lower = status.lower()
        return any(w in status_lower for w in ["won", "draw", "tie", "abandoned", "no result"])

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
