"""
One-time stats enrichment scraper.
Fetches match stats (possession, shots, corners, etc.) from web search
and adds them to existing completed match room data.
"""
import httpx
import re
from app.core.redis import redis_get_json, redis_set_json
from typing import Optional

GOOGLE_URL = "https://www.google.com/search"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
}


async def scrape_football_stats(home_team: str, away_team: str, league: str = "") -> Optional[dict]:
    """
    Scrape match stats for a football match from web search.
    Returns dict with possession, shots, corners etc. or None.
    """
    cache_key = f"scrape:stats:{home_team}:{away_team}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    query = f"{home_team} vs {away_team} {league} match stats possession shots 2026"

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            res = await client.get(GOOGLE_URL, params={"q": query, "hl": "en"}, headers=HEADERS)
            if res.status_code != 200:
                return None

            html = res.text
            stats = _extract_stats_from_html(html)

            if stats:
                stats["source"] = "web_scrape"
                await redis_set_json(cache_key, stats, ex=86400)

            return stats
    except Exception as e:
        print(f"Stats scrape error for {home_team} vs {away_team}: {e}")
        return None


async def scrape_cricket_stats(team1: str, team2: str, league: str = "") -> Optional[dict]:
    """
    Scrape detailed cricket match stats from web search.
    Returns dict with detailed batting/bowling figures or None.
    """
    cache_key = f"scrape:cricket_stats:{team1}:{team2}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    query = f"{team1} vs {team2} {league} scorecard batting bowling 2026"

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            res = await client.get(GOOGLE_URL, params={"q": query, "hl": "en"}, headers=HEADERS)
            if res.status_code != 200:
                return None

            html = res.text
            stats = _extract_cricket_stats(html, team1, team2)

            if stats:
                stats["source"] = "web_scrape"
                await redis_set_json(cache_key, stats, ex=86400)

            return stats
    except Exception as e:
        print(f"Cricket stats scrape error for {team1} vs {team2}: {e}")
        return None


def _extract_stats_from_html(html: str) -> Optional[dict]:
    """Parse football match stats from Google search HTML."""
    stats = {}

    # Possession pattern: "XX%" near "possession"
    poss = re.findall(r'(\d{2,3})%', html)
    if len(poss) >= 2:
        stats["possession_home"] = int(poss[0])
        stats["possession_away"] = int(poss[1])

    # Shots pattern
    shots_match = re.findall(r'[Ss]hots?\s*(?:on\s*[Tt]arget)?\s*[\:\-]?\s*(\d{1,2})', html)
    if shots_match:
        stats["shots"] = shots_match[:2]

    # Corners
    corners = re.findall(r'[Cc]orners?\s*[\:\-]?\s*(\d{1,2})', html)
    if corners:
        stats["corners"] = corners[:2]

    # Fouls
    fouls = re.findall(r'[Ff]ouls?\s*[\:\-]?\s*(\d{1,2})', html)
    if fouls:
        stats["fouls"] = fouls[:2]

    # Yellow cards
    yellows = re.findall(r'[Yy]ellow\s*[Cc]ards?\s*[\:\-]?\s*(\d{1,2})', html)
    if yellows:
        stats["yellow_cards"] = yellows[:2]

    if not stats:
        return None

    return stats


def _extract_cricket_stats(html: str, team1: str, team2: str) -> Optional[dict]:
    """Parse cricket stats from Google search HTML."""
    stats = {}

    # Look for detailed batting scores: "Name 77(32)" or "Name 77* (32)"
    batter_pattern = r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d{1,3})\*?\s*\((\d{1,3})\)'
    batters = re.findall(batter_pattern, html)
    if batters:
        stats["detailed_batters"] = [
            {"name": b[0], "runs": int(b[1]), "balls": int(b[2])}
            for b in batters[:8]
        ]

    # Look for bowling figures: "Name 2/30" or "Name 2-30 (4)"
    bowler_pattern = r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d)[/-](\d{1,3})'
    bowlers = re.findall(bowler_pattern, html)
    if bowlers:
        stats["detailed_bowlers"] = [
            {"name": b[0], "wickets": int(b[1]), "runs": int(b[2])}
            for b in bowlers[:6]
        ]

    if not stats:
        return None

    return stats
