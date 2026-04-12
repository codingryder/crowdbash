"""
Public endpoints for live match data — separate from rooms.
These return raw match data from sport APIs, not admin-created rooms.
"""
from fastapi import APIRouter, HTTPException, Query
from app.services.sport_service import get_adapter

router = APIRouter()


@router.get("/live")
async def get_live_matches():
    """
    Get all live + upcoming matches. Cached 60s for fast loading.
    """
    from app.core.redis import redis_get_json, redis_set_json

    # Serve from cache for fast page loads
    cache_key = "matches:live:all"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    all_live = []
    all_upcoming = []

    for sport in ("cricket", "football"):
        try:
            adapter = get_adapter(sport)
            matches = await adapter.get_live_matches()
            if not matches:
                continue

            for m in matches:
                if sport == "cricket":
                    ms = m.get("ms", "")
                    # Skip finished matches
                    if ms == "result":
                        continue

                    score_list = m.get("score", [])

                    # Build score strings — ESPN provides team1_score/team2_score directly
                    t1_name = m.get("t1", "")
                    t2_name = m.get("t2", "")
                    team1_score = m.get("team1_score", "")
                    team2_score = m.get("team2_score", "")

                    # CricketData uses score array instead
                    if not team1_score and not team2_score and score_list:
                        for s in score_list:
                            inning = s.get("inning", "")
                            score_str = f"{s.get('r', 0)}/{s.get('w', 0)} ({s.get('o', 0)} ov)"
                            if t1_name and t1_name.lower() in inning.lower():
                                team1_score = score_str
                            elif t2_name and t2_name.lower() in inning.lower():
                                team2_score = score_str
                            else:
                                if not team1_score:
                                    team1_score = score_str
                                elif not team2_score:
                                    team2_score = score_str

                    match_name = m.get("name", f"{t1_name} vs {t2_name}")
                    match_format = m.get("matchType", "")
                    # ESPN provides series name, CricketData has series_id
                    league_label = m.get("series", "") or (match_format.upper() if match_format else "")

                    entry = {
                        "match_id": m.get("id", ""),
                        "match_name": match_name,
                        "sport": "cricket",
                        "league": league_label,
                        "match_format": match_format,
                        "venue": m.get("venue", ""),
                        "match_date": m.get("dateTimeGMT", ""),
                        "status": ms,
                        "team1": {
                            "name": t1_name,
                            "score": team1_score,
                        },
                        "team2": {
                            "name": t2_name,
                            "score": team2_score,
                        },
                        "match_status_text": m.get("status", ""),
                    }

                    if ms == "live":
                        all_live.append(entry)
                    elif ms == "upcoming":
                        all_upcoming.append(entry)

                elif sport == "football":
                    home = m.get("homeTeam", {})
                    away = m.get("awayTeam", {})
                    competition = m.get("competition", {})
                    status_raw = m.get("status", "")
                    score_obj = m.get("score", {})
                    ft = score_obj.get("fullTime", {}) if score_obj else {}

                    if status_raw in ("IN_PLAY", "PAUSED"):
                        status = "live"
                    elif status_raw in ("SCHEDULED", "TIMED"):
                        status = "upcoming"
                    else:
                        continue  # skip finished

                    entry = {
                        "match_id": str(m.get("id", "")),
                        "match_name": f"{home.get('name', '')} vs {away.get('name', '')}",
                        "sport": "football",
                        "league": competition.get("name", ""),
                        "match_format": competition.get("name", ""),
                        "venue": m.get("venue", ""),
                        "match_date": m.get("utcDate", ""),
                        "status": status,
                        "team1": {
                            "name": home.get("name", ""),
                            "score": str(ft.get("home", "")) if ft.get("home") is not None else "",
                        },
                        "team2": {
                            "name": away.get("name", ""),
                            "score": str(ft.get("away", "")) if ft.get("away") is not None else "",
                        },
                        "match_status_text": status_raw,
                    }

                    if status == "live":
                        all_live.append(entry)
                    elif status == "upcoming":
                        all_upcoming.append(entry)

        except Exception as e:
            print(f"Error fetching {sport} matches: {e}")

    result = {
        "live": all_live,
        "upcoming": all_upcoming,
    }

    # Cache for 60s — fast page loads, refreshed by next request
    await redis_set_json(cache_key, result, ex=60)
    return result


