from app.core.config import settings
import json

_model = None


def _get_model():
    """Lazy init Gemini to avoid crash when API key is missing."""
    global _model
    if _model is None:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


async def generate_quiz_question(match_context: dict) -> dict:
    """
    Generate a match-contextual quiz question using Gemini.
    match_context: {match_name, current_score, batting_team, over, players}
    """
    if not settings.GEMINI_API_KEY:
        return {
            "question": "Cricket trivia coming soon!",
            "options": ["A. Option 1", "B. Option 2", "C. Option 3"],
            "correct_index": 0,
            "explanation": "Gemini API key not configured."
        }

    model = _get_model()
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
    response = model.generate_content(prompt)
    text = response.text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)
