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

    # Fetch cricket + football adapters concurrently — football's ESPN
    # discovery alone fans out 52 HTTP calls, so doing this serially with
    # cricket would double the cold-cache latency for no reason.
    import asyncio
    cricket_task = get_adapter("cricket").get_live_matches()
    football_task = get_adapter("football").get_live_matches()
    sport_results = await asyncio.gather(cricket_task, football_task, return_exceptions=True)

    for sport, matches in zip(("cricket", "football"), sport_results):
        try:
            if isinstance(matches, Exception):
                print(f"Error fetching {sport} matches: {matches}")
                continue
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
                            "abbr": m.get("t1_abbr", ""),
                            "score": team1_score,
                        },
                        "team2": {
                            "name": t2_name,
                            "abbr": m.get("t2_abbr", ""),
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
                            "abbr": home.get("abbreviation", ""),
                            "score": str(ft.get("home", "")) if ft.get("home") is not None else "",
                        },
                        "team2": {
                            "name": away.get("name", ""),
                            "abbr": away.get("abbreviation", ""),
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


@router.get("/info/{sport}/{match_id}")
async def get_match_info(sport: str, match_id: str):
    """
    Detailed match info: series, match number, date/time, toss, venue, umpires.
    Used by the room right-panel "Match Info" card.
    Currently supports ESPN cricket events (espn_*).
    """
    if sport != "cricket" or not match_id.startswith("espn_"):
        return {"info": None}

    event_id = match_id.replace("espn_", "")
    info = await _get_espn_match_info(event_id)
    return {"info": info}


async def _get_espn_football_match_info(event_id: str, league_slug: str) -> dict | None:
    """Fetch enriched match metadata for a football match from ESPN's soccer
    summary endpoint. Returns referee, venue (with city + country), match
    round/stage, and league name. Cached 10 minutes.
    """
    import httpx
    from app.services.espn_service import ESPN_FOOTBALL_BASE, HEADERS
    from app.core.redis import redis_get_json, redis_set_json

    if not event_id or not league_slug:
        return None
    cache_key = f"espn:info:football:{event_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{ESPN_FOOTBALL_BASE}/{league_slug}/summary",
                params={"event": event_id},
                headers=HEADERS, timeout=10,
            )
            if res.status_code != 200:
                return None
            data = res.json()
            header = data.get("header") or {}
            comp = (header.get("competitions") or [{}])[0]
            game_info = data.get("gameInfo") or {}
            league = header.get("league") or {}
            season = header.get("season") or {}

            venue_obj = game_info.get("venue") or {}
            addr = venue_obj.get("address") or {}
            venue_name = venue_obj.get("fullName") or ""
            venue_loc = ", ".join([x for x in (addr.get("city"), addr.get("country")) if x])
            venue_full = f"{venue_name}, {venue_loc}" if venue_name and venue_loc else (venue_name or venue_loc)

            officials = game_info.get("officials") or []
            referee = ""
            assistants: list[str] = []
            for o in officials:
                name = o.get("displayName") or o.get("fullName") or ""
                if not name:
                    continue
                pos = ((o.get("position") or {}).get("name") or "").lower()
                if "referee" in pos and "assistant" not in pos and "video" not in pos and "fourth" not in pos:
                    if not referee:
                        referee = name
                elif not pos and not referee:
                    # ESPN sometimes omits position; first official is the head referee.
                    referee = name
                else:
                    assistants.append(name)

            # Round/stage (e.g. "Semifinals", "Group Stage", "Round of 16").
            stage = ""
            notes = comp.get("notes") or []
            if notes:
                first = notes[0] if isinstance(notes, list) else None
                if isinstance(first, dict):
                    leg = first.get("leg")
                    title = first.get("title") or ""
                    stage = f"{title} · Leg {leg}" if leg else title

            league_name = league.get("name", "")
            season_year = season.get("year", "")
            series_label = f"{league_name} {season_year}".strip() if league_name else ""

            info = {
                "sport": "football",
                "match_name": header.get("name", ""),
                "match_short": header.get("shortName", ""),
                "stage": stage,
                "series": series_label,
                "match_date_gmt": comp.get("date", ""),
                "venue": venue_full,
                "referee": referee,
                "assistant_referees": assistants,
            }
            if any(v for v in info.values() if v not in ("", "football", [], None)):
                await redis_set_json(cache_key, info, ex=600)
                return info
    except Exception as e:
        print(f"ESPN football match info error: {e}")
    return None