@router.get("/debug/cricket")
async def debug_cricket():
    """Debug endpoint to check why cricket data is missing."""
    from app.core.config import settings
    from app.core.redis import redis_get_json, redis_get

    result = {
        "cricketdata_api_key_set": bool(settings.CRICKETDATA_API_KEY),
        "gemini_api_key_set": bool(settings.GEMINI_API_KEY),
    }

    # Check rate limit
    count = await redis_get("cricketdata:daily_requests")
    result["cricketdata_daily_requests"] = int(count) if count else 0
    result["cricketdata_daily_limit"] = 90

    # Check caches
    cached_matches = await redis_get_json("cricket:live_matches")
    result["cricket_live_matches_cached"] = cached_matches is not None
    result["cricket_live_matches_count"] = len(cached_matches) if cached_matches else 0

    cached_cd = await redis_get_json("cricketdata:current_matches")
    result["cricketdata_current_matches_cached"] = cached_cd is not None
    result["cricketdata_current_matches_count"] = len(cached_cd) if cached_cd else 0

    cached_gemini = await redis_get_json("gemini:live_matches:cricket")
    result["gemini_live_matches_cached"] = cached_gemini is not None
    result["gemini_live_matches_count"] = len(cached_gemini) if cached_gemini else 0

    # Try CricketData directly
    try:
        from app.services.cricketdata_service import get_current_matches
        cd_data = await get_current_matches()
        result["cricketdata_direct_result"] = len(cd_data) if cd_data else 0
        result["cricketdata_direct_error"] = None
    except Exception as e:
        result["cricketdata_direct_result"] = 0
        result["cricketdata_direct_error"] = str(e)

    # Try Gemini directly (bypass cache)
    try:
        from app.services.live_score_service import _ask_gemini
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        prompt = f"""Right now it is {now}. List ALL cricket matches that are currently LIVE or scheduled for today.
Include: IPL 2026, international matches, and major T20 leagues.
Return ONLY valid JSON array:
[{{"id": "1", "name": "Team A vs Team B", "matchType": "t20", "t1": "Team A", "t2": "Team B", "series": "IPL 2026", "ms": "live", "status": "Team A 150/3", "score": [], "dateTimeGMT": "2026-04-11T14:00:00Z", "matchStarted": true, "matchEnded": false}}]
If no matches, return []"""
        raw = await _ask_gemini(prompt, grounded=True)
        result["gemini_raw_type"] = type(raw).__name__ if raw else "None"
        result["gemini_raw_is_list"] = isinstance(raw, list)
        result["gemini_raw_count"] = len(raw) if isinstance(raw, list) else 0
        result["gemini_raw_sample"] = raw[:2] if isinstance(raw, list) and raw else raw
        result["gemini_raw_error"] = None
    except Exception as e:
        result["gemini_raw_error"] = str(e)

    return result


