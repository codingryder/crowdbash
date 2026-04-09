from fastapi import APIRouter, HTTPException
from app.services.sport_service import get_adapter

router = APIRouter()


@router.get("/{sport}/live")
async def live_matches(sport: str):
    """Get all live matches for a sport."""
    try:
        adapter = get_adapter(sport)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown sport: {sport}")
    matches = await adapter.get_live_matches()
    return matches


@router.get("/{sport}/score/{match_id}")
async def match_score(sport: str, match_id: str):
    """Get score for a specific match."""
    try:
        adapter = get_adapter(sport)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown sport: {sport}")
    score = await adapter.get_match_score(match_id)
    return score


@router.get("/{sport}/players/{match_id}")
async def match_players(sport: str, match_id: str):
    """Get players/lineup for a match."""
    try:
        adapter = get_adapter(sport)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown sport: {sport}")
    players = await adapter.get_match_players(match_id)
    return players
