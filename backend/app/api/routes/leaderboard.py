from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.game_service import get_leaderboard
from app.core.database import get_db
from app.models.user import User
from app.models.game import Game, PlayerWeightage
import uuid

router = APIRouter()


@router.get("/{room_id}")
async def get_room_leaderboard(
    room_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get enriched leaderboard for a room — usernames + strategy."""
    entries = await get_leaderboard(room_id, limit)
    if not entries:
        return []

    enriched = []
    for entry in entries:
        user_id = entry["user_id"]
        points = entry["points"]

        # Get user info
        username = f"Player_{user_id[:6]}"
        first_name = ""
        try:
            user_result = await db.execute(
                select(User).where(User.id == uuid.UUID(user_id))
            )
            u = user_result.scalar_one_or_none()
            if u:
                username = u.username or f"{u.first_name}_{u.last_name[0]}" if u.last_name else u.first_name or username
                first_name = u.first_name or ""
        except Exception:
            pass

        # Get top 2 weighted players for strategy string
        strategy = ""
        try:
            game_result = await db.execute(
                select(Game).where(
                    Game.room_id == uuid.UUID(room_id),
                    Game.user_id == uuid.UUID(user_id),
                )
            )
            g = game_result.scalar_one_or_none()
            if g:
                pw_result = await db.execute(
                    select(PlayerWeightage).where(
                        PlayerWeightage.game_id == g.id,
                        PlayerWeightage.selected == True,
                    ).order_by(PlayerWeightage.weightage.desc()).limit(2)
                )
                top_players = pw_result.scalars().all()
                parts = []
                for p in top_players:
                    short_name = p.player_name.split()[-1] if p.player_name else "?"
                    parts.append(f"{p.weightage}x {short_name}")
                strategy = ", ".join(parts)
        except Exception:
            pass

        enriched.append({
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "points": points,
            "strategy": strategy,
        })

    return enriched
