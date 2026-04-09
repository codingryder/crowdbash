from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
    sport: Optional[str] = Query(None, description="Filter by sport"),
    league: Optional[str] = Query(None, description="Filter by league name"),
    status: Optional[str] = Query(None, description="Filter by status: live, upcoming, completed"),
    db: AsyncSession = Depends(get_db),
):
    """List rooms with optional filters."""
    query = select(Room).order_by(Room.created_at.desc())
    if sport:
        query = query.where(Room.sport == sport)
    if league:
        query = query.where(Room.league == league)
    if status:
        query = query.where(Room.status == status)
    result = await db.execute(query)
    rooms = result.scalars().all()
    return [_room_to_dict(r) for r in rooms]


@router.get("/leagues")
async def list_leagues(db: AsyncSession = Depends(get_db)):
    """Get all leagues grouped by sport with room counts."""
    all_result = await db.execute(select(Room))
    rooms = all_result.scalars().all()

    leagues: dict = {}
    for r in rooms:
        sp = r.sport or "cricket"
        lg = r.league or "Other"
        key = f"{sp}:{lg}"
        if key not in leagues:
            leagues[key] = {
                "sport": sp,
                "league": lg,
                "total_rooms": 0,
                "live_rooms": 0,
                "upcoming_rooms": 0,
            }
        leagues[key]["total_rooms"] += 1
        if r.status == "live":
            leagues[key]["live_rooms"] += 1
        elif r.status == "upcoming":
            leagues[key]["upcoming_rooms"] += 1

    # Sort: live rooms first, then by total
    sorted_leagues = sorted(
        leagues.values(),
        key=lambda x: (-x["live_rooms"], -x["total_rooms"])
    )

    return sorted_leagues


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
