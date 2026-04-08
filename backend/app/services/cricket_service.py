import httpx
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json

CRICAPI_BASE = "https://api.cricapi.com/v1"
CACHE_TTL = 60  # seconds — cache score for 1 minute to preserve free tier calls


async def get_live_matches() -> list:
    """Get all live matches. Cached for 5 minutes."""
    cached = await redis_get_json("cricapi:live_matches")
    if cached:
        return cached

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{CRICAPI_BASE}/cricScore",
            params={"apikey": settings.CRICAPI_KEY}
        )
        data = res.json()
        matches = data.get("data", [])
        await redis_set_json("cricapi:live_matches", matches, ex=300)
        return matches


async def get_match_score(match_id: str) -> dict:
    """Get current score for a match. Cached for 1 minute."""
    cache_key = f"cricapi:score:{match_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{CRICAPI_BASE}/match_scorecard",
            params={"apikey": settings.CRICAPI_KEY, "id": match_id}
        )
        data = res.json()
        score_data = data.get("data", {})
        await redis_set_json(cache_key, score_data, ex=CACHE_TTL)
        return score_data


async def get_match_players(match_id: str) -> list:
    """Get playing XI for both teams. Cached for 10 minutes."""
    cache_key = f"cricapi:players:{match_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{CRICAPI_BASE}/match_info",
            params={"apikey": settings.CRICAPI_KEY, "id": match_id}
        )
        data = res.json()
        players = data.get("data", {}).get("players", [])
        await redis_set_json(cache_key, players, ex=600)
        return players


def extract_player_runs(scorecard: dict, player_id: str) -> int:
    """Extract runs scored by a player from scorecard data."""
    for innings in scorecard.get("scorecard", []):
        for batting_entry in innings.get("batting", []):
            if batting_entry.get("batsman", {}).get("id") == player_id:
                return batting_entry.get("r", 0)
    return 0


def extract_current_over(scorecard: dict) -> float:
    """Get current over number from scorecard."""
    try:
        for innings in scorecard.get("scorecard", []):
            if innings.get("inningsId") == 1:
                overs_str = innings.get("overs", "0")
                return float(overs_str)
    except Exception:
        pass
    return 0.0
