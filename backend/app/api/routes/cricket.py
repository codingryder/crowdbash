from fastapi import APIRouter
from app.services.cricket_service import CricketAdapter

router = APIRouter()

_adapter = CricketAdapter()


@router.get("/live")
async def live_matches():
    """Get all live cricket matches (cached)."""
    matches = await _adapter.get_live_matches()
    return matches


@router.get("/score/{match_id}")
async def match_score(match_id: str):
    """Get score for a specific cricket match (cached)."""
    score = await _adapter.get_match_score(match_id)
    return score


@router.get("/players/{match_id}")
async def match_players(match_id: str):
    """Get playing XI for a cricket match (cached)."""
    players = await _adapter.get_match_players(match_id)
    return players
