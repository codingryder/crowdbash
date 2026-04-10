"""
CricketData.org API Service — Primary cricket data source.
Plan S: 100 requests/day. Aggressive caching to stay under limit.

API docs: https://cricketdata.org/
Endpoints used:
  - /v1/currentMatches — live + recent matches
  - /v1/match_scorecard — full scorecard for a match
"""
import httpx
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json, redis_incr, redis_get
from typing import List, Dict, Any, Optional

BASE_URL = "https://api.cricketdata.org/v1"
DAILY_LIMIT = 90  # Buffer of 10 under the 100/day Plan S limit


async def _check_rate_limit() -> bool:
    """Return True if we can make another API call today."""
    count = await redis_get("cricketdata:daily_requests")
    if count and int(count) >= DAILY_LIMIT:
        return False
    return True


async def _increment_counter():
    """Increment daily request counter with 24h TTL."""
    await redis_incr("cricketdata:daily_requests")
    # Set TTL only if it's a new key (first request of the day)
    # redis_incr doesn't set TTL, so we re-set with expiry via a helper
    # For simplicity, just set it every time — Upstash handles idempotent TTL
    from app.core.redis import redis_set
    count = await redis_get("cricketdata:daily_requests")
    if count:
        await redis_set("cricketdata:daily_requests", count, ex=86400)


async def get_current_matches() -> Optional[List[Dict[str, Any]]]:
    """
    Get current/recent cricket matches.
    Returns normalized list of matches.
    """
    if not settings.CRICKETDATA_API_KEY:
        return None

    cache_key = "cricketdata:current_matches"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    if not await _check_rate_limit():
        print("CricketData: daily rate limit reached")
        return None

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{BASE_URL}/currentMatches",
                params={"apikey": settings.CRICKETDATA_API_KEY, "offset": 0},
                timeout=15,
            )
            await _increment_counter()

            if res.status_code != 200:
                print(f"CricketData currentMatches error: {res.status_code}")
                return None

            data = res.json()
            matches = data.get("data", [])
            if not matches:
                return None

            normalized = []
            for m in matches:
                normalized.append({
                    "id": m.get("id", ""),
                    "name": m.get("name", ""),
                    "status": m.get("status", ""),
                    "matchType": m.get("matchType", ""),
                    "venue": m.get("venue", ""),
                    "date": m.get("date", ""),
                    "dateTimeGMT": m.get("dateTimeGMT", ""),
                    "teams": m.get("teams", []),
                    "teamInfo": m.get("teamInfo", []),
                    "series_id": m.get("series_id", ""),
                    "matchStarted": m.get("matchStarted", False),
                    "matchEnded": m.get("matchEnded", False),
                    # Extract team names
                    "t1": m.get("teams", ["", ""])[0] if len(m.get("teams", [])) > 0 else "",
                    "t2": m.get("teams", ["", ""])[1] if len(m.get("teams", [])) > 1 else "",
                    "series": m.get("series_id", ""),
                    "ms": "live" if m.get("matchStarted") and not m.get("matchEnded") else (
                        "result" if m.get("matchEnded") else "upcoming"
                    ),
                    # Raw score array from API
                    "score": m.get("score", []),
                })

            await redis_set_json(cache_key, normalized, ex=300)
            return normalized

    except Exception as e:
        print(f"CricketData currentMatches exception: {e}")
        return None


async def get_match_scorecard(match_id: str) -> Optional[Dict[str, Any]]:
    """
    Get full scorecard for a match. Returns data in the shape
    that CricketAdapter.calculate_player_points() expects.

    Returns: {
        score: [{r, w, o, inning}],
        scorecard: [{inning, batting: [...], bowling: [...]}],
        status: str,
        matchEnded: bool,
        source: "cricketdata"
    }
    """
    if not settings.CRICKETDATA_API_KEY:
        return None

    cache_key = f"cricketdata:scorecard:{match_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    if not await _check_rate_limit():
        print("CricketData: daily rate limit reached")
        return None

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{BASE_URL}/match_scorecard",
                params={"apikey": settings.CRICKETDATA_API_KEY, "id": match_id},
                timeout=15,
            )
            await _increment_counter()

            if res.status_code != 200:
                print(f"CricketData scorecard error: {res.status_code}")
                return None

            data = res.json().get("data", {})
            if not data:
                return None

            return _normalize_scorecard(data)

    except Exception as e:
        print(f"CricketData scorecard exception: {e}")
        return None


