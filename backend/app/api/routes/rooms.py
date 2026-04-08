from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.room import Room
import uuid

router = APIRouter()


@router.get("/")
async def list_rooms(db: AsyncSession = Depends(get_db)):
    """List all rooms, newest first."""
    result = await db.execute(
        select(Room).order_by(Room.created_at.desc())
    )
    rooms = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "match_id": r.match_id,
            "match_name": r.match_name,
            "match_format": r.match_format,
            "venue": r.venue,
            "status": r.status,
            "current_over": float(r.current_over) if r.current_over else 0,
            "fan_count": r.fan_count,
        }
        for r in rooms
    ]


@router.get("/{room_id}")
async def get_room(room_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific room."""
    result = await db.execute(
        select(Room).where(Room.id == uuid.UUID(room_id))
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "id": str(room.id),
        "match_id": room.match_id,
        "match_name": room.match_name,
        "match_format": room.match_format,
        "venue": room.venue,
        "status": room.status,
        "current_over": float(room.current_over) if room.current_over else 0,
        "fan_count": room.fan_count,
    }
