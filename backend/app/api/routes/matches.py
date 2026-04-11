"""
Public endpoints for live match data — separate from rooms.
These return raw match data from sport APIs, not admin-created rooms.
"""
from fastapi import APIRouter, HTTPException
from app.services.sport_service import get_adapter

router = APIRouter()


@router.get("/live")
async def get_live_matches():
    """
    Get all live + upcoming matches from sport APIs.
    CricketData already returns curated current matches.
    Football-Data returns matches from major leagues only.
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
                    ms = m.get("ms", "")
                    # Skip finished matches
                    if ms == "result":
                        continue

                    score_list = m.get("score", [])

                    # Build score strings from score array
                    team1_score = ""
                    team2_score = ""
                    t1_name = m.get("t1", "")
                    t2_name = m.get("t2", "")

                    if score_list:
                        for s in score_list:
                            inning = s.get("inning", "")
                            score_str = f"{s.get('r', 0)}/{s.get('w', 0)} ({s.get('o', 0)} ov)"
                            # Match inning to team by checking team name in inning string
                            if t1_name and t1_name.lower() in inning.lower():
                                team1_score = score_str
                            elif t2_name and t2_name.lower() in inning.lower():
                                team2_score = score_str
                            else:
                                # Fallback: first inning = team1, second = team2
                                if not team1_score:
                                    team1_score = score_str
                                elif not team2_score:
                                    team2_score = score_str

                    # Use match name to extract league/series context
                    match_name = m.get("name", f"{t1_name} vs {t2_name}")
                    match_format = m.get("matchType", "")
                    # series_id is often a numeric ID, not useful for display
                    # Use matchType as the format label instead
                    league_label = match_format.upper() if match_format else ""

                    entry = {
                        "match_id": m.get("id", ""),
                        "match_name": match_name,
                        "sport": "cricket",
                        "league": league_label,
                        "match_format": match_format,
                        "venue": m.get("venue", ""),
                        "match_date": m.get("dateTimeGMT", ""),
                        "status": ms,
                        "team1": {
                            "name": t1_name,
                            "score": team1_score,
                        },
                        "team2": {
                            "name": t2_name,
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
