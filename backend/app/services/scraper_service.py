"""
Google search scraper for match results.
Fallback when sport APIs don't have data.
Scrapes match scores and key details from Google search result snippets.
"""
import httpx
import re
from app.core.redis import redis_get_json, redis_set_json
from typing import Optional

# Google search URL
GOOGLE_SEARCH_URL = "https://www.google.com/search"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
}


async def scrape_match_result(match_name: str, sport: str, league: str = "") -> Optional[dict]:
    """
    Scrape match result from Google search.
    Returns a match summary dict or None if not found.
    """
    # Check cache first (24 hour cache for completed match results)
    cache_key = f"scrape:result:{sport}:{match_name}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    # Build search query
    query = f"{match_name} {league} score result"
    if sport == "cricket":
        query += " cricket scorecard"
    elif sport == "football":
        query += " football match result"

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            res = await client.get(
                GOOGLE_SEARCH_URL,
                params={"q": query, "hl": "en"},
                headers=HEADERS,
            )
            if res.status_code != 200:
                return None

            html = res.text

            if sport == "football":
                result = _parse_football_result(html, match_name)
            else:
                result = _parse_cricket_result(html, match_name)

            if result:
                result["source"] = "google_scrape"
                result["status"] = "completed"
                result["sport"] = sport
                result["match_name"] = match_name
                await redis_set_json(cache_key, result, ex=86400)  # cache 24h

            return result
    except Exception as e:
        print(f"Scrape error for {match_name}: {e}")
        return None


def _parse_football_result(html: str, match_name: str) -> Optional[dict]:
    """Parse football score from Google search HTML."""
    parts = match_name.split(" vs ")
    if len(parts) != 2:
        return None

    home_team = parts[0].strip()
    away_team = parts[1].strip()

    # Try to find score pattern: "Team1 2 - 1 Team2" or "Team1 2-1 Team2"
    # Google sports cards often have the score in structured data
    score_patterns = [
        # "2 - 1" or "2-1" pattern near team names
        rf'{re.escape(home_team[:10])}.*?(\d+)\s*[-–]\s*(\d+).*?{re.escape(away_team[:10])}',
        rf'(\d+)\s*[-–]\s*(\d+)',
    ]

    home_goals = None
    away_goals = None

    for pattern in score_patterns:
        match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
        if match:
            home_goals = int(match.group(1))
            away_goals = int(match.group(2))
            break

    if home_goals is None:
        return None

    # Determine result
    if home_goals > away_goals:
        result_text = f"{home_team} won"
    elif away_goals > home_goals:
        result_text = f"{away_team} won"
    else:
        result_text = "Draw"

    # Try to extract goalscorers from snippets
    scorers = _extract_goalscorers(html)

    return {
        "home_team": home_team,
        "away_team": away_team,
        "home_goals": home_goals,
        "away_goals": away_goals,
        "result": result_text,
        "halftime": "",
        "scorers": scorers[:6],
        "cards": [],
    }


def _parse_cricket_result(html: str, match_name: str) -> Optional[dict]:
    """Parse cricket score from Google search HTML."""
    parts = match_name.split(" vs ")
    if len(parts) != 2:
        return None

    team1 = parts[0].strip()
    team2 = parts[1].strip()

    teams = []
    top_batters = []
    result_text = ""

    # Look for score patterns: "123/4 (20)" or "123-4 (20 ov)"
    score_pattern = r'(\d{1,3})[/-](\d{1,2})\s*\((\d+[\.\d]*)\s*(?:ov(?:ers?)?)?\)'
    scores = re.findall(score_pattern, html)

    if scores:
        for i, (runs, wkts, overs) in enumerate(scores[:2]):
            team_name = team1 if i == 0 else team2
            teams.append({
                "name": team_name,
                "score": f"{runs}/{wkts}",
                "overs": overs,
            })

    # Try to extract result text: "X won by Y runs/wickets"
    result_patterns = [
        r'([\w\s]+?)\s+won\s+by\s+(\d+)\s+(runs?|wickets?)',
        r'([\w\s]+?)\s+won\s+by\s+an?\s+innings',
        r'Match\s+(drawn|tied)',
    ]
    for pattern in result_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            result_text = match.group(0).strip()
            break

    if not teams and not result_text:
        return None

    return {
        "teams": teams,
        "result": result_text or "Completed",
        "top_batters": top_batters,
        "top_bowlers": [],
    }


def _extract_goalscorers(html: str) -> list:
    """Try to extract goalscorer names from HTML snippets."""
    scorers = []
    # Pattern: "Name 23'" or "Name (45')" — common in Google snippets
    pattern = r'([A-Z][a-záéíóú]+(?:\s[A-Z][a-záéíóú]+)?)\s*[\(]?(\d{1,3})[\'′\)]'
    matches = re.findall(pattern, html)
    seen = set()
    for name, minute in matches:
        if name not in seen and len(name) > 3:
            seen.add(name)
            scorers.append({
                "name": name,
                "minute": int(minute),
                "type": "REGULAR",
            })
    return scorers
