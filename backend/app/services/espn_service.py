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
