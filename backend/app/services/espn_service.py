"""
ESPN Cricket API — free, no auth, real-time live scores.
URL: https://site.web.api.espn.com/apis/site/v2/sports/cricket/{seriesId}/scoreboard
IPL 2026 series ID: 8048
"""
import httpx
from app.core.redis import redis_get_json, redis_set_json
from typing import Optional

ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/cricket"

# Known ESPN series IDs
SERIES_IDS = {
    "Indian Premier League": "8048",
    "IPL": "8048",
}


async def fetch_espn_live_scores(series_id: str = "8048") -> list[dict]:
    """Fetch all live/recent matches for a series from ESPN."""
    cache_key = f"espn:scoreboard:{series_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{ESPN_BASE}/{series_id}/scoreboard",
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
            if res.status_code != 200:
                return []
            data = res.json()
            events = data.get("events", [])
            await redis_set_json(cache_key, events, ex=15)  # 15 second cache
            return events
    except Exception as e:
        print(f"ESPN API error: {e}")
        return []


async def fetch_espn_match_by_name(match_name: str, series_id: str = "8048") -> Optional[dict]:
    """Find a specific match by team names from ESPN scoreboard."""
    events = await fetch_espn_live_scores(series_id)

    parts = match_name.lower().split(" vs ")
    if len(parts) != 2:
        return None

    team1 = parts[0].strip()
    team2 = parts[1].strip()

    for event in events:
        event_name = event.get("name", "").lower()
        # Match by both team names being present
        if team1 in event_name and team2 in event_name:
            return _normalize_espn_event(event)

        # Also try short names
        for comp in event.get("competitions", []):
            competitors = comp.get("competitors", [])
            names = [c.get("team", {}).get("displayName", "").lower() for c in competitors]
            if any(team1 in n for n in names) and any(team2 in n for n in names):
                return _normalize_espn_event(event)

    return None


def _normalize_espn_event(event: dict) -> dict:
    """Convert ESPN event to our standard score format."""
    status_obj = event.get("status", {})
    status_type = status_obj.get("type", {})
    status_text = status_type.get("description", "")
    is_live = status_type.get("state", "") == "in"
    is_finished = status_type.get("state", "") == "post"

    competitions = event.get("competitions", [])
    if not competitions:
        return {}

    comp = competitions[0]
    competitors = comp.get("competitors", [])

    score_arr = []
    teams = []
    for team_data in competitors:
        team_name = team_data.get("team", {}).get("displayName", "")
        score_text = team_data.get("score", "")
        teams.append(team_name)

        for ls in team_data.get("linescores", []):
            runs = ls.get("runs", 0)
            wickets = ls.get("wickets", 0)
            overs = float(ls.get("overs", 0))
            inning_desc = ls.get("description", "")
            score_arr.append({
                "r": runs,
                "w": wickets,
                "o": overs,
                "inning": f"{team_name} Inning {ls.get('period', 1)}",
            })

    return {
        "score": score_arr,
        "status": status_text if not is_finished else status_obj.get("summary", status_text),
        "matchEnded": is_finished,
        "matchStarted": is_live or is_finished,
        "espn_id": event.get("id", ""),
        "source": "espn",
    }
