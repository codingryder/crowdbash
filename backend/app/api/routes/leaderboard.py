from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.user import User
from app.models.room import Room
from app.models.game import Game, PlayerWeightage
from datetime import datetime, timezone
import uuid

router = APIRouter()


@router.get("/{room_id}")
async def get_room_leaderboard(
    room_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    Leaderboard for a room.

    Includes every user who has built a team (>=11 players selected),
    not just those with points. Ordering:
      - Room is 'open' (pre-match): by join order (Game.created_at asc)
      - Room is 'locked'/'closed' (match in progress or done): by points desc,
        with join order as the tiebreak
    """
    room_uuid = uuid.UUID(room_id)

    room_result = await db.execute(select(Room).where(Room.id == room_uuid))
    room = room_result.scalar_one_or_none()
    if not room:
        return []
    pre_match = room.status == "open"
    # Strategy/team-composition reveals are gated on match start time, not just
    # room.status — so opponents can't peek at picks before the first ball.
    match_started = bool(room.match_date and room.match_date <= datetime.now(timezone.utc))

    # Count selected players per game so we can gate on "team built"
    selected_counts_subq = (
        select(
            PlayerWeightage.game_id,
            func.count(PlayerWeightage.id).label("selected_count"),
        )
        .where(PlayerWeightage.selected == True)
        .group_by(PlayerWeightage.game_id)
        .subquery()
    )

    games_query = (
        select(Game, User, selected_counts_subq.c.selected_count)
        .join(User, User.id == Game.user_id)
        .outerjoin(selected_counts_subq, selected_counts_subq.c.game_id == Game.id)
        .where(Game.room_id == room_uuid)
        .order_by(Game.created_at.asc())
    )
    # Once the match has started, anyone who didn't lock their squad is a
    # spectator — exclude them from the leaderboard so the rankings reflect
    # only people actually playing the game.
    if not pre_match:
        games_query = games_query.where(Game.squad_locked == True)
    games_result = await db.execute(games_query)
    rows = games_result.all()

    enriched = []
    for game, user, selected_count in rows:
        username = (
            user.username
            or (f"{user.first_name}_{user.last_name[0]}" if user.first_name and user.last_name else user.first_name)
            or f"Player_{str(user.id)[:6]}"
        )

        # Top 2 weighted players for strategy string. Withheld pre-match so
        # opponents can't see each other's picks before the first ball.
        strategy = ""
        if match_started:
            try:
                pw_result = await db.execute(
                    select(PlayerWeightage)
                    .where(
                        PlayerWeightage.game_id == game.id,
                        PlayerWeightage.selected == True,
                    )
                    .order_by(PlayerWeightage.weightage.desc())
                    .limit(2)
                )
                parts = []
                for p in pw_result.scalars().all():
                    short_name = p.player_name.split()[-1] if p.player_name else "?"
                    parts.append(f"{p.weightage}x {short_name}")
                strategy = ", ".join(parts)
            except Exception:
                pass

        enriched.append({
            "user_id": str(user.id),
            "username": username,
            "first_name": user.first_name or "",
            "points": game.total_points or 0,
            "strategy": strategy,
            "team_built": (selected_count or 0) >= 11,
            "joined_at": game.created_at.isoformat() if game.created_at else None,
        })

    if not pre_match:
        # Match started — rank by points, join time as tiebreak (already join-ordered)
        enriched.sort(key=lambda e: -e["points"])

    return enriched[:limit]
