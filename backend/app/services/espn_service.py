"""
ESPN Sports API — free, no auth, real-time match statuses.
Used as the TRUTH SOURCE for match status (live/finished/upcoming).
Gemini handles scorecard data, ESPN handles status verification.

Cricket: https://site.web.api.espn.com/apis/site/v2/sports/cricket/{seriesId}/scoreboard
Football: https://site.web.api.espn.com/apis/site/v2/sports/soccer/{leagueSlug}/scoreboard
"""
import httpx
from app.core.redis import redis_get_json, redis_set_json
from typing import Optional
from datetime import date

ESPN_CRICKET_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/cricket"
ESPN_FOOTBALL_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/soccer"

# Cricket series IDs
CRICKET_SERIES = {
    "Indian Premier League": "8048",
    "IPL": "8048",
}

# Football league slugs for ESPN
FOOTBALL_LEAGUES = {
    "Premier League": "eng.1",
    "La Liga": "esp.1",
    "Primera Division": "esp.1",
    "Serie A": "ita.1",
    "Bundesliga": "ger.1",
    "Ligue 1": "fra.1",
    "Eredivisie": "ned.1",
    "Championship": "eng.2",
    "UEFA Champions League": "uefa.champions",
    "Copa Libertadores": "conmebol.libertadores",
    "Campeonato Brasileiro Série A": "bra.1",
    "Primeira Liga": "por.1",
}

HEADERS = {"User-Agent": "Mozilla/5.0"}


async def get_espn_match_status(match_name: str, sport: str, league: str = "") -> Optional[dict]:
    """
    Get match status from ESPN. Returns:
    {
        "state": "pre" | "in" | "post",  # upcoming | live | finished
        "is_live": bool,
        "is_finished": bool,
        "status_text": str,
        "score": [...],
        "match_date": str (ISO),
    }
    """
    if sport == "cricket":
        return await _get_cricket_status(match_name, league)
    elif sport == "football":
        return await _get_football_status(match_name, league)
    return None


async def _get_cricket_status(match_name: str, league: str) -> Optional[dict]:
    """Get cricket match status from ESPN."""
    series_id = None
    for key, sid in CRICKET_SERIES.items():
        if key.lower() in league.lower():
            series_id = sid
            break
    if not series_id:
        series_id = "8048"  # Default to IPL

    cache_key = f"espn:cricket:{series_id}"
    events = await redis_get_json(cache_key)
    if not events:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{ESPN_CRICKET_BASE}/{series_id}/scoreboard",
                    headers=HEADERS, timeout=10,
                )
                if res.status_code == 200:
                    events = res.json().get("events", [])
                    await redis_set_json(cache_key, events, ex=20)
        except Exception as e:
            print(f"ESPN cricket error: {e}")
            return None

    if not events:
        return None

    return _find_match_in_events(events, match_name)


async def _get_football_status(match_name: str, league: str) -> Optional[dict]:
    """Get football match status from ESPN."""
    league_slug = None
    for key, slug in FOOTBALL_LEAGUES.items():
        if key.lower() in league.lower():
            league_slug = slug
            break
    if not league_slug:
        return None

    today = date.today().isoformat().replace("-", "")
    cache_key = f"espn:football:{league_slug}:{today}"
    events = await redis_get_json(cache_key)
    if not events:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{ESPN_FOOTBALL_BASE}/{league_slug}/scoreboard",
                    params={"dates": today},
                    headers=HEADERS, timeout=10,
                )
                if res.status_code == 200:
                    events = res.json().get("events", [])
                    await redis_set_json(cache_key, events, ex=30)
        except Exception as e:
            print(f"ESPN football error: {e}")
            return None

    if not events:
        return None

    return _find_match_in_events(events, match_name)


