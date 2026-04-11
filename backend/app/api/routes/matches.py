"""
Public endpoints for live match data — separate from rooms.
These return raw match data from sport APIs, not admin-created rooms.
"""
from fastapi import APIRouter, HTTPException
from app.services.sport_service import get_adapter
from app.api.routes.admin import _is_allowed_cricket

router = APIRouter()


@router.get("/live")
async def get_live_matches():
    """
    Get all live + upcoming matches from sport APIs.
    Filtered to major leagues only. Returns matches grouped by status.
    """
    all_live = []
    all_upcoming = []

    for sport in ("cricket", "football"):
        try:
            adapter = get_adapter(sport)
            matches = await adapter.get_live_matches()
            if not matches:
                continue

            for m in matches:
                if sport == "cricket":
                    series = m.get("series", "")
                    match_format = m.get("matchType", "")
                    if not _is_allowed_cricket(series, match_format):
                        continue

                    ms = m.get("ms", "")
                    score_list = m.get("score", [])

                    # Build score strings from score array
                    team1_score = ""
                    team2_score = ""
                    if score_list:
                        for s in score_list:
                            inning = s.get("inning", "")
                            score_str = f"{s.get('r', 0)}/{s.get('w', 0)} ({s.get('o', 0)} ov)"
                            if "1" in inning:
                                if not team1_score:
                                    team1_score = score_str
                                else:
                                    team2_score = score_str
                            elif "2" in inning:
                                if not team2_score:
                                    team2_score = score_str

                    entry = {
                        "match_id": m.get("id", ""),
                        "match_name": m.get("name", f"{m.get('t1', '')} vs {m.get('t2', '')}"),
                        "sport": "cricket",
                        "league": series,
                        "match_format": match_format,
                        "venue": m.get("venue", ""),
                        "match_date": m.get("dateTimeGMT", ""),
                        "status": ms,
                        "team1": {
                            "name": m.get("t1", ""),
                            "score": team1_score,
                        },
                        "team2": {
                            "name": m.get("t2", ""),
                            "score": team2_score,
                        },
                        "match_status_text": m.get("status", ""),
                    }

                    if ms == "live":
                        all_live.append(entry)
                    elif ms == "upcoming":
                        all_upcoming.append(entry)

                elif sport == "football":
                    home = m.get("homeTeam", {})
                    away = m.get("awayTeam", {})
                    competition = m.get("competition", {})
                    status_raw = m.get("status", "")
                    score_obj = m.get("score", {})
                    ft = score_obj.get("fullTime", {}) if score_obj else {}

                    if status_raw in ("IN_PLAY", "PAUSED"):
                        status = "live"
                    elif status_raw in ("SCHEDULED", "TIMED"):
                        status = "upcoming"
                    else:
                        continue  # skip finished

                    entry = {
                        "match_id": str(m.get("id", "")),
                        "match_name": f"{home.get('name', '')} vs {away.get('name', '')}",
                        "sport": "football",
                        "league": competition.get("name", ""),
                        "match_format": competition.get("name", ""),
                        "venue": m.get("venue", ""),
                        "match_date": m.get("utcDate", ""),
                        "status": status,
                        "team1": {
                            "name": home.get("name", ""),
                            "score": str(ft.get("home", "")) if ft.get("home") is not None else "",
                        },
                        "team2": {
                            "name": away.get("name", ""),
                            "score": str(ft.get("away", "")) if ft.get("away") is not None else "",
                        },
                        "match_status_text": status_raw,
                    }

                    if status == "live":
                        all_live.append(entry)
                    elif status == "upcoming":
                        all_upcoming.append(entry)

        except Exception as e:
            print(f"Error fetching {sport} matches: {e}")

    return {
        "live": all_live,
        "upcoming": all_upcoming,
    }


@router.get("/scorecard/{sport}/{match_id}")
async def get_match_scorecard(sport: str, match_id: str):
    """
    Get scorecard for a match by sport and match_id directly.
    Used by the Live Matches list (not tied to a room).
    """
    try:
        adapter = get_adapter(sport)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown sport: {sport}")

    try:
        if hasattr(adapter, "set_match_context"):
            adapter.set_match_context("")
        match_data = await adapter.get_match_score(match_id)
        if not match_data:
            return {"scorecard": None}
        normalized = adapter.normalize_score(match_data, "")
        return {"scorecard": normalized}
    except Exception as e:
        return {"scorecard": None, "error": str(e)}
