"""
Gemini-powered live score fetcher.
Uses Gemini Flash with Google Search grounding to get real-time cricket scores
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
    Ask Gemini for the current live score of a match.
    Returns normalized score data or None.
    """
    model = _get_model()
    if not model:
        return None

    parts = match_name.split(" vs ")
    team1 = parts[0].strip() if len(parts) > 0 else ""
    team2 = parts[1].strip() if len(parts) > 1 else ""

    if sport == "cricket":
        prompt = f"""What is the current LIVE score of the cricket match: {match_name}?

If the match is currently in progress, return the live score.
If it just finished, return the final score.

Return ONLY valid JSON, no other text:
{{
  "score": [
    {{"r": <runs>, "w": <wickets>, "o": <overs as float>, "inning": "<team name> Inning <number>"}},
    {{"r": <runs>, "w": <wickets>, "o": <overs as float>, "inning": "<team name> Inning <number>"}}
  ],
  "status": "<match status text, e.g. 'Team A won by X runs' or 'Team A batting'>",
  "matchEnded": <true or false>,
  "current_batting": [
    {{"name": "<batter name>", "runs": <int>, "balls": <int>, "fours": <int>, "sixes": <int>}}
  ],
  "current_bowling": [
    {{"name": "<bowler name>", "wickets": <int>, "runs": <int>, "overs": "<overs>", "maidens": <int>}}
  ]
}}

Rules:
- Only include the innings that have been played so far
- For current_batting, only include batters currently at the crease (not out)
- For current_bowling, include the current bowler
- If match hasn't started or you don't know, return {{"not_available": true}}"""
    else:
        return None  # Football handled by Football-Data.org

    try:
        response = model.generate_content(prompt)
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
        print(f"Gemini live score error for {match_name}: {e}")
        return None