def _find_match_in_events(events: list, match_name: str) -> Optional[dict]:
    """Find a match in ESPN events by team names."""
    parts = match_name.lower().split(" vs ")
    if len(parts) != 2:
        return None

    team1 = parts[0].strip()
    team2 = parts[1].strip()

    for event in events:
        event_name = event.get("name", "").lower()
        if team1 in event_name and team2 in event_name:
            return _extract_status(event)

        # Also match by competitor names
        for comp in event.get("competitions", []):
            names = [c.get("team", {}).get("displayName", "").lower() for c in comp.get("competitors", [])]
            if any(team1 in n for n in names) and any(team2 in n for n in names):
                return _extract_status(event)

    return None


def _extract_status(event: dict) -> dict:
    """Extract status info from an ESPN event."""
    status_obj = event.get("status", {})
    status_type = status_obj.get("type", {})
    state = status_type.get("state", "pre")  # pre, in, post

    score_arr = []
    for comp in event.get("competitions", []):
        for team_data in comp.get("competitors", []):
            team_name = team_data.get("team", {}).get("displayName", "")
            for ls in team_data.get("linescores", []):
                score_arr.append({
                    "r": ls.get("runs", ls.get("value", 0)),
                    "w": ls.get("wickets", 0),
                    "o": float(ls.get("overs", 0)),
                    "inning": f"{team_name} {ls.get('period', 1)}",
                })

    return {
        "state": state,
        "is_live": state == "in",
        "is_finished": state == "post",
        "status_text": status_type.get("description", ""),
        "summary": status_obj.get("summary", ""),
        "score": score_arr,
        "match_date": event.get("date", ""),
    }


# ── Live matches listing from ESPN ──

# All cricket series to check for live matches
CRICKET_LIVE_SERIES = {
    "8048": "Indian Premier League",
    "8044": "ICC Champions Trophy",
}

# International cricket endpoint (covers Tests, ODIs, T20Is)
ESPN_CRICKET_ALL = "https://site.web.api.espn.com/apis/site/v2/sports/cricket/scoreboard"

# Football leagues to scan for live + upcoming matches (ESPN soccer slugs)
FOOTBALL_LIVE_LEAGUES = {
    "eng.1": "Premier League",
    "esp.1": "La Liga",
    "ita.1": "Serie A",
    "ger.1": "Bundesliga",
    "fra.1": "Ligue 1",
    "uefa.champions": "UEFA Champions League",
    "uefa.europa": "UEFA Europa League",
    "uefa.europa.conf": "UEFA Conference League",
    "ned.1": "Eredivisie",
    "por.1": "Primeira Liga",
    "bra.1": "Brasileirão Série A",
    "conmebol.libertadores": "Copa Libertadores",
    "fifa.world": "FIFA World Cup",
}


async def get_espn_live_cricket_matches() -> list:
    """
    Get all live + upcoming cricket matches from ESPN.
    Free, no auth, real-time data. Returns normalized match list.
    Fetches today + next 3 days for upcoming matches.
    """
    from app.core.redis import redis_get_json, redis_set_json
    from datetime import timedelta

    cache_key = "espn:cricket:all_live"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    all_matches = []
    seen_ids = set()

    # Generate date strings for today + next 3 days
    today = date.today()
    dates_to_fetch = [(today + timedelta(days=d)).strftime("%Y%m%d") for d in range(4)]

    # Fetch from each known series, for each date
    for series_id, series_name in CRICKET_LIVE_SERIES.items():
        for date_str in dates_to_fetch:
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.get(
                        f"{ESPN_CRICKET_BASE}/{series_id}/scoreboard",
                        params={"dates": date_str},
                        headers=HEADERS, timeout=10,
                    )
                    if res.status_code == 200:
                        events = res.json().get("events", [])
                        for event in events:
                            eid = event.get("id", "")
                            if eid in seen_ids:
                                continue
                            seen_ids.add(eid)
                            match = _espn_event_to_match(event, series_name)
                            if match:
                                all_matches.append(match)
            except Exception as e:
                print(f"ESPN cricket series {series_id} date {date_str} error: {e}")

    # Also try the general cricket scoreboard (today only)
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                ESPN_CRICKET_ALL,
                headers=HEADERS, timeout=10,
            )
            if res.status_code == 200:
                events = res.json().get("events", [])
                for event in events:
                    eid = event.get("id", "")
                    if eid in seen_ids:
                        continue
                    seen_ids.add(eid)
                    match = _espn_event_to_match(event, "")
                    if match:
                        all_matches.append(match)
    except Exception as e:
        print(f"ESPN cricket general scoreboard error: {e}")

    if all_matches:
        await redis_set_json(cache_key, all_matches, ex=120)  # Cache 2 min

    return all_matches


