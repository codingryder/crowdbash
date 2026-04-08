from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.game import Game, PlayerWeightage
from app.models.room import Room
from app.services.game_service import update_weightages, is_edit_window_open
from app.services.cricket_service import get_match_players
from pydantic import BaseModel
import uuid
from typing import List

router = APIRouter()


class WeightageUpdate(BaseModel):
    player_id: str
    weightage: int


class UpdateWeightagesRequest(BaseModel):
    weightages: List[WeightageUpdate]


@router.post("/join/{room_id}")
async def join_game(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Join a game in a room. Creates game + initial weightages."""
    # Check room exists
    room_result = await db.execute(
        select(Room).where(Room.id == uuid.UUID(room_id))
    )
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check if already joined
    existing = await db.execute(
        select(Game).where(
            Game.room_id == uuid.UUID(room_id),
            Game.user_id == user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already joined this room")

    # Create game
    game = Game(room_id=uuid.UUID(room_id), user_id=user_id)
    db.add(game)
    await db.flush()

    # Fetch players and create initial weightages (all 0)
    players = await get_match_players(room.match_id)
    for team in players:
        team_name = team.get("teamName", "")
        for player in team.get("players", []):
            pw = PlayerWeightage(
                game_id=game.id,
                player_id=player.get("id", ""),
                player_name=player.get("name", ""),
                team=team_name[:10],
            )
            db.add(pw)

    await db.commit()
    return {"game_id": str(game.id), "message": "Joined successfully"}


@router.get("/{room_id}")
async def get_game_state(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current game state for a user in a room."""
    result = await db.execute(
        select(Game).where(
            Game.room_id == uuid.UUID(room_id),
            Game.user_id == user_id
        )
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    wt_result = await db.execute(
        select(PlayerWeightage).where(PlayerWeightage.game_id == game.id)
    )
    weightages = wt_result.scalars().all()

    return {
        "id": str(game.id),
        "room_id": str(game.room_id),
        "user_id": str(game.user_id),
        "mode": game.mode,
        "total_points": game.total_points,
        "extra_weightage_used": game.extra_weightage_used,
        "status": game.status,
        "rank": game.rank,
        "player_weightages": [
            {
                "player_id": pw.player_id,
                "player_name": pw.player_name,
                "team": pw.team,
                "weightage": pw.weightage,
                "points_earned": pw.points_earned,
            }
            for pw in weightages
        ],
    }


@router.put("/{room_id}/weightages")
async def update_game_weightages(
    room_id: str,
    body: UpdateWeightagesRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update weightage distribution during edit window."""
    result = await db.execute(
        select(Game).where(
            Game.room_id == uuid.UUID(room_id),
            Game.user_id == user_id
        )
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Get current over from room
    room_result = await db.execute(
        select(Room).where(Room.id == uuid.UUID(room_id))
    )
    room = room_result.scalar_one_or_none()
    current_over = float(room.current_over) if room and room.current_over else 0

    changes = await update_weightages(
        db, game.id, user_id,
        [w.model_dump() for w in body.weightages],
        current_over
    )
    return {"changes": changes}
