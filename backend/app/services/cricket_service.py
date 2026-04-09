import httpx
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json
from app.services.sport_service import SportAdapter
from typing import List, Dict, Any

CRICKETDATA_BASE = "https://api.cricapi.com/v1"
CACHE_TTL = 30  # 30 seconds cache for faster live updates


class CricketAdapter(SportAdapter):
    """CricketData.org integration for live cricket data."""

    _current_match_name: str = ""

    def _api_key(self) -> str:
        return settings.CRICKETDATA_API_KEY

    def set_match_context(self, match_name: str):
        """Set the current match name for Gemini fallback."""
        self._current_match_name = match_name

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
        cache_key = f"cricket:score:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached and cached.get("score"):
            return cached

        score_data = {}

        # Priority 1: CricketData.org (has score[] + scorecard[] with batting/bowling)
        try:
            if self._api_key():
                async with httpx.AsyncClient() as client:
                    res = await client.get(
                        f"{CRICKETDATA_BASE}/match_scorecard",
                        params={"apikey": self._api_key(), "id": match_id}
                    )
                    data = res.json()
                    api_data = data.get("data", {})
                    if api_data.get("score") or api_data.get("scorecard"):
                        score_data = api_data
        except Exception as e:
            print(f"CricketData API error: {e}")

        # Priority 2: Gemini (returns score[] + scorecard[] in same format)
        if not score_data.get("score") and not score_data.get("scorecard"):
            try:
                from app.services.live_score_service import fetch_live_score_via_gemini
                gemini_data = await fetch_live_score_via_gemini(
                    self._current_match_name or match_id
                )
                if gemini_data:
                    score_data = gemini_data
            except Exception as e:
                print(f"Gemini error: {e}")

        if score_data:
            await redis_set_json(cache_key, score_data, ex=20)
        return score_data

    async def get_match_players(self, match_id: str) -> List[Dict[str, Any]]:
        if not self._api_key():
            return []

        cache_key = f"cricket:players:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient() as client:
            # Use match_squad endpoint for full squad data
            res = await client.get(
                f"{CRICKETDATA_BASE}/match_squad",
                params={"apikey": self._api_key(), "id": match_id}
            )
            data = res.json()
            raw_teams = data.get("data", [])

            # Fallback to match_info if match_squad fails
            if not raw_teams or data.get("status") != "success":
                res = await client.get(
                    f"{CRICKETDATA_BASE}/match_info",
                    params={"apikey": self._api_key(), "id": match_id}
                )
                data = res.json()
                raw_teams = data.get("data", {}).get("players", [])

            # Normalize to standard format
            normalized = []
            for team in raw_teams:
                team_name = team.get("teamName", team.get("name", ""))
                for player in team.get("players", []):
                    # Determine role from batting/bowling style
                    batting = player.get("battingStyle", "")
                    bowling = player.get("bowlingStyle", "")
                    if bowling and "keeper" in player.get("playingRole", "").lower():
                        role = "wicket-keeper"
                    elif bowling and batting:
                        role = "all-rounder"
                    elif bowling:
                        role = "bowler"
                    else:
                        role = "batsman"

                    # Override with playingRole if available
                    playing_role = player.get("playingRole", "").lower()
                    if "keeper" in playing_role:
                        role = "wicket-keeper"
                    elif "allrounder" in playing_role or "all-rounder" in playing_role:
                        role = "all-rounder"
                    elif "bowler" in playing_role:
                        role = "bowler"
                    elif "batter" in playing_role or "batsman" in playing_role:
                        role = "batsman"

                    normalized.append({
                        "player_id": player.get("id", ""),
                        "player_name": player.get("name", ""),
                        "team": team_name,
                        "role": role,
                    })

            await redis_set_json(cache_key, normalized, ex=600)
            return normalized

    def _match_player(self, api_player: dict, player_id: str, player_name: str) -> bool:
        """Match a player from API data by ID or name."""
        if isinstance(api_player, dict):
            # Try ID match first
            if api_player.get("id") == player_id:
                return True
            # Fallback: name match (case-insensitive, handles partial names)
            api_name = (api_player.get("name") or "").lower().strip()
            our_name = player_name.lower().strip()
            if api_name and our_name:
                # Exact match
                if api_name == our_name:
                    return True
                # Last name match (handles "V Kohli" vs "Virat Kohli")
                api_parts = api_name.split()
                our_parts = our_name.split()
                if len(api_parts) > 0 and len(our_parts) > 0:
                    if api_parts[-1] == our_parts[-1]:  # Same last name
                        return True
        return False

    def calculate_player_points(self, player_id: str, match_data: dict, weightage: int, player_name: str = "") -> tuple[int, dict]:
        """Full fantasy scoring for cricket."""
        breakdown: dict = {}
        fantasy_pts = 0

        for innings in match_data.get("scorecard", []):
            # Batting points
            for bat in innings.get("batting", []):
                batsman = bat.get("batsman", {})
                if self._match_player(batsman, player_id, player_name):
                    runs = bat.get("r", 0)
                    fours = bat.get("4s", 0)
                    sixes = bat.get("6s", 0)
                    is_out = bat.get("dismissal", "") != "" and bat.get("dismissal", "") != "not out"

                    batting_pts = runs  # 1 pt per run
                    batting_pts += fours * 4  # +4 per boundary
                    batting_pts += sixes * 6  # +6 per six
                    if runs >= 100:
                        batting_pts += 50  # century bonus
                    elif runs >= 50:
                        batting_pts += 25  # half-century bonus
                    if runs == 0 and is_out:
                        batting_pts -= 5  # duck penalty

                    fantasy_pts += batting_pts
                    breakdown["runs"] = runs
                    breakdown["fours"] = fours
                    breakdown["sixes"] = sixes
                    breakdown["batting_points"] = batting_pts

            # Bowling points
            for bowl in innings.get("bowling", []):
                bowler = bowl.get("bowler", {})
                if self._match_player(bowler, player_id, player_name):
                    wickets = bowl.get("w", 0)
                    maidens = bowl.get("m", 0)

                    bowling_pts = wickets * 25  # 25 per wicket
                    bowling_pts += maidens * 10  # 10 per maiden
                    if wickets >= 5:
                        bowling_pts += 50  # 5-wicket haul bonus
                    elif wickets >= 3:
                        bowling_pts += 25  # 3-wicket haul bonus

                    fantasy_pts += bowling_pts
                    breakdown["wickets"] = wickets
                    breakdown["maidens"] = maidens
                    breakdown["bowling_points"] = bowling_pts

            # Fielding points (from dismissals in batting entries)
            for bat in innings.get("batting", []):
                dismissal = bat.get("dismissal", "")
                catcher = bat.get("fielder", {})
                if self._match_player(catcher, player_id, player_name):
                    if "caught" in dismissal.lower():
                        fantasy_pts += 10
                        breakdown["catches"] = breakdown.get("catches", 0) + 1
                    elif "stumped" in dismissal.lower():
                        fantasy_pts += 15
                        breakdown["stumpings"] = breakdown.get("stumpings", 0) + 1
                    elif "run out" in dismissal.lower():
                        fantasy_pts += 10
                        breakdown["run_outs"] = breakdown.get("run_outs", 0) + 1

        breakdown["fantasy_points"] = fantasy_pts
        breakdown["weightage"] = weightage
        total_points = fantasy_pts * weightage
        breakdown["total_points"] = total_points

        return total_points, breakdown

    def normalize_score(self, match_data: dict, room_name: str) -> dict:
        """Normalize CricketData.org scorecard to rich frontend format."""
        parts = room_name.split(" vs ")
        team1_name = parts[0].strip() if len(parts) > 0 else "Team 1"
        team2_name = parts[1].strip() if len(parts) > 1 else "Team 2"

        scorecard = match_data.get("scorecard", [])
        # Also check 'score' array from currentMatches endpoint
        score_arr = match_data.get("score", [])

        team1_score = "—"
        team1_overs = "—"
        team2_score = "—"
        team2_overs = "—"

        # Parse from score array (simpler format from currentMatches)
        if score_arr and isinstance(score_arr, list):
            for i, s in enumerate(score_arr[:2]):
                runs = s.get("r", 0)
                wickets = s.get("w", 0)
                overs = str(s.get("o", "0"))
                if i == 0:
                    team1_score = f"{runs}/{wickets}"
                    team1_overs = overs
                elif i == 1:
                    team2_score = f"{runs}/{wickets}"
                    team2_overs = overs

        # Only use scorecard totals if score_arr was empty AND totals has data
        if not score_arr and scorecard:
            for i, innings in enumerate(scorecard):
                totals = innings.get("totals", {})
                if not totals:
                    # Compute from batting entries
                    batting = innings.get("batting", [])
                    runs = sum(b.get("r", 0) for b in batting)
                    extras = innings.get("extras", {})
                    if isinstance(extras, dict):
                        runs += extras.get("t", extras.get("total", 0))
                    wickets = sum(1 for b in batting if b.get("dismissal", "") and b.get("dismissal", "") not in ("not out", "batting", ""))
                    overs = str(innings.get("overs", "0"))
                else:
                    runs = totals.get("R", 0)
                    wickets = totals.get("W", 0)
                    overs = str(totals.get("O", "0"))
                if i == 0:
                    team1_score = f"{runs}/{wickets}"
                    team1_overs = overs
                elif i == 1:
                    team2_score = f"{runs}/{wickets}"
                    team2_overs = overs

        status = match_data.get("status", "")
        current_over = self._extract_current_over(match_data)

        # Extract current batters and bowlers from scorecard
        current_batting = []
        current_bowling = []
        if scorecard:
            # Last innings is the currently active one
            active_innings = scorecard[-1]
            for bat in active_innings.get("batting", []):
                batsman = bat.get("batsman", {})
                name = batsman.get("name", "") if isinstance(batsman, dict) else str(batsman)
                dismissal = bat.get("dismissal", "")
                if not dismissal or dismissal == "not out" or dismissal == "batting":
                    current_batting.append({
                        "name": name,
                        "runs": bat.get("r", 0),
                        "balls": bat.get("b", 0),
                        "fours": bat.get("4s", 0),
                        "sixes": bat.get("6s", 0),
                    })
            for bowl in active_innings.get("bowling", []):
                bowler = bowl.get("bowler", {})
                name = bowler.get("name", "") if isinstance(bowler, dict) else str(bowler)
                current_bowling.append({
                    "name": name,
                    "wickets": bowl.get("w", 0),
                    "runs": bowl.get("r", 0),
                    "overs": str(bowl.get("o", 0)),
                    "maidens": bowl.get("m", 0),
                })

        # Full scorecard for modal
        innings_data = []
        for inn in scorecard:
            inning_name = inn.get("inning", f"Innings {len(innings_data) + 1}")
            batting = []
            for bat in inn.get("batting", []):
                batsman = bat.get("batsman", {})
                batting.append({
                    "name": batsman.get("name", "") if isinstance(batsman, dict) else str(batsman),
                    "runs": bat.get("r", 0),
                    "balls": bat.get("b", 0),
                    "fours": bat.get("4s", 0),
                    "sixes": bat.get("6s", 0),
                    "dismissal": bat.get("dismissal", ""),
                    "sr": round(bat.get("r", 0) / max(bat.get("b", 1), 1) * 100, 1),
                })
            bowling = []
            for bowl in inn.get("bowling", []):
                bowler = bowl.get("bowler", {})
                bowling.append({
                    "name": bowler.get("name", "") if isinstance(bowler, dict) else str(bowler),
                    "overs": str(bowl.get("o", 0)),
                    "maidens": bowl.get("m", 0),
                    "runs": bowl.get("r", 0),
                    "wickets": bowl.get("w", 0),
                    "economy": round(bowl.get("r", 0) / max(float(bowl.get("o", 1)), 0.1), 1),
                })
            innings_data.append({
                "name": inning_name,
                "batting": batting,
                "bowling": bowling,
            })

        # Calculate CRR from score array
        crr = 0
        if score_arr:
            last = score_arr[-1]
            runs = last.get("r", 0)
            overs = float(last.get("o", 0))
            if overs > 0:
                crr = round(runs / overs, 2)

        return {
            "sport": "cricket",
            "match_name": room_name,
            "team1": {"name": team1_name, "score": team1_score, "overs": team1_overs},
            "team2": {"name": team2_name, "score": team2_score, "overs": team2_overs},
            "status": status,
            "current_rate": crr,
            "batting_team": "",
            "current_batting": current_batting[:2],
            "current_bowling": current_bowling[:2],
            "innings": innings_data,
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

    def _extract_current_over(self, match_data: dict) -> float:
        """Get current over from score array or scorecard."""
        try:
            # Best source: score[] array has current overs
            score_arr = match_data.get("score", [])
            if score_arr:
                # Last innings in score array is the active one
                last = score_arr[-1]
                return float(last.get("o", 0))
            # Fallback: scorecard innings
            for innings in match_data.get("scorecard", []):
                overs = innings.get("overs", innings.get("totals", {}).get("O", 0))
                if overs:
                    return float(overs)
        except Exception:
            pass
        return 0.0