def _espn_event_to_match(event: dict, series_name: str) -> dict | None:
    """Convert an ESPN event to our normalized match format."""
    status_obj = event.get("status", {})
    status_type = status_obj.get("type", {})
    state = status_type.get("state", "pre")  # pre, in, post

    # Skip finished matches
    if state == "post":
        return None

    competitions = event.get("competitions", [])
    if not competitions:
        return None

    comp = competitions[0]
    competitors = comp.get("competitors", [])
    if len(competitors) < 2:
        return None

    t1_data = competitors[0]
    t2_data = competitors[1]
    t1_name = t1_data.get("team", {}).get("displayName", "Team 1")
    t2_name = t2_data.get("team", {}).get("displayName", "Team 2")

    # Build scores from linescores — only batting innings (runs > 0 or isBatting)
    t1_score = ""
    t2_score = ""
    for team_data in competitors:
        team_name = team_data.get("team", {}).get("displayName", "")
        linescores = team_data.get("linescores", [])
        if linescores:
            # Use the team's `score` field if available (most accurate)
            raw_score = team_data.get("score", "")
            if raw_score:
                score_str = raw_score
            else:
                parts = []
                for ls in linescores:
                    runs = ls.get("runs", 0)
                    if runs > 0 or ls.get("isBatting", False):
                        wickets = ls.get("wickets", 0)
                        overs = ls.get("overs", 0)
                        parts.append(f"{runs}/{wickets} ({overs} ov)")
                score_str = " & ".join(parts) if parts else ""
            if team_name == t1_name:
                t1_score = score_str
            elif team_name == t2_name:
                t2_score = score_str

    # Determine series/league from event
    league = series_name
    if not league:
        season = event.get("season", {})
        league = season.get("type", {}).get("name", "")
        if not league:
            league = event.get("name", "").split(",")[0] if "," in event.get("name", "") else ""

    match_format = comp.get("format", {}).get("name", "") or ""

    ms = "live" if state == "in" else "upcoming"

    return {
        "id": f"espn_{event.get('id', '')}",
        "name": event.get("name", f"{t1_name} vs {t2_name}"),
        "matchType": match_format.lower() if match_format else "t20",
        "venue": comp.get("venue", {}).get("fullName", ""),
        "dateTimeGMT": event.get("date", ""),
        "teams": [t1_name, t2_name],
        "t1": t1_name,
        "t2": t2_name,
        "series": league,
        "ms": ms,
        "matchStarted": state == "in",
        "matchEnded": False,
        "status": status_obj.get("summary", status_type.get("description", "")),
        "score": [],  # Raw score for compatibility
        "team1_score": t1_score,
        "team2_score": t2_score,
        "source": "espn",
    }


# ── Football discovery from ESPN (free, no auth) ──

