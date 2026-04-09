from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.room import Room
from typing import Optional
import uuid

router = APIRouter()


def _room_to_dict(r: Room) -> dict:
    return {
        "id": str(r.id),
        "match_id": r.match_id,
        "match_name": r.match_name,
        "match_format": r.match_format,
        "venue": r.venue,
        "status": r.status,
        "current_over": float(r.current_over) if r.current_over else 0,
        "fan_count": r.fan_count,
        "sport": r.sport,
        "league": r.league,
        "season": r.season,
        "match_progress": r.match_progress or {},
    }


@router.get("/")
async def list_rooms(
    sport: Optional[str] = Query(None, description="Filter by sport: cricket, football"),
    db: AsyncSession = Depends(get_db),
):
    """List all rooms, optionally filtered by sport."""
    query = select(Room).order_by(Room.created_at.desc())
    if sport:
        query = query.where(Room.sport == sport)
    result = await db.execute(query)
    rooms = result.scalars().all()
    return [_room_to_dict(r) for r in rooms]


@router.get("/{room_id}")
async def get_room(room_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific room."""
    result = await db.execute(
        select(Room).where(Room.id == uuid.UUID(room_id))
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return _room_to_dict(room)
