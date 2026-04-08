from fastapi import APIRouter
from app.services.cricket_service import get_live_matches, get_match_score, get_match_players

router = APIRouter()


@router.get("/live")
async def live_matches():
    """Get all live cricket matches from CricAPI (cached)."""
    matches = await get_live_matches()
    return matches


@router.get("/score/{match_id}")
async def match_score(match_id: str):
    """Get score for a specific match (cached)."""
    score = await get_match_score(match_id)
    return score


@router.get("/players/{match_id}")
async def match_players(match_id: str):
    """Get playing XI for a match (cached)."""
    players = await get_match_players(match_id)
    return players