async def get_espn_live_football_matches() -> list:
    """
    Get all live + upcoming football matches from ESPN soccer scoreboards.
    Iterates over major leagues for today + next 3 days. Returns matches in
    Football-Data.org-compatible shape so routes/matches.py normalization
    handles them without special casing.
    """
    from app.core.redis import redis_get_json, redis_set_json
    from datetime import timedelta

    cache_key = "espn:football:all_live"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    all_matches = []
    seen_ids = set()

    today = date.today()
    dates_to_fetch = [(today + timedelta(days=d)).strftime("%Y%m%d") for d in range(4)]

    for league_slug, league_name in FOOTBALL_LIVE_LEAGUES.items():
        for date_str in dates_to_fetch:
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.get(
                        f"{ESPN_FOOTBALL_BASE}/{league_slug}/scoreboard",
                        params={"dates": date_str},
                        headers=HEADERS, timeout=10,
                    )
                    if res.status_code != 200:
                        continue
                    events = res.json().get("events", [])
                    for event in events:
                        eid = str(event.get("id", ""))
                        if not eid or eid in seen_ids:
                            continue
                        seen_ids.add(eid)
                        match = _espn_football_event_to_match(event, league_name)
                        if match:
                            all_matches.append(match)
            except Exception as e:
                print(f"ESPN football {league_slug} {date_str} error: {e}")

    if all_matches:
        await redis_set_json(cache_key, all_matches, ex=120)

    return all_matches


def _espn_football_event_to_match(event: dict, league_name: str) -> dict | None:
    """Convert ESPN soccer event → Football-Data.org-compatible shape with extras."""
    status_obj = event.get("status", {})
    status_type = status_obj.get("type", {})
    state = status_type.get("state", "pre")  # pre | in | post

    if state == "in":
        fd_status = "IN_PLAY"
    elif state == "pre":
        fd_status = "SCHEDULED"
    else:
        return None  # skip finished

    competitions = event.get("competitions", [])
    if not competitions:
        return None
    comp = competitions[0]
    competitors = comp.get("competitors", [])
    if len(competitors) < 2:
        return None

    home_data = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
    away_data = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

    home_team = home_data.get("team", {})
    away_team = away_data.get("team", {})
    home_name = home_team.get("displayName", "") or home_team.get("name", "")
    away_name = away_team.get("displayName", "") or away_team.get("name", "")
    home_id = str(home_team.get("id", "") or home_data.get("id", ""))
    away_id = str(away_team.get("id", "") or away_data.get("id", ""))

    def _to_int(v):
        try:
            return int(v) if v not in (None, "") else 0
        except (ValueError, TypeError):
            return 0

    def _stats_dict(c) -> dict:
        return {s.get("name", ""): s.get("displayValue", "") for s in c.get("statistics", [])}

    def _record(c) -> str:
        recs = c.get("records") or []
        return recs[0].get("summary", "") if recs else ""

    # Key events (goals, cards, etc.) from competition.details
    key_events = []
    for det in comp.get("details", []):
        clock_disp = (det.get("clock") or {}).get("displayValue", "")
        try:
            minute = int(clock_disp.rstrip("'+"))
        except (ValueError, AttributeError):
            minute = 0
        athletes = det.get("athletesInvolved") or []
        player = athletes[0].get("displayName", "").strip() if athletes else ""
        team_id = str((det.get("team") or {}).get("id", ""))
        side = "home" if team_id == home_id else "away" if team_id == away_id else ""
        key_events.append({
            "minute": minute,
            "type": (det.get("type") or {}).get("text", ""),
            "team": side,
            "player": player,
            "is_goal": bool(det.get("scoringPlay")),
            "is_yellow": bool(det.get("yellowCard")),
            "is_red": bool(det.get("redCard")),
            "is_own_goal": bool(det.get("ownGoal")),
            "is_penalty": bool(det.get("penaltyKick")),
        })
    key_events.sort(key=lambda e: e["minute"])

    venue_obj = comp.get("venue") or event.get("venue") or {}
    venue_addr = venue_obj.get("address") or {}

    broadcasts = []
    for b in comp.get("broadcasts") or []:
        broadcasts.extend(b.get("names") or [])

    # Status detail like "50'" or "Half Time" or "FT"
    status_detail = status_type.get("detail") or status_type.get("description") or ""
    clock_str = status_obj.get("displayClock", "")
    minute_val = 0
    if clock_str:
        try:
            minute_val = int(clock_str.rstrip("'+"))
        except (ValueError, AttributeError):
            minute_val = 0

    return {
        "id": f"espn_{event.get('id', '')}",
        "homeTeam": {"name": home_name},
        "awayTeam": {"name": away_name},
        "score": {
            "fullTime": {
                "home": _to_int(home_data.get("score")),
                "away": _to_int(away_data.get("score")),
            },
        },
        "status": fd_status,
        "competition": {"name": league_name},
        "utcDate": event.get("date", ""),
        "venue": venue_obj.get("fullName", ""),
        "source": "espn",
        # Rich fields consumed by the scorecard endpoint
        "_status_detail": status_detail,
        "_minute": minute_val,
        "_period": status_obj.get("period", 0),
        "_attendance": comp.get("attendance", 0),
        "_broadcasts": broadcasts,
        "_venue_city": venue_addr.get("city", ""),
        "_venue_country": venue_addr.get("country", ""),
        "_events": key_events,
        "_home_stats": _stats_dict(home_data),
        "_away_stats": _stats_dict(away_data),
        "_home_form": home_data.get("form", "") or "",
        "_away_form": away_data.get("form", "") or "",
        "_home_record": _record(home_data),
        "_away_record": _record(away_data),
    }


