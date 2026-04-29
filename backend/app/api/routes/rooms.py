from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.room import Room
from typing import Optional
import uuid

router = APIRouter()


def _room_to_dict(r: Room) -> dict:
    from app.api.routes.game import is_late_join_open, LATE_JOIN_ROOMS
    late_join = is_late_join_open(r)
    cfg = LATE_JOIN_ROOMS.get(str(r.id)) or {}
    progress = r.match_progress or {}

    # Late-join "remaining" countdown:
    # 1. If an admin player-edit window is driving the late-join state,
    #    use that wall-clock countdown (matches the banner timer).
    # 2. Else fall back to the sport-specific cap from LATE_JOIN_ROOMS
    #    (max_over for cricket, max_minute for football).
    # NOTE: edit_window_closes_at (reshuffle) is intentionally NOT a
    # late-join trigger — reshuffle is power-only by design.
    cfg_sport = (cfg.get("sport") or r.sport or "cricket").lower()
    overs_remaining = 0.0
    minutes_remaining = 0.0
    if late_join:
        from datetime import datetime as _dt, timezone as _tz
        pe_closes_at = getattr(r, "player_edit_window_closes_at", None)
        if pe_closes_at is not None:
            ca = pe_closes_at if pe_closes_at.tzinfo else pe_closes_at.replace(tzinfo=_tz.utc)
            now_ts = _dt.now(_tz.utc)
            if ca > now_ts:
                minutes_remaining = max((ca - now_ts).total_seconds() / 60.0, 0)
        if minutes_remaining == 0.0 and cfg:
            if cfg_sport == "football":
                minute = float(progress.get("minute", 0) or 0)
                minutes_remaining = max(float(cfg.get("max_minute", 0)) - minute, 0)
            else:
                over = float(progress.get("over", 0) or 0)
                overs_remaining = max(float(cfg.get("max_over", 0)) - over, 0)

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
        "late_join_open": late_join,
        "late_join_overs_remaining": round(overs_remaining, 1),
        "late_join_minutes_remaining": round(minutes_remaining, 1),
        "edit_window_closes_at": (
            r.edit_window_closes_at.isoformat()
            if getattr(r, "edit_window_closes_at", None) else None
        ),
        "player_edit_window_closes_at": (
            r.player_edit_window_closes_at.isoformat()
            if getattr(r, "player_edit_window_closes_at", None) else None
        ),
        "playing_xi_announced_at": (
            r.playing_xi_announced_at.isoformat()
            if getattr(r, "playing_xi_announced_at", None) else None
        ),
        "playing_xi": getattr(r, "playing_xi", None),
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

    is_espn = bool(room.match_id and room.match_id.startswith("espn_"))
    espn_event_id = room.match_id.replace("espn_", "") if is_espn else ""

    try:
        # Football ESPN rooms: prefer ESPN's rich scorecard endpoint, which
        # carries league / venue / kickoff / broadcasts / recent form /
        # per-team stats. The football adapter (Football-Data.org → Gemini)
        # doesn't surface any of that, so going through it makes the in-room
        # modal much sparser than the same modal opened from the Games tab.
        if is_espn and room.sport == "football":
            from app.api.routes.matches import _get_espn_scorecard
            scorecard = await _get_espn_scorecard("football", espn_event_id, room.match_name)
            if scorecard:
                return {"scorecard": scorecard}
            # ESPN miss (wrong id, cache cold, etc.) — fall through to the
            # adapter so we at least return what Football-Data.org has.

        adapter = get_adapter(room.sport)
        if hasattr(adapter, 'set_match_context'):
            adapter.set_match_context(room.match_name, room.league or '')
        match_data = await adapter.get_match_score(room.match_id)
        if match_data:
            normalized = adapter.normalize_score(match_data, room.match_name)
            return {"scorecard": normalized}

        # Cricket ESPN pre-match fallback (toss done but no innings yet):
        # build a stub scorecard with team names + status from scoreboard.
        if is_espn and room.sport == "cricket":
            from app.api.routes.matches import _get_espn_scorecard
            stub = await _get_espn_scorecard("cricket", espn_event_id, room.match_name)
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

    if not room.match_id or not room.match_id.startswith("espn_"):
        return {"info": None}
    event_id = room.match_id.replace("espn_", "")

    if room.sport == "football":
        from app.api.routes.matches import _get_espn_football_match_info
        from app.services.espn_service import FOOTBALL_LEAGUES
        league_slug = FOOTBALL_LEAGUES.get(room.league or "")
        if not league_slug:
            return {"info": None}
        info = await _get_espn_football_match_info(event_id, league_slug)
        return {"info": info}

    if room.sport == "cricket":
        from app.api.routes.matches import _get_espn_match_info
        info = await _get_espn_match_info(event_id)
        return {"info": info}

    return {"info": None}


@router.get("/{room_id}/mvp")
async def get_room_mvp(room_id: str, db: AsyncSession = Depends(get_db)):
    """
    Top fantasy contributors in this room — players whose collective points
    earned (across everyone who picked them) are highest. Position #1 is the
    fantasy "Man of the Match" for this room. Used by the completed-match view.
    """
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid room ID")

    from app.models.game import Game, PlayerWeightage
    from sqlalchemy import func

    total_picks_subq = (
        select(func.count(Game.id))
        .where(Game.room_id == rid, Game.squad_locked == True)
        .scalar_subquery()
    )

    rows = await db.execute(
        select(
            PlayerWeightage.player_id,
            PlayerWeightage.player_name,
            PlayerWeightage.team,
            PlayerWeightage.player_role,
            func.sum(PlayerWeightage.points_earned).label("total_points"),
            func.count(PlayerWeightage.game_id).label("pick_count"),
        )
        .join(Game, Game.id == PlayerWeightage.game_id)
        .where(
            Game.room_id == rid,
            PlayerWeightage.selected == True,
            PlayerWeightage.points_earned > 0,
        )
        .group_by(
            PlayerWeightage.player_id,
            PlayerWeightage.player_name,
            PlayerWeightage.team,
            PlayerWeightage.player_role,
        )
        .order_by(func.sum(PlayerWeightage.points_earned).desc())
        .limit(5)
    )
    result = rows.all()

    total_picks_res = await db.execute(select(total_picks_subq))
    total_squads = int(total_picks_res.scalar() or 0)

    return {
        "total_squads": total_squads,
        "top_players": [
            {
                "player_id": r[0],
                "player_name": r[1],
                "team": r[2],
                "role": r[3] or "",
                "total_points": int(r[4] or 0),
                "pick_count": int(r[5] or 0),
                "pick_pct": round((int(r[5]) / total_squads) * 100) if total_squads else 0,
            }
            for r in result
        ],
    }


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