async def _get_espn_match_info(event_id: str) -> dict | None:
    """Fetch enriched match metadata from ESPN summary endpoint."""
    import httpx
    from app.services.espn_service import ESPN_SUMMARY_URL, HEADERS, CRICKET_LIVE_SERIES
    from app.core.redis import redis_get_json, redis_set_json

    cache_key = f"espn:info:{event_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    for series_id in CRICKET_LIVE_SERIES:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{ESPN_SUMMARY_URL}/{series_id}/summary",
                    params={"event": event_id},
                    headers=HEADERS, timeout=10,
                )
                if res.status_code != 200:
                    continue
                data = res.json()
                header = data.get("header", {})
                comp = (header.get("competitions") or [{}])[0]
                game_info = data.get("gameInfo", {})
                officials = game_info.get("officials", [])

                umpires = []
                tv_umpire = ""
                referee = ""
                reserve_umpire = ""
                for o in officials:
                    pos = (o.get("position", {}).get("name") or "").lower()
                    name = o.get("displayName") or o.get("fullName") or ""
                    if not name:
                        continue
                    if pos == "umpire":
                        umpires.append(name)
                    elif "tv" in pos or "third" in pos:
                        tv_umpire = name
                    elif pos == "referee":
                        referee = name
                    elif "reserve" in pos:
                        reserve_umpire = name

                league = header.get("league", {}) or {}
                season = header.get("season", {}) or {}
                series_name = league.get("name", "")
                season_year = season.get("year", "")
                series_label = f"{series_name} {season_year}".strip() if series_name else ""

                status_obj = comp.get("status", {}) or {}
                toss_text = status_obj.get("summary", "")

                info = {
                    "match_name": header.get("name", ""),
                    "match_short": header.get("shortName", ""),
                    "match_number": comp.get("description", ""),
                    "series": series_label,
                    "match_date_gmt": comp.get("date", ""),
                    "venue": (game_info.get("venue") or {}).get("fullName", ""),
                    "toss": toss_text,
                    "umpires": umpires,
                    "tv_umpire": tv_umpire,
                    "referee": referee,
                    "reserve_umpire": reserve_umpire,
                }
                if any(v for v in info.values()):
                    await redis_set_json(cache_key, info, ex=600)
                    return info
        except Exception as e:
            print(f"ESPN match info error: {e}")

    return None


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
        # ESPN-sourced cricket matches: prefer the adapter so we get the
        # batting/bowling detail from the summary endpoint, not just the
        # scoreboard summary that lacks per-player rows.
        if match_id.startswith("espn_") and sport == "cricket":
            if hasattr(adapter, "set_match_context"):
                adapter.set_match_context(match_name)
            match_data = await adapter.get_match_score(match_id)
            if match_data:
                normalized = adapter.normalize_score(match_data, match_name)
                if normalized and (normalized.get("innings") or normalized.get("team1", {}).get("score")):
                    return {"scorecard": normalized}
            # Fallback: scoreboard-only stub (pre-match / toss done)
            espn_event_id = match_id.replace("espn_", "")
            scorecard = await _get_espn_scorecard(sport, espn_event_id, match_name)
            if scorecard:
                return {"scorecard": scorecard}
            return {"scorecard": None}

        # ESPN-sourced non-cricket matches: stick with the scoreboard stub.
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

    if sport == "football":
        return await _get_espn_football_scorecard(event_id, match_name)

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
                            await redis_set_json(cache_key, scorecard, ex=20)
                        return scorecard
    except Exception as e:
        print(f"ESPN scorecard error: {e}")

    return None


