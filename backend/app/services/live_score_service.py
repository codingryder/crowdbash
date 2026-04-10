"""
Gemini-powered data service — the ONLY data source during development.
Handles: live scores, scorecards, squad data for both cricket and football.
"""
from app.core.config import settings
import json
import asyncio

_model = None


def _get_model():
    global _model
    if _model is None:
        if not settings.GEMINI_API_KEY:
            return None
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


async def _ask_gemini(prompt: str) -> dict | None:
    """Send prompt to Gemini and parse JSON response."""
    model = _get_model()
    if not model:
        return None

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        data = json.loads(text)
        if data.get("not_available"):
            return None
        return data
    except Exception as e:
        print(f"Gemini error: {e}")
        return None


async def fetch_live_score_via_gemini(match_name: str, sport: str = "cricket") -> dict | None:
    """Get live score + scorecard via Gemini."""
    from app.core.redis import redis_get_json, redis_set_json

    cache_key = f"gemini:score:{sport}:{match_name}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    if sport == "cricket":
        prompt = f"""What is the current LIVE score and scorecard of: {match_name}?

Return ONLY valid JSON:
{{
  "score": [
    {{"r": <total_runs>, "w": <wickets>, "o": <overs_float>, "inning": "<Team Name> Inning 1"}}
  ],
  "scorecard": [
    {{
      "inning": "<Team Name> Inning 1",
      "batting": [
        {{"batsman": {{"id": "p1", "name": "<Name>"}}, "r": <runs>, "b": <balls>, "4s": <fours>, "6s": <sixes>, "dismissal": "<how out or not out>"}}
      ],
      "bowling": [
        {{"bowler": {{"id": "b1", "name": "<Name>"}}, "o": <overs_float>, "m": <maidens>, "r": <runs_conceded>, "w": <wickets_taken>}}
      ]
    }}
  ],
  "status": "<match status>",
  "matchEnded": false
}}

RULES:
- Include ALL batters who have batted and ALL bowlers who have bowled
- Use "not out" for batters at crease
- ALWAYS set matchEnded to false
- Do NOT guess results — only report what has happened
- If no current data, return {{"not_available": true}}"""

    elif sport == "football":
        prompt = f"""What is the current LIVE score of: {match_name}?

Return ONLY valid JSON:
{{
  "homeTeam": {{"name": "<home team>"}},
  "awayTeam": {{"name": "<away team>"}},
  "score": {{"fullTime": {{"home": <goals>, "away": <goals>}}}},
  "status": "<LIVE or FINISHED or status text>",
  "minute": <current minute or 0>,
  "goals": [
    {{"scorer": {{"name": "<player>"}}, "minute": <int>, "type": "REGULAR"}}
  ],
  "bookings": [
    {{"player": {{"name": "<player>"}}, "card": "YELLOW", "minute": <int>}}
  ],
  "matchEnded": false
}}

RULES:
- ALWAYS set matchEnded to false
- Do NOT guess results
- If no current data, return {{"not_available": true}}"""
    else:
        return None

    data = await _ask_gemini(prompt)
    if data:
        data["source"] = "gemini"
        data["matchEnded"] = False
        await redis_set_json(cache_key, data, ex=45)
    return data


async def fetch_squad_via_gemini(match_name: str, sport: str = "cricket") -> list | None:
    """Get squad/lineup for a match via Gemini."""
    from app.core.redis import redis_get_json, redis_set_json

    cache_key = f"gemini:squad:{sport}:{match_name}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    if sport == "cricket":
        prompt = f"""List the full playing squad for both teams in: {match_name}

Return ONLY valid JSON array:
[
  {{"player_id": "t1_1", "player_name": "<Full Name>", "team": "<Team Name>", "role": "batsman|bowler|all-rounder|wicket-keeper"}}
]

Include ALL players from both teams (15-25 per team). Use roles: batsman, bowler, all-rounder, wicket-keeper.
If you don't know the squad, return []"""
    elif sport == "football":
        prompt = f"""List the squad for both teams in: {match_name}

Return ONLY valid JSON array:
[
  {{"player_id": "t1_1", "player_name": "<Full Name>", "team": "<Team Name>", "role": "GK|DEF|MID|FWD"}}
]

Include starting XI + key substitutes for both teams (15-20 per team).
If you don't know the squad, return []"""
    else:
        return None

    data = await _ask_gemini(prompt)
    if data and isinstance(data, list) and len(data) > 0:
        await redis_set_json(cache_key, data, ex=600)
        return data
    return None


async def fetch_upcoming_matches_via_gemini(sport: str = "cricket") -> list | None:
    """Ask Gemini for upcoming matches in the next 7 days."""
    from app.core.redis import redis_get_json, redis_set_json

    cache_key = f"gemini:upcoming:{sport}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if sport == "cricket":
        prompt = f"""Today is {today}. List all major upcoming cricket matches in the next 7 days.
Include: IPL, international ODIs/T20Is/Tests between major teams, PSL, BBL, CPL, The Hundred, SA20.
Do NOT include: women's matches, U19, associate nations, county cricket, warm-ups.

Return ONLY valid JSON array:
[
  {{"match_name": "Team A vs Team B", "match_format": "T20", "venue": "Stadium, City", "league": "IPL", "match_date": "2026-04-12T14:00:00Z", "season": "2026"}}
]
If no matches found, return []"""
    elif sport == "football":
        prompt = f"""Today is {today}. List all major upcoming football matches in the next 7 days.
Include: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, international friendlies between top nations.
Do NOT include: lower divisions, youth matches, women's matches.

Return ONLY valid JSON array:
[
  {{"match_name": "Team A vs Team B", "match_format": "League", "venue": "Stadium, City", "league": "Premier League", "match_date": "2026-04-12T15:00:00Z", "season": "2025-26"}}
]
If no matches found, return []"""
    else:
        return None

    data = await _ask_gemini(prompt)
    if data and isinstance(data, list):
        await redis_set_json(cache_key, data, ex=1800)  # Cache 30 min
        return data
    return None