# ── Squad/Player fetching from ESPN ──

ESPN_SUMMARY_URL = "https://site.web.api.espn.com/apis/site/v2/sports/cricket"


async def get_espn_match_players(event_id: str, series_id: str = "8048") -> list | None:
    """
    Get full squad for both teams from ESPN summary endpoint.
    Returns normalized player list compatible with MatchSquad model.
    """
    from app.core.redis import redis_get_json, redis_set_json

    cache_key = f"espn:squad:{event_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{ESPN_SUMMARY_URL}/{series_id}/summary",
                params={"event": event_id},
                headers=HEADERS, timeout=15,
            )
            if res.status_code != 200:
                print(f"ESPN summary error: {res.status_code}")
                return None

            data = res.json()
            squads = data.get("squads", [])
            if not squads:
                return None

            players = []
            for squad in squads:
                team_name = squad.get("team", {}).get("displayName", "Unknown")
                athletes = squad.get("athletes", [])
                for athlete in athletes:
                    position = athlete.get("position", {})
                    pos_abbr = position.get("abbreviation", "")
                    pos_name = position.get("name", "")

                    # Map ESPN position to our role format
                    role = _map_espn_position(pos_abbr, pos_name)

                    players.append({
                        "player_id": str(athlete.get("id", "")),
                        "player_name": athlete.get("displayName", athlete.get("name", "")),
                        "team": team_name,
                        "role": role,
                    })

            if players:
                await redis_set_json(cache_key, players, ex=3600)  # Cache 1 hour
                return players

    except Exception as e:
        print(f"ESPN squad fetch error: {e}")

    return None


def _map_espn_position(abbr: str, name: str) -> str:
    """Map ESPN cricket position to our role format."""
    abbr = abbr.upper()
    name = name.lower()

    if "keeper" in name or abbr in ("WBT", "WK"):
        return "wicket-keeper"
    if "all" in name or "allrounder" in name or abbr in ("AR", "BAR", "ALAR"):
        return "all-rounder"
    if "bowl" in name or abbr in ("RFB", "RMB", "RSB", "LFB", "LMB", "LSB", "SLA", "SLW", "LB", "OB", "LFM", "RFM", "BOW"):
        return "bowler"
    if "bat" in name or abbr in ("TBT", "MBT", "LBT", "OPN", "BAT"):
        return "batsman"

    return "batsman"  # default


