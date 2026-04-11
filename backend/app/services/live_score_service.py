"""
Gemini-powered data service — the ONLY data source during development.
Handles: live scores, scorecards, squad data for both cricket and football.
"""
from app.core.config import settings
import json
import asyncio

_model = None
_model_grounded = None


def _get_model():
    global _model
    if _model is None:
        if not settings.GEMINI_API_KEY:
            return None
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


def _get_grounded_model():
    """Get Gemini model with Google Search grounding enabled for real-time data."""
    global _model_grounded
    if _model_grounded is None:
        if not settings.GEMINI_API_KEY:
            return None
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model_grounded = genai.GenerativeModel(
            "gemini-2.5-flash",
            tools="google_search_retrieval",
        )
    return _model_grounded


def _parse_json_response(text: str) -> dict | list | None:
    """Parse JSON from Gemini response text, handling markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    return json.loads(text)


async def _ask_gemini(prompt: str, grounded: bool = False) -> dict | None:
    """Send prompt to Gemini and parse JSON response."""
    model = _get_grounded_model() if grounded else _get_model()
    if not model:
        return None

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        if not response or not response.text:
            print(f"Gemini returned empty response (grounded={grounded})")
            return None
        data = _parse_json_response(response.text)
        if isinstance(data, dict) and data.get("not_available"):
            print("Gemini says data not available")
            return None
        return data
    except json.JSONDecodeError as e:
        raw = response.text[:300] if response and response.text else 'N/A'
        print(f"Gemini JSON parse error: {e} — raw: {raw}")
        return None
    except Exception as e:
        print(f"Gemini error ({type(e).__name__}): {e}")
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


async def fetch_live_matches_via_gemini(sport: str = "cricket") -> list | None:
    """Ask Gemini for currently live + today's upcoming matches."""
    from app.core.redis import redis_get_json, redis_set_json

    cache_key = f"gemini:live_matches:{sport}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if sport == "cricket":
        prompt = f"""Right now it is {now}. List ALL cricket matches that are:
1. Currently LIVE (in progress right now)
2. Scheduled for today (not yet started)

Include: IPL 2026, international ODIs/T20Is/Tests, PSL, BBL, CPL, The Hundred, SA20, and other major leagues.
Do NOT include: women's matches, U19, associate nations, county cricket, warm-ups.

Return ONLY valid JSON array:
[
  {{
    "id": "gemini_1",
    "name": "Team A vs Team B, 25th Match",
    "matchType": "t20",
    "venue": "Stadium, City",
    "dateTimeGMT": "2026-04-11T14:00:00Z",
    "teams": ["Team A", "Team B"],
    "t1": "Team A",
    "t2": "Team B",
    "series": "Indian Premier League 2026",
    "ms": "live",
    "matchStarted": true,
    "matchEnded": false,
    "status": "Team A 150/3 (15.2 ov)",
    "score": [
      {{"r": 150, "w": 3, "o": 15.2, "inning": "Team A Inning 1"}}
    ]
  }}
]

RULES:
- "ms" must be "live" for matches in progress, "upcoming" for not started yet
- For live matches, include current score in the "score" array and "status" field
- For upcoming matches, set "score" to [] and "matchStarted" to false
- Use real match data — do NOT invent matches
- If no matches, return []"""
    else:
        return None

    data = await _ask_gemini(prompt, grounded=True)
    if data and isinstance(data, list):
        # Normalize: ensure all entries have required fields
        for m in data:
            if "id" not in m:
                m["id"] = f"gemini_{data.index(m)}"
            if "ms" not in m:
                m["ms"] = "upcoming"
            if "score" not in m:
                m["score"] = []
            if "t1" not in m and "teams" in m and len(m["teams"]) > 0:
                m["t1"] = m["teams"][0]
            if "t2" not in m and "teams" in m and len(m["teams"]) > 1:
                m["t2"] = m["teams"][1]
            m["source"] = "gemini"
        await redis_set_json(cache_key, data, ex=300)  # Cache 5 min
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