async def _get_espn_football_scorecard(event_id: str, match_name: str) -> dict | None:
    """Build a rich football scorecard from the cached ESPN match list."""
    from app.core.redis import redis_get_json

    matches = await redis_get_json("espn:football:all_live") or []
    target_id = f"espn_{event_id}"
    match = next((m for m in matches if str(m.get("id", "")) == target_id), None)
    if not match:
        if match_name:
            parts = match_name.split(" vs ")
            return {
                "sport": "football",
                "team1": {"name": parts[0].strip() if parts else "", "score": "—"},
                "team2": {"name": parts[1].strip() if len(parts) > 1 else "", "score": "—"},
                "status": "Score data unavailable",
                "innings": [],
            }
        return None

    home_obj = match.get("homeTeam") or {}
    away_obj = match.get("awayTeam") or {}
    home = home_obj.get("name", "")
    away = away_obj.get("name", "")
    home_abbr = home_obj.get("abbreviation", "")
    away_abbr = away_obj.get("abbreviation", "")
    ft = (match.get("score") or {}).get("fullTime", {}) or {}
    is_live = match.get("status") == "IN_PLAY"
    period = match.get("_period", 0) or 0

    venue = match.get("venue", "")
    city = match.get("_venue_city", "")
    venue_full = f"{venue}, {city}" if venue and city else (venue or city)

    return {
        "sport": "football",
        "match_name": match_name or f"{home} vs {away}",
        "team1": {"name": home, "abbr": home_abbr, "score": str(ft.get("home", "")) if is_live else "—"},
        "team2": {"name": away, "abbr": away_abbr, "score": str(ft.get("away", "")) if is_live else "—"},
        "status": match.get("_status_detail", "") or ("Live" if is_live else "Scheduled"),
        "minute": match.get("_minute", 0),
        "half": 2 if period >= 2 else 1,
        "period": period,
        "is_live": is_live,
        "league": (match.get("competition") or {}).get("name", ""),
        "venue": venue_full,
        "venue_country": match.get("_venue_country", ""),
        "kickoff": match.get("utcDate", ""),
        "attendance": match.get("_attendance", 0),
        "broadcasts": match.get("_broadcasts", []),
        "events": match.get("_events", []),
        "stats": {
            "home": match.get("_home_stats", {}),
            "away": match.get("_away_stats", {}),
        },
        "form": {
            "home": match.get("_home_form", ""),
            "away": match.get("_away_form", ""),
        },
        "record": {
            "home": match.get("_home_record", ""),
            "away": match.get("_away_record", ""),
        },
        "innings": [],
    }


def _build_espn_scorecard(event: dict) -> dict | None:
    """Build a normalized scorecard from ESPN event data."""
    competitions = event.get("competitions", [])
    if not competitions:
        return None

    comp = competitions[0]
    competitors = comp.get("competitors", [])
    if len(competitors) < 2:
        return None

    # Extract team data — only use batting linescores (runs > 0 or isBatting)
    import re as _re
    teams = []
    innings_data = []
    for team_data in competitors:
        team_name = team_data.get("team", {}).get("displayName", "Unknown")
        linescores = team_data.get("linescores", [])

        # ESPN raw score e.g. "89/2 (9.1/20 ov, target 241)" or "240/4"
        raw_score = team_data.get("score", "")

        # Collect only batting linescores (skip fielding periods where runs=0)
        batting_parts = []
        team_overs = ""
        for ls in linescores:
            runs = ls.get("runs", ls.get("value", 0))
            wickets = ls.get("wickets", 0)
            overs = ls.get("overs", 0)
            is_batting = ls.get("isBatting", False)

            if runs > 0 or is_batting:
                batting_parts.append({"runs": runs, "wickets": wickets, "overs": overs})
                team_overs = str(overs)

                # Build innings entry
                innings_data.append({
                    "name": f"{team_name} Innings {ls.get('period', 1)}",
                    "batting": [],
                    "bowling": [],
                })

        # Build score string and overs from the most accurate source
        if raw_score:
            # Parse ESPN raw score: "89/2 (9.1/20 ov, target 241)" → score="89/2", overs="9.1"
            score_match = _re.match(r'^([\d/]+)', raw_score)
            team_score = score_match.group(1) if score_match else raw_score
            overs_match = _re.search(r'\(([\d.]+)/', raw_score)
            if overs_match:
                team_overs = overs_match.group(1)
        elif batting_parts:
            parts_str = []
            for bp in batting_parts:
                parts_str.append(f"{bp['runs']}/{bp['wickets']}")
            team_score = " & ".join(parts_str)
        else:
            team_score = ""

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