async def get_espn_match_detail(match_name: str, series_id: str = "8048") -> Optional[dict]:
    """
    Get match data: FRESH scores from scoreboard + batting detail from summary.
    Always fetches scoreboard live (no cache) for accurate scores.
    """
    from app.core.redis import redis_get_json, redis_set_json
    import re

    parts = re.split(r'\s+vs?\s+', match_name.lower())
    if len(parts) != 2:
        return None

    # Always fetch FRESH scoreboard for live scores (bypass cache)
    event = None
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{ESPN_CRICKET_BASE}/{series_id}/scoreboard",
                headers=HEADERS, timeout=10,
            )
            if res.status_code == 200:
                events = res.json().get("events", [])
                for ev in events:
                    ev_name = ev.get("name", "").lower()
                    if parts[0].strip() in ev_name and parts[1].strip() in ev_name:
                        event = ev
                        break
                    for comp in ev.get("competitions", []):
                        names = [c.get("team", {}).get("displayName", "").lower() for c in comp.get("competitors", [])]
                        if any(parts[0].strip() in n for n in names) and any(parts[1].strip() in n for n in names):
                            event = ev
                            break
    except Exception as e:
        print(f"ESPN scoreboard fetch error: {e}")

    if not event:
        return None

    event_id = event.get("id", "")
    comp = event.get("competitions", [{}])[0]
    competitors = comp.get("competitors", [])

    # Build FRESH score array from scoreboard
    # ESPN has multiple linescores per team (one per innings period)
    # We collect ALL batting innings across both teams, sorted by period
    score_arr = []
    all_innings = []
    for team_data in competitors:
        team_name = team_data.get("team", {}).get("displayName", "")
        for ls in team_data.get("linescores", []):
            runs = ls.get("runs", 0)
            is_batting = ls.get("isBatting", False)
            # Include if team actually batted here (runs > 0 or currently batting)
            if runs > 0 or is_batting:
                all_innings.append({
                    "r": runs,
                    "w": ls.get("wickets", 0),
                    "o": float(ls.get("overs", 0)),
                    "inning": f"{team_name} Inning {ls.get('period', 1)}",
                    "period": ls.get("period", 1),
                })

    # Sort by period so innings 1 comes first
    all_innings.sort(key=lambda x: x["period"])
    for inn in all_innings:
        score_arr.append({"r": inn["r"], "w": inn["w"], "o": inn["o"], "inning": inn["inning"]})

    status_obj = event.get("status", {})
    status_type = status_obj.get("type", {})
    status_text = status_type.get("shortDetail", status_type.get("detail", ""))
    match_ended = status_type.get("state", "") == "post"

    # Now fetch summary for batting/bowling detail (can use short cache)
    scorecard = []
    detail_cache = f"espn:detail:{event_id}"
    cached_detail = await redis_get_json(detail_cache)

    if not cached_detail:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{ESPN_SUMMARY_URL}/{series_id}/summary",
                    params={"event": event_id},
                    headers=HEADERS, timeout=15,
                )
                if res.status_code == 200:
                    data = res.json()
                    rosters = data.get("rosters", [])

                    for roster in rosters:
                        team_name = roster.get("team", {}).get("displayName", "")
                        players = roster.get("roster", [])
                        batting = []

                        for player in players:
                            athlete = player.get("athlete", {})
                            pid = str(athlete.get("id", ""))
                            pname = athlete.get("displayName", "")
                            player_ls = player.get("linescores", [])
                            if not player_ls:
                                continue

                            # Use ALL periods' stats (combine innings)
                            # Each period has its own statistics
                            total_stat_map = {}
                            bat_data = {}
                            for pls in player_ls:
                                pls_stats = pls.get("statistics", {})
                                pls_bat = pls_stats.get("batting", {})
                                pls_cats = pls_stats.get("categories", [])
                                if pls_cats:
                                    for stat in pls_cats[0].get("stats", []):
                                        sname = stat.get("name", "")
                                        sval = stat.get("value", 0)
                                        # Sum numeric stats across periods
                                        if sname in ("runs", "ballsFaced", "fours", "sixes", "batted", "outs"):
                                            total_stat_map[sname] = total_stat_map.get(sname, 0) + (sval if isinstance(sval, (int, float)) else 0)
                                        else:
                                            total_stat_map[sname] = sval
                                # Use the latest period's batting data for active/dismissal
                                if pls_bat.get("active", False) or pls_bat.get("outDetails"):
                                    bat_data = pls_bat

                            stat_map = total_stat_map

                            batted = stat_map.get("batted", 0)
                            if batted and batted > 0:
                                outs = stat_map.get("outs", 0)
                                dismissal_text = "not out"
                                out_details = bat_data.get("outDetails", {})
                                if outs and outs > 0 and out_details:
                                    dismissal_text = out_details.get("shortText", "out")
                                if bat_data.get("active", False):
                                    dismissal_text = "batting"

                                batting.append({
                                    "batsman": {"id": pid, "name": pname},
                                    "r": int(stat_map.get("runs", 0)),
                                    "b": int(stat_map.get("ballsFaced", 0)),
                                    "4s": int(stat_map.get("fours", 0)),
                                    "6s": int(stat_map.get("sixes", 0)),
                                    "dismissal": dismissal_text,
                                })

                        batting.sort(key=lambda b: next(
                            (p.get("linescores", [{}])[0].get("statistics", {}).get("batting", {}).get("order", 99)
                             for p in players if str(p.get("athlete", {}).get("id", "")) == b["batsman"]["id"]),
                            99
                        ))

                        if batting:
                            scorecard.append({"inning": f"{team_name} Inning 1", "batting": batting, "bowling": []})

                    # Fill bowling for each inning from the OTHER team's roster
                    # (period 0 of the fielding side corresponds to inning 1 of the batting side)
                    for inning in scorecard:
                        bat_team = inning["inning"].replace(" Inning 1", "").strip()
                        other_roster = next(
                            (r for r in rosters if r.get("team", {}).get("displayName", "") != bat_team),
                            None,
                        )
                        if not other_roster:
                            continue
                        bowlers = []
                        for p in other_roster.get("roster", []):
                            athlete = p.get("athlete", {})
                            pid = str(athlete.get("id", ""))
                            pname = athlete.get("displayName", "")
                            for pls in p.get("linescores", []):
                                cats = pls.get("statistics", {}).get("categories", [])
                                if not cats:
                                    continue
                                stat_map = {s.get("name"): s.get("value") for s in cats[0].get("stats", [])}
                                balls = stat_map.get("balls", 0) or 0
                                if balls and balls > 0:
                                    bowlers.append({
                                        "bowler": {"id": pid, "name": pname},
                                        "o": stat_map.get("overs", 0) or 0,
                                        "m": int(stat_map.get("maidens", 0) or 0),
                                        "r": int(stat_map.get("conceded", 0) or 0),
                                        "w": int(stat_map.get("wickets", 0) or 0),
                                        "econ": stat_map.get("economyRate", 0) or 0,
                                        "_pos": stat_map.get("bowlingPosition", 99) or 99,
                                    })
                                    break  # only first bowled period (inning 1)
                        bowlers.sort(key=lambda b: b["_pos"])
                        for b in bowlers:
                            b.pop("_pos", None)
                        inning["bowling"] = bowlers

                    await redis_set_json(detail_cache, scorecard, ex=20)
        except Exception as e:
            print(f"ESPN summary error: {e}")
    else:
        scorecard = cached_detail

    result = {
        "score": score_arr,  # Always fresh from scoreboard
        "scorecard": scorecard,
        "status": status_text,
        "matchEnded": match_ended,
        "matchStarted": True,
        "source": "espn",
    }

    return result


# Legacy function for backward compatibility
async def fetch_espn_match_by_name(match_name: str, series_id: str = "8048") -> Optional[dict]:
    """Find a specific cricket match by team names."""
    result = await _get_cricket_status(match_name, "IPL")
    if not result:
        return None
    return {
        "score": result.get("score", []),
        "status": result.get("status_text", ""),
        "matchEnded": result.get("is_finished", False),
        "matchStarted": result.get("is_live", False) or result.get("is_finished", False),
        "source": "espn",
    }
