from app.core.config import settings
import json

_client = None
MODEL_NAME = "gemini-2.5-flash"


def _get_client():
    """Lazy init Gemini to avoid crash when API key is missing."""
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


async def generate_quiz_question(match_context: dict, sport: str = "cricket") -> dict:
    """
    Generate a match-contextual quiz question using Gemini.
    Adapts prompt based on sport type.
    """
    if not settings.GEMINI_API_KEY:
        return {
            "question": "Sports trivia coming soon!",
            "options": ["A. Option 1", "B. Option 2", "C. Option 3"],
            "correct_index": 0,
            "explanation": "Gemini API key not configured."
        }

    client = _get_client()

    if sport == "football":
        prompt = f"""
You are a football quiz host for a live fan room.

Match context:
- Match: {match_context.get('match_name')}
- Home: {match_context.get('home_team')}
- Away: {match_context.get('away_team')}
- Score: {match_context.get('current_score')}
- Minute: {match_context.get('minute')}

Generate ONE interesting football trivia question relevant to this match or the teams/players involved.
It should be engaging for fans watching live.

Return ONLY valid JSON in this exact format, no other text:
{{
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ..."],
  "correct_index": 0,
  "explanation": "..."
}}
"""
    else:
        prompt = f"""
You are a cricket quiz host for a live fan room.

Match context:
- Match: {match_context.get('match_name')}
- Current score: {match_context.get('current_score')}
- Over: {match_context.get('over')}
- Batting team: {match_context.get('batting_team')}
- Key players on pitch: {match_context.get('players')}

Generate ONE interesting cricket trivia question relevant to this match or the players/teams involved.
It should be engaging for fans watching live.

Return ONLY valid JSON in this exact format, no other text:
{{
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ..."],
  "correct_index": 0,
  "explanation": "..."
}}
"""

    response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
    text = response.text.strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)
