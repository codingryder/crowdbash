"""
Gemini-powered data service — the ONLY data source during development.
Handles: live scores, scorecards, squad data for both cricket and football.
"""
from app.core.config import settings
import json
import asyncio

_client = None
_genai_types = None
MODEL_NAME = "gemini-2.5-flash"


def _get_client():
    global _client, _genai_types
    if _client is None:
        if not settings.GEMINI_API_KEY:
            return None, None
        from google import genai
        from google.genai import types
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
        _genai_types = types
    return _client, _genai_types


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
    """Send prompt to Gemini and parse JSON response.
    When grounded=True, uses Google Search grounding for real-time data.
    """
    client, types = _get_client()
    if not client:
        return None

    config = None
    if grounded:
        config = types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())]
        )

    response = None
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL_NAME,
            contents=prompt,
            config=config,
        )

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


async def fetch_announced_xi_via_gemini(match_name: str, sport: str = "cricket") -> dict | None:
    """Get the OFFICIALLY ANNOUNCED playing XI (11 starters per team).

    Distinct from fetch_squad_via_gemini, which returns the broader 15-25 player
    squad. This one returns only the 11 confirmed starters per side, and only
    once team sheets have actually dropped (~30 min before first ball). Returns
    None if the XI hasn't been announced yet — caller should retry later.

    Cached per fixture for 5 min so repeated polls during the announcement
    window don't burn Gemini calls.
    """
    from app.core.redis import redis_get_json, redis_set_json

    cache_key = f"gemini:xi:{sport}:{match_name}"
    cached = await redis_get_json(cache_key)
    if cached:
        return cached

    if sport == "cricket":
        prompt = f"""Has the OFFICIAL playing XI (11 starting players) been announced
for this cricket match: {match_name}?

Only return data if the team sheets have been officially confirmed (typically
~30 min before the first ball, after the toss). Do NOT guess based on past
matches or likely lineups.

If announced, return ONLY valid JSON:
{{
  "announced": true,
  "team_a": "<First Team Name>",
  "team_b": "<Second Team Name>",
  "xi_a": ["<Full Name>", "<Full Name>", ... 11 names],
  "xi_b": ["<Full Name>", "<Full Name>", ... 11 names]
}}

If NOT yet announced (toss not done, or team sheets not released), return:
{{"announced": false}}

Rules:
- Each xi_a / xi_b array MUST have exactly 11 names.
- Use the same full name spelling that broadcasters use.
- If unsure or data is from a different match, return {{"announced": false}}."""
    elif sport == "football":
        prompt = f"""Has the OFFICIAL starting XI (11 starting players) been announced
for this football match: {match_name}?

Only return data once the team sheets have been published — typically ~60
minutes before kickoff. Do NOT guess based on form, injuries, or past starts.

If confirmed, return ONLY valid JSON:
{{
  "announced": true,
  "team_a": "<Home Team Name>",
  "team_b": "<Away Team Name>",
  "xi_a": ["<Full Name>", ... 11 names],
  "xi_b": ["<Full Name>", ... 11 names]
}}

If NOT yet announced, return:
{{"announced": false}}

Rules:
- Each xi_a / xi_b array MUST have exactly 11 names (the starting XI; substitutes are excluded).
- Use the standard broadcaster spelling (e.g. "Bukayo Saka", "Heung-Min Son").
- xi_a is the home side, xi_b is the away side.
- If unsure, the lineup hasn't dropped yet, or the data refers to a past fixture, return {{"announced": false}}."""
    else:
        return None

    data = await _ask_gemini(prompt, grounded=True)
    if not isinstance(data, dict) or not data.get("announced"):
        return None
    xi_a = data.get("xi_a") or []
    xi_b = data.get("xi_b") or []
    if len(xi_a) != 11 or len(xi_b) != 11:
        # Reject partial responses — only persist a confident XI.
        return None

    payload = {
        "team_a": data.get("team_a") or "",
        "team_b": data.get("team_b") or "",
        "xi_a": xi_a,
        "xi_b": xi_b,
    }
    await redis_set_json(cache_key, payload, ex=300)
    return payload


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
            ms_val = str(m.get("ms", "")).lower()
            if ms_val in ("scheduled", "not started", "fixture", ""):
                m["ms"] = "upcoming"
            elif ms_val in ("in progress", "live"):
                m["ms"] = "live"
            elif ms_val in ("completed", "finished", "result"):
                m["ms"] = "result"
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
