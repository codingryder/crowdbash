"""
AI-generated live commentary using Gemini Flash.
Detects score changes and generates contextual commentary.
"""
from app.core.config import settings
import json
import uuid

_client = None
MODEL_NAME = "gemini-2.5-flash"


def _get_client():
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            return None
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def detect_cricket_changes(old_score: dict, new_score: dict) -> list[dict]:
    """
    Compare old and new score arrays to detect what happened.
    Returns list of events: [{type, description}]
    """
    events = []
    old_arr = old_score.get("score", [])
    new_arr = new_score.get("score", [])

    if not new_arr:
        return events

    # Get current innings data
    new_last = new_arr[-1] if new_arr else {}
    old_last = old_arr[-1] if old_arr and len(old_arr) == len(new_arr) else {}

    new_runs = new_last.get("r", 0)
    old_runs = old_last.get("r", 0)
    new_wkts = new_last.get("w", 0)
    old_wkts = old_last.get("w", 0)
    new_overs = float(new_last.get("o", 0))
    old_overs = float(old_last.get("o", 0))

    runs_diff = new_runs - old_runs
    wkts_diff = new_wkts - old_wkts

    # New innings started
    if len(new_arr) > len(old_arr):
        events.append({
            "type": "innings_change",
            "runs_diff": 0,
            "wkts_diff": 0,
            "new_runs": new_runs,
            "new_wkts": new_wkts,
            "new_overs": new_overs,
            "inning": new_last.get("inning", ""),
        })
        return events

    if runs_diff == 0 and wkts_diff == 0:
        return events

    # Wicket fell
    if wkts_diff > 0:
        events.append({
            "type": "wicket",
            "runs_diff": runs_diff,
            "wkts_diff": wkts_diff,
            "new_runs": new_runs,
            "new_wkts": new_wkts,
            "new_overs": new_overs,
            "inning": new_last.get("inning", ""),
        })

    # Big runs (6 or boundary likely)
    elif runs_diff >= 6:
        events.append({
            "type": "big_runs",
            "runs_diff": runs_diff,
            "new_runs": new_runs,
            "new_wkts": new_wkts,
            "new_overs": new_overs,
            "inning": new_last.get("inning", ""),
        })

    # Regular scoring
    elif runs_diff > 0:
        events.append({
            "type": "runs",
            "runs_diff": runs_diff,
            "new_runs": new_runs,
            "new_wkts": new_wkts,
            "new_overs": new_overs,
            "inning": new_last.get("inning", ""),
        })

    return events


async def generate_commentary(
    match_name: str,
    events: list[dict],
    current_batting: list[dict],
    current_bowling: list[dict],
) -> list[dict]:
    """
    Use Gemini to generate commentary for detected events.
    Returns list of match_event dicts ready for WebSocket broadcast.
    """
    client = _get_client()
    if not client or not events:
        return []

    # Build context
    batters_str = ", ".join(
        f"{b.get('name', '?')} {b.get('runs', 0)}*({b.get('balls', 0)})"
        for b in current_batting[:2]
    )
    bowlers_str = ", ".join(
        f"{b.get('name', '?')} {b.get('wickets', 0)}/{b.get('runs', 0)}"
        for b in current_bowling[:2]
    )

    results = []
    for event in events[:3]:  # Max 3 events per poll
        score_text = f"{event.get('new_runs', 0)}/{event.get('new_wkts', 0)} ({event.get('new_overs', 0)} ov)"
        event_type = event.get("type", "runs")

        prompt = f"""You are a cricket commentator. Generate ONE short, exciting commentary line (max 20 words) for this moment:

Match: {match_name}
Score: {score_text}
Event: {event_type} — {event.get('runs_diff', 0)} runs scored, {event.get('wkts_diff', 0)} wickets fell
At crease: {batters_str}
Bowling: {bowlers_str}

Just the commentary line, nothing else. Be energetic and natural like a real cricket commentator."""

        try:
            import asyncio
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL_NAME, contents=prompt,
            )
            text = response.text.strip().strip('"').strip("'")

            # Determine chip type for frontend
            if event_type == "wicket":
                chip = "wicket"
            elif event.get("runs_diff", 0) >= 6:
                chip = "six"
            elif event.get("runs_diff", 0) >= 4:
                chip = "boundary"
            elif event.get("runs_diff", 0) == 0:
                chip = "dot"
            elif event_type == "innings_change":
                chip = "wicket"
            else:
                chip = "single"

            results.append({
                "id": str(uuid.uuid4()),
                "sport": "cricket",
                "event_type": chip,
                "player_name": current_batting[0].get("name", "") if current_batting else "",
                "team": "",
                "over_number": event.get("new_overs", 0),
                "commentary": text,
            })
        except Exception as e:
            print(f"Gemini commentary error: {e}")
            # Fallback: simple auto-generated text
            if event_type == "wicket":
                text = f"WICKET! Score now {score_text}"
            elif event.get("runs_diff", 0) >= 6:
                text = f"SIX! {event.get('runs_diff', 0)} runs. Score: {score_text}"
            elif event.get("runs_diff", 0) >= 4:
                text = f"FOUR! Score: {score_text}"
            else:
                text = f"{event.get('runs_diff', 0)} run(s). Score: {score_text}"

            chip = "six" if event.get("runs_diff", 0) >= 6 else "boundary" if event.get("runs_diff", 0) >= 4 else "wicket" if event_type == "wicket" else "single"

            results.append({
                "id": str(uuid.uuid4()),
                "sport": "cricket",
                "event_type": chip,
                "player_name": current_batting[0].get("name", "") if current_batting else "",
                "team": "",
                "over_number": event.get("new_overs", 0),
                "commentary": text,
            })

    return results
