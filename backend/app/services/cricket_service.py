import asyncio

from app.core.redis import redis_get_json, redis_set_json
from app.services.sport_service import SportAdapter
from typing import List, Dict, Any


class CricketAdapter(SportAdapter):
    """Cricket adapter: ESPN primary → CricketData.org → Gemini fallback."""

    _current_match_name: str = ""
    _current_league: str = ""

    def set_match_context(self, match_name: str, league: str = ""):
        # Route hands us league for the football adapter; accepting it here
        # too keeps the call signature uniform and lets the ESPN by-name
        # squad lookup pick the right series (IPL/T20I/etc).
        self._current_match_name = match_name
        self._current_league = league

    async def get_live_matches(self) -> List[Dict[str, Any]]:
        """Get live matches: CricketData.org → ESPN → Gemini fallback."""
        cached = await redis_get_json("cricket:live_matches")
        if cached:
            return cached

        # Layer 1: Try CricketData.org first
        try:
            from app.services.cricketdata_service import get_current_matches
            matches = await get_current_matches()
            if matches:
                await redis_set_json("cricket:live_matches", matches, ex=300)
                return matches
        except Exception as e:
            print(f"CricketData live_matches error: {e}")

        # Layer 2: ESPN (free, no auth, reliable)
        try:
            from app.services.espn_service import get_espn_live_cricket_matches
            espn_matches = await get_espn_live_cricket_matches()
            if espn_matches:
                print(f"Cricket live matches from ESPN: {len(espn_matches)} matches")
                await redis_set_json("cricket:live_matches", espn_matches, ex=120)
                return espn_matches
        except Exception as e:
            print(f"ESPN live_matches error: {e}")

        # Layer 3: Gemini fallback with Google Search grounding
        try:
            from app.services.live_score_service import fetch_live_matches_via_gemini
            gemini_matches = await fetch_live_matches_via_gemini("cricket")
            if gemini_matches:
                print(f"Cricket live matches from Gemini: {len(gemini_matches)} matches")
                await redis_set_json("cricket:live_matches", gemini_matches, ex=300)
                return gemini_matches
        except Exception as e:
            print(f"Gemini live_matches error: {e}")

        return []

    async def get_match_score(self, match_id: str) -> Dict[str, Any]:
        """Get match score: ESPN → CricketData.org → Gemini fallback."""
        cache_key = f"cricket:score:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached and cached.get("score"):
            return cached

        score_data = {}

        # Layer 1: ESPN detailed (for espn_ prefixed IDs — includes scorecard)
        if match_id.startswith("espn_"):
            try:
                from app.services.espn_service import get_espn_match_detail
                espn_data = await get_espn_match_detail(self._current_match_name)
                if espn_data and (espn_data.get("score") or espn_data.get("scorecard")):
                    score_data = espn_data
                    print(f"Cricket score+scorecard from ESPN: {match_id}")
            except Exception as e:
                print(f"ESPN detail error: {e}")

            # Fallback to basic ESPN status if detail failed
            if not score_data:
                try:
                    from app.services.espn_service import fetch_espn_match_by_name
                    espn_basic = await fetch_espn_match_by_name(self._current_match_name)
                    if espn_basic and espn_basic.get("score"):
                        score_data = espn_basic
                        print(f"Cricket basic score from ESPN: {match_id}")
                except Exception as e:
                    print(f"ESPN basic score error: {e}")

        # Layer 2: Try CricketData.org
        if not score_data:
            try:
                from app.services.cricketdata_service import get_match_scorecard
                cd_data = await get_match_scorecard(match_id)
                if cd_data and (cd_data.get("score") or cd_data.get("scorecard")):
                    score_data = cd_data
                    print(f"Cricket score from CricketData: {match_id}")
            except Exception as e:
                print(f"CricketData scorecard error: {e}")

        # Layer 2: Gemini fallback
        if not score_data:
            print(f"CricketData returned None for {match_id}, trying Gemini for '{self._current_match_name}'")
            if not self._current_match_name:
                print("WARNING: No match_name set — Gemini fallback will be skipped!")
            try:
                from app.services.live_score_service import fetch_live_score_via_gemini
                if self._current_match_name:
                    gemini_data = await fetch_live_score_via_gemini(self._current_match_name, "cricket")
                    if gemini_data and (gemini_data.get("score") or gemini_data.get("scorecard")):
                        score_data = gemini_data
                        print(f"Cricket score from Gemini: {self._current_match_name}")
                    else:
                        print(f"Gemini returned no score data for '{self._current_match_name}'")
            except Exception as e:
                print(f"Gemini cricket error: {e}")

        if score_data:
            await redis_set_json(cache_key, score_data, ex=20)  # Short cache for live data
        return score_data

    async def get_match_players(self, match_id: str) -> List[Dict[str, Any]]:
        """Get squad: ESPN → CricketData.org → Gemini fallback.

        ESPN's summary endpoint returns the full squad even pre-match (unlike
        CricketData's scorecard, which only populates after first ball), so
        ESPN goes first. For non-`espn_` match IDs we resolve the ESPN
        event via a name search against the IPL/T20I scoreboard.
        """
        cache_key = f"cricket:players:{match_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        # Layer 1a: ESPN direct — espn_-prefixed match IDs already carry the
        # event_id, no scoreboard search needed.
        if match_id.startswith("espn_"):
            try:
                from app.services.espn_service import get_espn_match_players
                espn_id = match_id.replace("espn_", "")
                players = await get_espn_match_players(espn_id)
                if players:
                    print(f"Cricket players from ESPN (direct): {len(players)} for {match_id}")
                    await redis_set_json(cache_key, players, ex=3600)
                    return players
            except Exception as e:
                print(f"ESPN players (direct) error: {e}")

        # Layer 1b: ESPN by-name lookup. Most cricket rooms (CricketData IDs,
        # admin-created UUIDs) hit this branch — fast primary path because
        # ESPN's summary squads[] is populated even pre-match.
        if self._current_match_name:
            try:
                from app.services.espn_service import get_espn_cricket_squad_by_name
                players = await get_espn_cricket_squad_by_name(
                    self._current_match_name, self._current_league
                )
                if players:
                    print(f"Cricket players from ESPN (by name): {len(players)} for '{self._current_match_name}'")
                    await redis_set_json(cache_key, players, ex=3600)
                    return players
            except Exception as e:
                print(f"ESPN by-name squad error: {e}")

        # Layer 2: CricketData.org scorecard-derived squad. Only useful once
        # the match has started (pre-match scorecards are empty).
        try:
            from app.services.cricketdata_service import get_players_list
            players = await get_players_list(match_id)
            if players:
                await redis_set_json(cache_key, players, ex=600)
                return players
        except Exception as e:
            print(f"CricketData players error: {e}")

        # Layer 3: Gemini fallback — last resort. Hard-cap so a hung grounded
        # search can't keep the user on the loading screen for minutes; 25s
        # is plenty for a real Gemini response.
        try:
            from app.services.live_score_service import fetch_squad_via_gemini
            if self._current_match_name:
                players = await asyncio.wait_for(
                    fetch_squad_via_gemini(self._current_match_name, "cricket"),
                    timeout=25,
                )
                if players:
                    await redis_set_json(cache_key, players, ex=600)
                    return players
        except asyncio.TimeoutError:
            print(f"Gemini squad fetch timed out for '{self._current_match_name}'")
        except Exception as e:
            print(f"Gemini squad error: {e}")

        return []

    def _match_player(self, api_player: dict, player_id: str, player_name: str) -> bool:
        if not isinstance(api_player, dict):
            return False
        # ID equality only counts when BOTH ids are non-empty. Otherwise a
        # squad row with player_id="" (cricketdata leaves it blank when the
        # upstream API omits the field) silently matches every scorecard
        # entry whose own id is missing — leaking another player's stats.
        api_id = api_player.get("id")
        if api_id and player_id and api_id == player_id:
            return True
        api_name = (api_player.get("name") or "").lower().strip()
        our_name = (player_name or "").lower().strip()
        if not api_name or not our_name:
            return False
        if api_name == our_name:
            return True
        api_parts = api_name.split()
        our_parts = our_name.split()
        if not api_parts or not our_parts:
            return False
        # Surnames must match.
        if api_parts[-1] != our_parts[-1]:
            return False
        # Surname-only used to be sufficient, but that silently credited
        # one player's stats to another with the same last name (e.g.
        # Mohit Sharma's bowling getting attributed to Ishant Sharma).
        # Require first-name compatibility too: exact match, or one is the
        # initial of the other (handles ESPN's "M Siraj" vs squad's
        # "Mohammed Siraj"). If either side has only the surname (single
        # token), accept — rare but a legitimate truncation pattern.
        if len(api_parts) == 1 or len(our_parts) == 1:
            return True
        api_first = api_parts[0]
        our_first = our_parts[0]
        if api_first == our_first:
            return True
        if api_first[0] == our_first[0]:
            return True
        return False

    def calculate_player_points(self, player_id: str, match_data: dict, weightage: int, player_name: str = "", player_role: str = "", player_team: str = "") -> tuple[int, dict]:
        """Full fantasy scoring for cricket. role/team args are unused (football needs them for clean-sheet)."""
        del player_role, player_team  # cricket doesn't use these
        breakdown: dict = {}
        fantasy_pts = 0

        for innings in match_data.get("scorecard", []):
            for bat in innings.get("batting", []):
                batsman = bat.get("batsman", {})
                if self._match_player(batsman, player_id, player_name):
                    runs = bat.get("r", 0)
                    fours = bat.get("4s", 0)
                    sixes = bat.get("6s", 0)
                    is_out = bat.get("dismissal", "") not in ("", "not out", "batting")

                    batting_pts = runs + fours * 4 + sixes * 6
                    if runs >= 100: batting_pts += 50
                    elif runs >= 50: batting_pts += 25
                    if runs == 0 and is_out: batting_pts -= 5

                    fantasy_pts += batting_pts
                    breakdown["runs"] = runs
                    breakdown["fours"] = fours
                    breakdown["sixes"] = sixes
                    breakdown["batting_points"] = batting_pts

            for bowl in innings.get("bowling", []):
                bowler = bowl.get("bowler", {})
                if self._match_player(bowler, player_id, player_name):
                    wickets = bowl.get("w", 0)
                    maidens = bowl.get("m", 0)
                    bowling_pts = wickets * 25 + maidens * 10
                    if wickets >= 5: bowling_pts += 50
                    elif wickets >= 3: bowling_pts += 25
                    fantasy_pts += bowling_pts
                    breakdown["wickets"] = wickets
                    breakdown["bowling_points"] = bowling_pts

            for bat in innings.get("batting", []):
                catcher = bat.get("fielder", {})
                if self._match_player(catcher, player_id, player_name):
                    dismissal = bat.get("dismissal", "").lower()
                    if "caught" in dismissal:
                        fantasy_pts += 10
                        breakdown["catches"] = breakdown.get("catches", 0) + 1
                    elif "stumped" in dismissal:
                        fantasy_pts += 15
                        breakdown["stumpings"] = breakdown.get("stumpings", 0) + 1
                    elif "run out" in dismissal:
                        fantasy_pts += 10
                        breakdown["run_outs"] = breakdown.get("run_outs", 0) + 1

        breakdown["fantasy_points"] = fantasy_pts
        breakdown["weightage"] = weightage
        total_points = fantasy_pts * weightage
        breakdown["total_points"] = total_points
        return total_points, breakdown

    def normalize_score(self, match_data: dict, room_name: str) -> dict:
        import re
        parts = re.split(r'\s+vs?\s+', room_name, flags=re.IGNORECASE)
        t1 = parts[0].strip() if len(parts) > 0 else "Team 1"
        t2 = parts[1].strip() if len(parts) > 1 else "Team 2"

        score_arr = match_data.get("score", [])
        scorecard = match_data.get("scorecard", [])
        t1_score, t1_overs, t2_score, t2_overs = "—", "—", "—", "—"

        if score_arr:
            # Match scores to teams by inning name, not by index position
            for s in score_arr:
                inning = s.get("inning", "")
                score_str = f"{s.get('r', 0)}/{s.get('w', 0)}"
                overs_str = str(s.get("o", "0"))
                if t1.lower() in inning.lower():
                    t1_score = score_str
                    t1_overs = overs_str
                elif t2.lower() in inning.lower():
                    t2_score = score_str
                    t2_overs = overs_str
                else:
                    # Fallback: assign by position if inning name doesn't match
                    if t1_score == "—":
                        t1_score = score_str
                        t1_overs = overs_str
                    elif t2_score == "—":
                        t2_score = score_str
                        t2_overs = overs_str

        crr = 0
        if score_arr:
            last = score_arr[-1]
            runs = last.get("r", 0)
            overs = float(last.get("o", 0))
            if overs > 0: crr = round(runs / overs, 2)

        current_batting = []
        current_bowling = []
        if scorecard:
            active = scorecard[-1]
            for bat in active.get("batting", []):
                batsman = bat.get("batsman", {})
                name = batsman.get("name", "") if isinstance(batsman, dict) else str(batsman)
                dismissal = bat.get("dismissal", "")
                if not dismissal or dismissal in ("not out", "batting"):
                    current_batting.append({"name": name, "runs": bat.get("r", 0), "balls": bat.get("b", 0), "fours": bat.get("4s", 0), "sixes": bat.get("6s", 0)})
            for bowl in active.get("bowling", []):
                bowler = bowl.get("bowler", {})
                name = bowler.get("name", "") if isinstance(bowler, dict) else str(bowler)
                current_bowling.append({"name": name, "wickets": bowl.get("w", 0), "runs": bowl.get("r", 0), "overs": str(bowl.get("o", 0)), "maidens": bowl.get("m", 0)})

        innings_data = []
        for inn in scorecard:
            batting = [{"name": (b.get("batsman", {}).get("name", "") if isinstance(b.get("batsman"), dict) else str(b.get("batsman", ""))), "runs": b.get("r", 0), "balls": b.get("b", 0), "fours": b.get("4s", 0), "sixes": b.get("6s", 0), "dismissal": b.get("dismissal", ""), "sr": round(b.get("r", 0) / max(b.get("b", 1), 1) * 100, 1)} for b in inn.get("batting", [])]
            bowling = [{"name": (b.get("bowler", {}).get("name", "") if isinstance(b.get("bowler"), dict) else str(b.get("bowler", ""))), "overs": str(b.get("o", 0)), "maidens": b.get("m", 0), "runs": b.get("r", 0), "wickets": b.get("w", 0), "economy": round(b.get("r", 0) / max(float(b.get("o", 1)), 0.1), 1)} for b in inn.get("bowling", [])]
            innings_data.append({"name": inn.get("inning", f"Innings {len(innings_data) + 1}"), "batting": batting, "bowling": bowling})

        status = match_data.get("status", "")

        return {
            "sport": "cricket",
            "match_name": room_name,
            "team1": {"name": t1, "score": t1_score, "overs": t1_overs},
            "team2": {"name": t2, "score": t2_score, "overs": t2_overs},
            "status": status,
            "current_rate": crr,
            "batting_team": "",
            "current_batting": current_batting[:2],
            "current_bowling": current_bowling[:2],
            "innings": innings_data,
        }

    def extract_match_progress(self, match_data: dict) -> dict:
        score_arr = match_data.get("score", [])
        innings = len(score_arr)  # Number of innings completed/in-progress
        current_over = 0.0
        if score_arr:
            current_over = float(score_arr[-1].get("o", 0))
        # Track total overs across innings for edit window calculation
        # Innings 1: overs 0-20, Innings 2: conceptually overs 20-40
        total_overs = 0.0
        for i, s in enumerate(score_arr):
            if i < len(score_arr) - 1:
                total_overs += float(s.get("o", 0))  # completed innings
            else:
                total_overs += float(s.get("o", 0))  # current innings
        return {
            "over": current_over,
            "innings": innings,
            "total_overs": total_overs,
        }

    def is_edit_window(self, current_progress: dict, last_edit_progress: dict) -> bool:
        """
        T20 reshuffle window — fires ONLY once, after over 10 of the
        FIRST innings. The second innings reshuffle and the innings-break
        trigger were intentionally removed: in T20 the innings break is
        already too late to redistribute power meaningfully, and a second
        2nd-innings reshuffle was confusing users without adding value.
        """
        curr_innings = int(current_progress.get("innings", 1) or 1)
        last_innings = int(last_edit_progress.get("innings", 1) or 1)
        curr_over = float(current_progress.get("over", 0) or 0)
        last_over = float(last_edit_progress.get("over", 0) or 0)

        # Only innings 1 qualifies. If the poller saw innings 1 last time
        # and now sees innings 2 (or later), the window is already past —
        # don't retroactively fire.
        if curr_innings != 1 or last_innings != 1:
            return False

        # Fire exactly once on the transition across over 10.
        return last_over < 10 <= curr_over

    def get_edit_trigger(self, current_progress: dict) -> str:
        innings = current_progress.get("innings", 1)
        over = int(float(current_progress.get("over", 0)))
        return f"inn{innings}_over_{over}"

    def format_match_summary(self, match_data: dict, room_name: str) -> dict:
        normalized = self.normalize_score(match_data, room_name)
        return {
            "status": "completed",
            "sport": "cricket",
            "match_name": room_name,
            "result": match_data.get("status", ""),
            "teams": [normalized["team1"], normalized["team2"]],
            "top_batters": [],
            "top_bowlers": [],
        }

    def is_match_finished(self, match_data: dict) -> bool:
        # Never trust Gemini's matchEnded — it always lies
        if match_data.get("source") == "gemini":
            return False
        # CricketData.org returns a real matchEnded flag
        if match_data.get("matchEnded") is True:
            return True
        ms = match_data.get("ms", "")
        if ms == "result":
            return True
        status = match_data.get("status", "").lower()
        return any(w in status for w in ["won", "draw", "tie", "abandoned", "no result"])

    def get_quiz_context(self, match_data: dict, room_name: str) -> dict:
        return {"sport": "cricket", "match_name": room_name}