@router.get("/scorecard/{sport}/{match_id}")
async def get_match_scorecard(
    sport: str,
    match_id: str,
    match_name: str = Query("", description="Match name for Gemini fallback"),
):
    """
    Get scorecard for a match by sport and match_id directly.
    Used by the Live Matches list (not tied to a room).
    Handles ESPN IDs (espn_*), CricketData IDs, and Football-Data IDs.
    """
    try:
        adapter = get_adapter(sport)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown sport: {sport}")

    try:
        # ESPN-sourced matches: fetch scorecard from ESPN
        if match_id.startswith("espn_"):
            espn_event_id = match_id.replace("espn_", "")
            scorecard = await _get_espn_scorecard(sport, espn_event_id, match_name)
            if scorecard:
                return {"scorecard": scorecard}
            return {"scorecard": None}

        # Standard match IDs: use sport adapter
        if hasattr(adapter, "set_match_context"):
            adapter.set_match_context(match_name)
        match_data = await adapter.get_match_score(match_id)
        if not match_data:
            # For football, return basic score from the match listing data
            if sport == "football" and match_name:
                parts = match_name.split(" vs ")
                return {"scorecard": {
                    "sport": "football",
                    "team1": {"name": parts[0].strip() if parts else "", "score": "—"},
                    "team2": {"name": parts[1].strip() if len(parts) > 1 else "", "score": "—"},
                    "status": "Score data unavailable",
                    "innings": [],
                }}
            return {"scorecard": None}
        normalized = adapter.normalize_score(match_data, match_name)
        # Ensure football data has team1/team2 keys for modal compatibility
        if sport == "football" and "home" in normalized:
            normalized["team1"] = {"name": normalized["home"]["name"], "score": str(normalized["home"].get("goals", "—"))}
            normalized["team2"] = {"name": normalized["away"]["name"], "score": str(normalized["away"].get("goals", "—"))}
        return {"scorecard": normalized}
    except Exception as e:
        return {"scorecard": None, "error": str(e)}


async def _get_espn_scorecard(sport: str, event_id: str, match_name: str) -> dict | None:
    """Fetch scorecard data from ESPN for a specific event."""
    import httpx

    if sport != "cricket":
        return None

    # Try fetching from ESPN IPL scoreboard and find the event
    try:
        from app.services.espn_service import ESPN_CRICKET_BASE, HEADERS, CRICKET_LIVE_SERIES
        from app.core.redis import redis_get_json, redis_set_json

        cache_key = f"espn:scorecard:{event_id}"
        cached = await redis_get_json(cache_key)
        if cached:
            return cached

        # Check each series for this event
        for series_id in CRICKET_LIVE_SERIES:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{ESPN_CRICKET_BASE}/{series_id}/scoreboard",
                    headers=HEADERS, timeout=10,
                )
                if res.status_code != 200:
                    continue

                events = res.json().get("events", [])
                for event in events:
                    if str(event.get("id", "")) == event_id:
                        scorecard = _build_espn_scorecard(event)
                        if scorecard:
                            await redis_set_json(cache_key, scorecard, ex=60)
                        return scorecard
    except Exception as e:
        print(f"ESPN scorecard error: {e}")

    return None


def _build_espn_scorecard(event: dict) -> dict | None:
    """Build a normalized scorecard from ESPN event data."""
    competitions = event.get("competitions", [])
    if not competitions:
        return None

    comp = competitions[0]
    competitors = comp.get("competitors", [])
    if len(competitors) < 2:
        return None

    # Extract team data
    teams = []
    innings_data = []
    for team_data in competitors:
        team_name = team_data.get("team", {}).get("displayName", "Unknown")
        linescores = team_data.get("linescores", [])

        team_score = ""
        team_overs = ""
        for ls in linescores:
            runs = ls.get("runs", ls.get("value", 0))
            wickets = ls.get("wickets", 0)
            overs = ls.get("overs", 0)
            team_score = str(runs) if not team_score else team_score
            team_overs = str(overs) if not team_overs else team_overs

            # Build innings entry (ESPN doesn't have ball-by-ball, just summary)
            innings_data.append({
                "name": f"{team_name} Innings {ls.get('period', 1)}",
                "batting": [],
                "bowling": [],
            })

        teams.append({
            "name": team_name,
            "score": team_score,
            "overs": team_overs,
        })

    status_obj = event.get("status", {})
    status_text = status_obj.get("summary", status_obj.get("type", {}).get("description", ""))

    return {
        "sport": "cricket",
        "match_name": event.get("name", ""),
        "team1": teams[0] if len(teams) > 0 else {"name": "", "score": "", "overs": ""},
        "team2": teams[1] if len(teams) > 1 else {"name": "", "score": "", "overs": ""},
        "status": status_text,
        "current_rate": 0,
        "batting_team": "",
        "current_batting": [],
        "current_bowling": [],
        "innings": innings_data if innings_data else [],
    }
