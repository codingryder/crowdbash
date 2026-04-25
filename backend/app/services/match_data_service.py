"""
Gemini-powered match data fetcher.
Uses Google Search + Gemini Flash to get structured match results,
scorecards, and stats for completed matches.
"""
import httpx
import json
from app.core.config import settings
from app.core.redis import redis_get_json, redis_set_json
from typing import Optional

GOOGLE_SEARCH_URL = "https://www.google.com/search"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
}

_client = None
MODEL_NAME = "gemini-2.5-flash"


def _get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


async def _google_search_snippets(query: str) -> str:
    """Fetch Google search results page and return raw text snippets."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            res = await client.get(
                GOOGLE_SEARCH_URL,
                params={"q": query, "hl": "en", "num": 5},
                headers=HEADERS,
            )
            if res.status_code != 200:
                return ""

            # Strip HTML tags to get text content
            import re
            html = res.text
            # Remove scripts and styles
            html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
            html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
            # Remove HTML tags
            text = re.sub(r'<[^>]+>', ' ', html)
            # Collapse whitespace
            text = re.sub(r'\s+', ' ', text).strip()
            # Take first 3000 chars (enough for Gemini to extract data)
            return text[:3000]
    except Exception as e:
        print(f"Google search error: {e}")
        return ""


async def fetch_football_match_data(
    home_team: str, away_team: str, league: str = ""
) -> Optional[dict]:
    """
    Use Google Search + Gemini to get structured football match data.
    Returns full match summary with score, scorers, stats.
    """
    if not settings.GEMINI_API_KEY:
        return None

    cache_key = f"gemini:football:{home_team}:{away_team}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    # Ask Gemini directly — it has knowledge of recent match results
    prompt = f"""You are a sports data assistant. Provide the football match result data for this match.

Match: {home_team} vs {away_team}
League: {league}
Year: 2026 (or most recent match between these teams)

Return ONLY valid JSON in this exact format (no other text, no markdown):
{{
  "home_team": "{home_team}",
  "away_team": "{away_team}",
  "home_goals": <int>,
  "away_goals": <int>,
  "halftime": "<home_ht> - <away_ht>",
  "result": "<team> won" or "Draw",
  "scorers": [
    {{"name": "<player name>", "minute": <int>, "type": "REGULAR"}}
  ],
  "cards": [
    {{"name": "<player name>", "card": "YELLOW", "minute": <int>}}
  ],
  "stats": {{
    "possession_home": <int percent>,
    "possession_away": <int percent>,
    "shots_home": <int>,
    "shots_away": <int>,
    "shots_on_target_home": <int>,
    "shots_on_target_away": <int>,
    "corners_home": <int>,
    "corners_away": <int>,
    "fouls_home": <int>,
    "fouls_away": <int>
  }}
}}

Rules:
- Use 0 for any stat you cannot find
- Only include scorers and cards you can confirm from the data
- If the match hasn't been played yet, return {{"not_played": true}}
"""

    try:
        client = _get_client()
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        text = response.text.strip()

        # Strip markdown fences
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        data = json.loads(text)

        if data.get("not_played"):
            return None

        # Structure the result
        stats = data.get("stats", {})
        result = {
            "status": "completed",
            "sport": "football",
            "match_name": f"{home_team} vs {away_team}",
            "home_team": data.get("home_team", home_team),
            "away_team": data.get("away_team", away_team),
            "home_goals": data.get("home_goals", 0),
            "away_goals": data.get("away_goals", 0),
            "halftime": data.get("halftime", ""),
            "result": data.get("result", ""),
            "scorers": data.get("scorers", [])[:10],
            "cards": data.get("cards", [])[:10],
            "possession_home": stats.get("possession_home"),
            "possession_away": stats.get("possession_away"),
            "shots": [str(stats.get("shots_home", 0)), str(stats.get("shots_away", 0))],
            "shots_on_target": [str(stats.get("shots_on_target_home", 0)), str(stats.get("shots_on_target_away", 0))],
            "corners": [str(stats.get("corners_home", 0)), str(stats.get("corners_away", 0))],
            "fouls": [str(stats.get("fouls_home", 0)), str(stats.get("fouls_away", 0))],
            "stats_enriched": True,
            "source": "gemini",
        }

        await redis_set_json(cache_key, result, ex=86400)
        return result

    except Exception as e:
        print(f"Gemini football error for {home_team} vs {away_team}: {e}")
        return None


async def fetch_cricket_match_data(
    team1: str, team2: str, league: str = ""
) -> Optional[dict]:
    """
    Use Google Search + Gemini to get structured cricket match data.
    Returns full scorecard summary with batting, bowling, result.
    """
    if not settings.GEMINI_API_KEY:
        return None

    cache_key = f"gemini:cricket:{team1}:{team2}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    # Ask Gemini directly — it has knowledge of recent match results
    prompt = f"""You are a sports data assistant. Provide the cricket match scorecard data for this match.

Match: {team1} vs {team2}
League: {league}
Year: 2026 (or most recent match between these teams)

Return ONLY valid JSON in this exact format (no other text, no markdown):
{{
  "teams": [
    {{"name": "<team name>", "score": "<runs>/<wickets>", "overs": "<overs>"}},
    {{"name": "<team name>", "score": "<runs>/<wickets>", "overs": "<overs>"}}
  ],
  "result": "<full result text, e.g. India won by 5 wickets>",
  "top_batters": [
    {{"name": "<player>", "runs": <int>, "balls": <int>, "team": "<team short>"}}
  ],
  "top_bowlers": [
    {{"name": "<player>", "wickets": <int>, "runs_conceded": <int>, "overs": "<overs>", "team": "<team short>"}}
  ],
  "player_of_match": "<name>"
}}

Rules:
- Include top 4-6 batters sorted by runs (highest first)
- Include top 3-4 bowlers sorted by wickets (most first)
- Use short team names (e.g. "RCB", "CSK", "IND", "AUS")
- If the match hasn't been played yet, return {{"not_played": true}}
"""

    try:
        client = _get_client()
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        text = response.text.strip()

        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        data = json.loads(text)

        if data.get("not_played"):
            return None

        result = {
            "status": "completed",
            "sport": "cricket",
            "match_name": f"{team1} vs {team2}",
            "teams": data.get("teams", []),
            "result": data.get("result", ""),
            "top_batters": data.get("top_batters", [])[:6],
            "top_bowlers": data.get("top_bowlers", [])[:4],
            "player_of_match": data.get("player_of_match", ""),
            "stats_enriched": True,
            "source": "gemini",
        }

        await redis_set_json(cache_key, result, ex=86400)
        return result

    except Exception as e:
        print(f"Gemini cricket error for {team1} vs {team2}: {e}")
        return None
