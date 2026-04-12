from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.game import Game, PlayerWeightage
from app.models.room import Room
from app.models.match_squad import MatchSquad
from app.services.game_service import update_weightages
from app.services.sport_service import get_adapter
from pydantic import BaseModel
import uuid
from typing import List
from datetime import datetime, timezone

router = APIRouter()

TOTAL_BUDGET = 33
MAX_SQUAD_SIZE = 11


class SelectSquadRequest(BaseModel):
    player_ids: List[str]


class WeightageUpdate(BaseModel):
    player_id: str
    weightage: int


class UpdateWeightagesRequest(BaseModel):
    weightages: List[WeightageUpdate]


@router.post("/join/{room_id}")
async def join_game(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Join a game in a room."""
    room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    existing = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already joined this room")

    game = Game(room_id=uuid.UUID(room_id), user_id=user_id, total_budget=TOTAL_BUDGET)
    db.add(game)
    await db.commit()
    return {"game_id": str(game.id), "message": "Joined! Now select your 11 players."}


@router.get("/{room_id}/squads")
async def get_available_squads(
    room_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get available squads. Auto-fetches from API if not in DB."""
    result = await db.execute(
        select(MatchSquad).where(MatchSquad.room_id == uuid.UUID(room_id))
    )
    squads = result.scalars().all()

    if not squads:
        room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
        room = room_result.scalar_one_or_none()
        if room:
            try:
                adapter = get_adapter(room.sport)
                if hasattr(adapter, 'set_match_context'):
                    adapter.set_match_context(room.match_name)
                api_players = await adapter.get_match_players(room.match_id)
                for p in api_players:
                    sq = MatchSquad(
                        room_id=uuid.UUID(room_id),
                        player_id=p.get("player_id", ""),
                        player_name=p.get("player_name", ""),
                        team=p.get("team", ""),
                        player_role=p.get("role", ""),
                    )
                    db.add(sq)
                await db.commit()
                result = await db.execute(
                    select(MatchSquad).where(MatchSquad.room_id == uuid.UUID(room_id))
                )
                squads = result.scalars().all()
            except Exception as e:
                print(f"Failed to fetch squads from API: {e}")

    teams: dict = {}
    for s in squads:
        if s.team not in teams:
            teams[s.team] = []
        teams[s.team].append({
            "player_id": s.player_id,
            "player_name": s.player_name,
            "team": s.team,
            "player_role": s.player_role or "",
        })

    return {"teams": teams, "total_players": len(squads)}


@router.post("/{room_id}/select-squad")
async def select_squad(
    room_id: str,
    body: SelectSquadRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Select 11 players. Only allowed BEFORE match starts."""
    if len(body.player_ids) != MAX_SQUAD_SIZE:
        raise HTTPException(status_code=400, detail=f"Must select exactly {MAX_SQUAD_SIZE} players.")

    # Check room status — player changes only before match
    room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()
    if room and room.status == "locked":
        raise HTTPException(status_code=400, detail="Match has started. Player changes are no longer allowed.")

    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Join the room first")

    # Allow re-selection if room is still open (match hasn't started)
    if game.squad_locked and room and room.status != "open":
        raise HTTPException(status_code=400, detail="Match has started. Squad is locked.")

    # Unlock squad if room is still open (user is re-editing)
    if game.squad_locked and room and room.status == "open":
        game.squad_locked = False
        game.squad_locked_at = None

    # Validate players exist in squads
    squad_result = await db.execute(
        select(MatchSquad).where(MatchSquad.room_id == uuid.UUID(room_id))
    )
    available = {s.player_id: s for s in squad_result.scalars().all()}
    for pid in body.player_ids:
        if pid not in available:
            raise HTTPException(status_code=400, detail=f"Player {pid} not in match squads")

    # Clear previous selections using bulk DELETE
    from sqlalchemy import delete
    await db.execute(delete(PlayerWeightage).where(PlayerWeightage.game_id == game.id))
    await db.flush()

    for pid in body.player_ids:
        s = available[pid]
        pw = PlayerWeightage(
            game_id=game.id,
            player_id=s.player_id,
            player_name=s.player_name,
            team=s.team[:10],
            player_role=s.player_role,
            selected=True,
            weightage=0,
        )
        db.add(pw)

    await db.commit()
    return {"message": "Squad selected! Now allocate weightage points.", "players": len(body.player_ids)}


@router.post("/{room_id}/lock-squad")
async def lock_squad(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually lock squad before match (optional — auto-locks when match starts)."""
    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.squad_locked:
        raise HTTPException(status_code=400, detail="Already locked")

    wt_result = await db.execute(
        select(PlayerWeightage).where(PlayerWeightage.game_id == game.id, PlayerWeightage.selected == True)
    )
    weightages = wt_result.scalars().all()
    if len(weightages) != MAX_SQUAD_SIZE:
        raise HTTPException(status_code=400, detail="Select 11 players first")

    total = sum(w.weightage for w in weightages)
    if total != TOTAL_BUDGET:
        raise HTTPException(status_code=400, detail=f"Weightages must total {TOTAL_BUDGET}. Currently {total}.")

    game.squad_locked = True
    game.squad_locked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Squad locked! Good luck!"}


@router.get("/{room_id}")
async def get_game_state(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get full game state including room status for lock rules."""
    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    room_result = await db.execute(select(Room).where(Room.id == game.room_id))
    room = room_result.scalar_one_or_none()

    wt_result = await db.execute(select(PlayerWeightage).where(PlayerWeightage.game_id == game.id))
    weightages = wt_result.scalars().all()

    # Determine if editing is allowed
    match_started = room and room.status == "locked"
    can_edit_players = not match_started and not game.squad_locked
    can_edit_weightages = not match_started or False  # During match: only in edit window (handled by frontend)

    return {
        "id": str(game.id),
        "room_id": str(game.room_id),
        "user_id": str(game.user_id),
        "mode": game.mode,
        "total_points": game.total_points,
        "extra_weightage_used": game.extra_weightage_used,
        "status": game.status,
        "rank": game.rank,
        "squad_locked": game.squad_locked,
        "total_budget": game.total_budget,
        "match_started": match_started,
        "can_edit_players": can_edit_players,
        "can_edit_weightages": can_edit_weightages,
        "player_weightages": [
            {
                "player_id": pw.player_id,
                "player_name": pw.player_name,
                "team": pw.team,
                "weightage": pw.weightage,
                "points_earned": pw.points_earned,
                "player_role": pw.player_role,
                "scoring_breakdown": pw.scoring_breakdown or {},
                "selected": pw.selected,
            }
            for pw in weightages
        ],
    }


@router.put("/{room_id}/weightages")
async def update_game_weightages(
    room_id: str,
    body: UpdateWeightagesRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Update weightages.
    Before match: free to change anytime.
    During match: only in 2-min edit window after every 5 overs.
    """
    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    total = sum(w.weightage for w in body.weightages)
    if total > game.total_budget:
        raise HTTPException(status_code=400, detail=f"Total weightage {total} exceeds budget {game.total_budget}")

    room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()

    adapter = get_adapter(room.sport)
    progress = room.match_progress or {}
    edit_trigger = adapter.get_edit_trigger(progress)

    changes = await update_weightages(
        db, game.id, user_id,
        [w.model_dump() for w in body.weightages],
        edit_trigger,
    )
    return {"changes": changes}
