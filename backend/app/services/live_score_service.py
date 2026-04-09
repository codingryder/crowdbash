"""
Gemini-powered live score fetcher.
Uses Gemini Flash to get real-time cricket scores and full scorecard
when the primary API (CricketData.org) fails or returns stale data.
"""
from app.core.config import settings
import json

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


async def fetch_live_score_via_gemini(match_name: str, sport: str = "cricket") -> dict | None:
    """
    Ask Gemini for the current live score AND full scorecard of a match.
    Returns data in the same format as CricketData.org for compatibility.
    """
    model = _get_model()
    if not model:
        return None

    if sport != "cricket":
        return None

    prompt = f"""What is the current LIVE score and scorecard of: {match_name}?

Return ONLY valid JSON matching this exact structure:
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

CRITICAL RULES:
- Include ALL batters who have batted (not just current two)
- Include ALL bowlers who have bowled
- Use "not out" for batters still at crease, actual dismissal text for others
- If 2nd innings has started, include both innings in score[] and scorecard[]
- Use real player names
- ALWAYS set matchEnded to false — do NOT determine if match is over
- For status, just describe the current state like "LSG need 150 runs in 90 balls" — do NOT say who won
- If you don't have CURRENT live data, return {{"not_available": true}}
- Do NOT guess or predict results — only report what has actually happened"""

    try:
        import asyncio
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

        # Mark as Gemini source + force matchEnded to false (never trust Gemini for this)
        data["source"] = "gemini"
        data["matchEnded"] = False

        return data
    except Exception as e:
        print(f"Gemini live score error for {match_name}: {e}")
        return None
