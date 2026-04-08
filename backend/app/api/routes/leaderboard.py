from fastapi import APIRouter, Depends
from app.services.game_service import get_leaderboard

router = APIRouter()


@router.get("/{room_id}")
async def get_room_leaderboard(room_id: str, limit: int = 50):
    """Get leaderboard for a room from Redis."""
    entries = await get_leaderboard(room_id, limit)
    return entries
