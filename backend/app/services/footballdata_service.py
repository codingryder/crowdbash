"""
Football-Data.org API Service — Primary football data source.
Free tier: 10 requests/minute, 12 major leagues.

API docs: https://www.football-data.org/documentation/api
Endpoints used:
  - /v4/matches — list matches (filterable by competition, status, date)
  - /v4/matches/{id} — single match detail with lineups, goals, bookings
"""
import httpx
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json
from typing import List, Dict, Any, Optional
from datetime import date, timedelta

BASE_URL = "https://api.football-data.org/v4"

# Competition codes for free tier
COMPETITION_CODES = {
    "Premier League": "PL",
    "La Liga": "PD",
    "Primera Division": "PD",
    "Serie A": "SA",
    "Bundesliga": "BL1",
    "Ligue 1": "FL1",
    "Eredivisie": "DED",
    "Championship": "ELC",
    "UEFA Champions League": "CL",
    "Champions League": "CL",
    "Campeonato Brasileiro Série A": "BSA",
    "Primeira Liga": "PPL",
    "Copa Libertadores": "CLI",
}


def _headers() -> dict:
    return {"X-Auth-Token": settings.FOOTBALL_API_KEY}


async def get_matches(
    competition: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> Optional[List[Dict[str, Any]]]:
    """
    Get football matches with optional filters.
    status: SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED, CANCELLED
    """
    if not settings.FOOTBALL_API_KEY:
        return None

    params: dict = {}
    if status:
        params["status"] = status
    if date_from:
        params["dateFrom"] = date_from
    if date_to:
        params["dateTo"] = date_to

    # Build URL based on whether we're filtering by competition
    if competition:
        code = COMPETITION_CODES.get(competition, competition)
        url = f"{BASE_URL}/competitions/{code}/matches"
    else:
        url = f"{BASE_URL}/matches"

    # Cache key from params
    cache_suffix = f"{competition or 'all'}:{status or 'all'}:{date_from or ''}:{date_to or ''}"
    cache_key = f"footballdata:matches:{cache_suffix}"
    ttl = 60 if status in ("IN_PLAY", "PAUSED", "LIVE") else 300

    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=_headers(), params=params, timeout=15)

            if res.status_code == 429:
                print("Football-Data.org: rate limited")
                return None

            if res.status_code != 200:
                print(f"Football-Data.org matches error: {res.status_code} - {res.text[:200]}")
                return None

            data = res.json()
            matches = data.get("matches", [])

            normalized = [_normalize_match(m) for m in matches]
            await redis_set_json(cache_key, normalized, ex=ttl)
            return normalized

    except Exception as e:
        print(f"Football-Data.org matches exception: {e}")
        return None


async def get_match_detail(match_id: str) -> Optional[Dict[str, Any]]:
    """
    Get full match detail including lineups, goals, bookings.
    Returns normalized data in the shape FootballAdapter expects.
    """
    if not settings.FOOTBALL_API_KEY:
        return None

    cache_key = f"footballdata:match:{match_id}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{BASE_URL}/matches/{match_id}",
                headers=_headers(),
                timeout=15,
            )

            if res.status_code == 429:
                print("Football-Data.org: rate limited")
                return None

            if res.status_code != 200:
                print(f"Football-Data.org match detail error: {res.status_code}")
                return None

            match = res.json()
            normalized = _normalize_match_detail(match)

            ttl = 45 if match.get("status") in ("IN_PLAY", "PAUSED") else 300
            await redis_set_json(cache_key, normalized, ex=ttl)
            return normalized

    except Exception as e:
        print(f"Football-Data.org match detail exception: {e}")
        return None


async def get_upcoming_matches(days: int = 7) -> Optional[List[Dict[str, Any]]]:
    """
    Get upcoming matches for the next N days across all free-tier leagues.
    Used by admin panel for match discovery.
    """
    cache_key = "footballdata:upcoming"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    today = date.today()
    end = today + timedelta(days=days)

    matches = await get_matches(
        date_from=today.isoformat(),
        date_to=end.isoformat(),
        status="SCHEDULED,TIMED",
    )

    if matches:
        await redis_set_json(cache_key, matches, ex=1800)

    return matches


