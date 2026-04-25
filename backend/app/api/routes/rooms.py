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
        "match_date": r.match_date.isoformat() if r.match_date else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }


# IMPORTANT: /leagues MUST be defined before /{room_id} to avoid path conflict
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

    sorted_leagues = sorted(
        leagues.values(),
        key=lambda x: (-x["live_rooms"], -x["total_rooms"])
    )

    return sorted_leagues


@router.get("/")
async def list_rooms(
    sport: Optional[str] = Query(None, description="Filter by sport"),
    league: Optional[str] = Query(None, description="Filter by league name"),
    status: Optional[str] = Query(None, description="Filter by status"),
    admin_created: Optional[bool] = Query(None, description="Filter by admin-created rooms only"),
    db: AsyncSession = Depends(get_db),
):
    """List rooms sorted by match_date (latest first)."""
    query = select(Room).order_by(Room.match_date.desc().nullslast(), Room.created_at.desc())
    if sport:
        query = query.where(Room.sport == sport)
    if league:
        query = query.where(Room.league == league)
    if status:
        query = query.where(Room.status == status)
    if admin_created is not None:
        query = query.where(Room.admin_created == admin_created)
    result = await db.execute(query)
    rooms = result.scalars().all()
    return [_room_to_dict(r) for r in rooms]


@router.get("/scorecard/{room_id}")
async def get_scorecard(room_id: str, db: AsyncSession = Depends(get_db)):
    """Get live scorecard for a room from the sport API."""
    from app.services.sport_service import get_adapter
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid room ID")
    result = await db.execute(select(Room).where(Room.id == rid))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    try:
        adapter = get_adapter(room.sport)
        if hasattr(adapter, 'set_match_context'):
            adapter.set_match_context(room.match_name)
        match_data = await adapter.get_match_score(room.match_id)
        if match_data:
            normalized = adapter.normalize_score(match_data, room.match_name)
            return {"scorecard": normalized}

        # Fallback for ESPN cricket pre-match (toss done but no innings yet):
        # build a stub scorecard with team names + status from the scoreboard event.
        if room.sport == "cricket" and room.match_id and room.match_id.startswith("espn_"):
            from app.api.routes.matches import _get_espn_scorecard
            event_id = room.match_id.replace("espn_", "")
            stub = await _get_espn_scorecard("cricket", event_id, room.match_name)
            if stub:
                return {"scorecard": stub}

        return {"scorecard": None}
    except Exception as e:
        return {"scorecard": None, "error": str(e)}


@router.get("/info/{room_id}")
async def get_room_match_info(room_id: str, db: AsyncSession = Depends(get_db)):
    """Detailed match metadata (toss, umpires, series, venue) for a room."""
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid room ID")
    result = await db.execute(select(Room).where(Room.id == rid))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.sport != "cricket" or not room.match_id or not room.match_id.startswith("espn_"):
        return {"info": None}

    from app.api.routes.matches import _get_espn_match_info
    event_id = room.match_id.replace("espn_", "")
    info = await _get_espn_match_info(event_id)
    return {"info": info}


@router.get("/{room_id}")
async def get_room(room_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific room."""
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid room ID")
    result = await db.execute(select(Room).where(Room.id == rid))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return _room_to_dict(room)


@router.get("/{room_id}/chat")
async def get_room_chat(
    room_id: str,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    Chat history for a room. Returned only while the room is active
    (open or locked); closed rooms return an empty list.
    """
    from app.models.chat import ChatMessage

    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid room ID")

    room_result = await db.execute(select(Room).where(Room.id == rid))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.status == "closed":
        return []

    try:
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.room_id == rid)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        return [
            {
                "id": str(m.id),
                "user_id": str(m.user_id) if m.user_id else "",
                "username": m.username,
                "message": m.message,
                "timestamp": m.created_at.isoformat() if m.created_at else None,
            }
            for m in result.scalars().all()
        ]
    except Exception as e:
        print(f"Chat history fetch failed: {e}")
        return []