def _normalize_scorecard(data: dict) -> Optional[dict]:
    """
    Normalize CricketData.org scorecard response into the shape
    CricketAdapter expects.

    CricketData format:
    {
        "id": "...",
        "name": "Team A vs Team B",
        "matchType": "t20",
        "status": "Team A won by 5 wickets",
        "venue": "...",
        "score": [
            {"r": 180, "w": 5, "o": 20, "inning": "Team A Inning 1"},
            ...
        ],
        "scorecard": [
            {
                "batting": [
                    {"batsman": {"id": 123, "name": "Player"}, "r": 45, "b": 32, "4s": 4, "6s": 2, "dismissal-text": "c Sub b Bowler"},
                    ...
                ],
                "bowling": [
                    {"bowler": {"id": 456, "name": "Bowler"}, "o": 4, "m": 0, "r": 35, "w": 2, "nb": 1, "wd": 2},
                    ...
                ],
                "extras": {"r": 12, "b": 3, "lb": 2, "w": 5, "nb": 2},
                "totals": {"R": 180, "W": 5, "O": 20}
            },
            ...
        ],
        "matchStarted": true,
        "matchEnded": false
    }

    Target format (what CricketAdapter uses):
    Same shape — CricketData already returns it close enough.
    Just need to normalize batting/bowling field names.
    """
    if not data:
        return None

    score = data.get("score", [])
    raw_scorecard = data.get("scorecard", [])
    status = data.get("status", "")
    match_ended = data.get("matchEnded", False)
    match_started = data.get("matchStarted", False)

    # Normalize scorecard innings
    normalized_scorecard = []
    for idx, innings in enumerate(raw_scorecard):
        # Determine inning name from score array
        inning_name = ""
        if idx < len(score):
            inning_name = score[idx].get("inning", f"Innings {idx + 1}")

        batting = []
        for b in innings.get("batting", []):
            batsman = b.get("batsman", {})
            batting.append({
                "batsman": {
                    "id": str(batsman.get("id", f"bat_{idx}_{len(batting)}")),
                    "name": batsman.get("name", "Unknown"),
                },
                "r": b.get("r", 0),
                "b": b.get("b", 0),
                "4s": b.get("4s", 0),
                "6s": b.get("6s", 0),
                "dismissal": b.get("dismissal-text", b.get("dismissal", "not out")),
            })

        bowling = []
        for bw in innings.get("bowling", []):
            bowler = bw.get("bowler", {})
            bowling.append({
                "bowler": {
                    "id": str(bowler.get("id", f"bowl_{idx}_{len(bowling)}")),
                    "name": bowler.get("name", "Unknown"),
                },
                "o": bw.get("o", 0),
                "m": bw.get("m", 0),
                "r": bw.get("r", 0),
                "w": bw.get("w", 0),
            })

        normalized_scorecard.append({
            "inning": inning_name,
            "batting": batting,
            "bowling": bowling,
        })

    # Normalize score entries
    normalized_score = []
    for s in score:
        normalized_score.append({
            "r": s.get("r", 0),
            "w": s.get("w", 0),
            "o": float(s.get("o", 0)),
            "inning": s.get("inning", ""),
        })

    result = {
        "score": normalized_score,
        "scorecard": normalized_scorecard,
        "status": status,
        "matchEnded": match_ended,
        "matchStarted": match_started,
        "source": "cricketdata",
    }

    # Cache the normalized result
    cache_key = f"cricketdata:scorecard:{data.get('id', '')}"
    import asyncio
    asyncio.create_task(redis_set_json(cache_key, result, ex=300))

    return result


async def get_players_list(match_id: str) -> Optional[List[Dict[str, Any]]]:
    """
    Get player squad for a match.
    Extracts players from the scorecard data (batting + bowling entries).
    If no scorecard available, tries to get from match info.
    """
    cache_key = f"cricketdata:players:{match_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    # Get scorecard data and extract players from it
    scorecard = await get_match_scorecard(match_id)
    if not scorecard:
        return None

    players = []
    seen = set()

    for innings in scorecard.get("scorecard", []):
        inning_name = innings.get("inning", "")
        # Extract team name from inning (e.g., "Royal Challengers Bengaluru Inning 1" → "Royal Challengers Bengaluru")
        team = inning_name.replace("Inning 1", "").replace("Inning 2", "").replace("Innings 1", "").replace("Innings 2", "").strip()

        for bat in innings.get("batting", []):
            batsman = bat.get("batsman", {})
            pid = str(batsman.get("id", ""))
            name = batsman.get("name", "")
            if pid and pid not in seen:
                seen.add(pid)
                players.append({
                    "player_id": pid,
                    "player_name": name,
                    "team": team,
                    "role": "batsman",
                })

        for bowl in innings.get("bowling", []):
            bowler = bowl.get("bowler", {})
            pid = str(bowler.get("id", ""))
            name = bowler.get("name", "")
            if pid and pid not in seen:
                seen.add(pid)
                players.append({
                    "player_id": pid,
                    "player_name": name,
                    "team": team,  # This is the batting team, bowler is from opposite team
                    "role": "bowler",
                })

    if players:
        await redis_set_json(cache_key, players, ex=3600)

    return players if players else None