def _normalize_match(match: dict) -> dict:
    """
    Normalize a Football-Data.org match into the shape FootballAdapter expects.
    """
    home = match.get("homeTeam", {})
    away = match.get("awayTeam", {})
    score = match.get("score", {})
    full_time = score.get("fullTime", {}) or {}
    half_time = score.get("halfTime", {}) or {}
    competition = match.get("competition", {})
    status = match.get("status", "SCHEDULED")

    # Determine minute from match time
    minute = 0
    if status == "IN_PLAY":
        minute = match.get("minute", 45)  # API may or may not provide this
    elif status == "PAUSED":
        minute = 45
    elif status == "FINISHED":
        minute = 90

    # Determine half
    half = 1
    if status == "PAUSED":
        half = 1  # Half-time
    elif minute > 45:
        half = 2

    # Determine if match ended
    match_ended = status in ("FINISHED", "AWARDED", "CANCELLED")

    return {
        "id": str(match.get("id", "")),
        "homeTeam": {"name": home.get("name", home.get("shortName", ""))},
        "awayTeam": {"name": away.get("name", away.get("shortName", ""))},
        "score": {
            "fullTime": {
                "home": full_time.get("home", 0) if full_time.get("home") is not None else 0,
                "away": full_time.get("away", 0) if full_time.get("away") is not None else 0,
            },
            "halfTime": {
                "home": half_time.get("home"),
                "away": half_time.get("away"),
            },
        },
        "status": status,
        "minute": minute,
        "half": half,
        "matchEnded": match_ended,
        "source": "footballdata",
        "competition": {
            "name": competition.get("name", ""),
            "code": competition.get("code", ""),
        },
        "utcDate": match.get("utcDate", ""),
        "venue": match.get("venue", ""),
        # Goals and bookings may not be in list endpoint — get via detail
        "goals": [],
        "bookings": [],
    }


def _normalize_match_detail(match: dict) -> dict:
    """
    Normalize detailed match data including goals, bookings, and lineups.
    """
    base = _normalize_match(match)

    # Extract goals from match events or goals array
    goals = []
    for goal in match.get("goals", []):
        scorer = goal.get("scorer", {})
        assist = goal.get("assist", {})
        goals.append({
            "scorer": {"name": scorer.get("name", "")},
            "assist": {"name": assist.get("name", "")} if assist else None,
            "minute": goal.get("minute", 0),
            "type": goal.get("type", "REGULAR"),
        })
    base["goals"] = goals

    # Extract bookings
    bookings = []
    for booking in match.get("bookings", []):
        player = booking.get("player", {})
        bookings.append({
            "player": {"name": player.get("name", "")},
            "card": booking.get("card", "YELLOW_CARD").replace("_CARD", ""),
            "minute": booking.get("minute", 0),
        })
    base["bookings"] = bookings

    # Extract lineups if available
    lineups = match.get("homeTeam", {}).get("lineup", [])
    away_lineups = match.get("awayTeam", {}).get("lineup", [])
    if lineups or away_lineups:
        base["_lineups"] = {
            "home": lineups,
            "away": away_lineups,
            "home_name": match.get("homeTeam", {}).get("name", ""),
            "away_name": match.get("awayTeam", {}).get("name", ""),
        }

    return base


def extract_lineups_as_players(match_detail: dict) -> Optional[list]:
    """
    Extract lineups from a match detail response into the
    [{player_id, player_name, team, role}] format.
    """
    lineups = match_detail.get("_lineups")
    if not lineups:
        return None

    players = []
    home_name = lineups.get("home_name", "Home")
    away_name = lineups.get("away_name", "Away")

    for p in lineups.get("home", []):
        players.append({
            "player_id": str(p.get("id", f"h_{len(players)}")),
            "player_name": p.get("name", ""),
            "team": home_name,
            "role": p.get("position", "MID"),
        })

    for p in lineups.get("away", []):
        players.append({
            "player_id": str(p.get("id", f"a_{len(players)}")),
            "player_name": p.get("name", ""),
            "team": away_name,
            "role": p.get("position", "MID"),
        })

    return players if players else None
