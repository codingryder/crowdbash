from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.game import Game, PlayerWeightage, WeightageEdit
from app.core.redis import redis_zadd
from app.services.sport_service import get_adapter
import uuid
from datetime import datetime

TOTAL_WEIGHTAGE_BUDGET = 33
EDIT_WINDOW_DURATION_SECONDS = 120  # 2 minutes
QUIZ_CORRECT_POINTS = 50


async def calculate_and_update_points(
    db: AsyncSession,
    room_id: str,
    match_id: str,
    match_data: dict,
    sport: str
):
    """
    Core game engine: recalculate every active game's points
    using the sport-specific adapter with full fantasy scoring.
    """
    adapter = get_adapter(sport)

    result = await db.execute(
        select(Game).where(
            Game.room_id == uuid.UUID(room_id),
            Game.status == "active",
            Game.squad_locked == True,
        )
    )
    games = result.scalars().all()

    for game in games:
        total = 0
        wt_result = await db.execute(
            select(PlayerWeightage).where(
                PlayerWeightage.game_id == game.id,
                PlayerWeightage.selected == True,
            )
        )
        weightages = wt_result.scalars().all()

        for pw in weightages:
            points, breakdown = adapter.calculate_player_points(
                pw.player_id, match_data, pw.weightage, pw.player_name
            )
            pw.points_earned = points
            pw.scoring_breakdown = breakdown
            total += points

        game.total_points = total

        # Update Redis leaderboard
        await redis_zadd(f"leaderboard:{room_id}", total, str(game.user_id))

    await db.commit()


async def is_edit_window_open(sport: str, current_progress: dict, last_edit_progress: dict) -> bool:
    """Check if edit window should open, using sport-specific logic."""
    adapter = get_adapter(sport)
    return adapter.is_edit_window(current_progress, last_edit_progress)


async def update_weightages(
    db: AsyncSession,
    game_id: uuid.UUID,
    user_id: uuid.UUID,
    new_weightages: list[dict],
    edit_trigger: str
):
    """
    Apply new weightage distribution. Validates budget (20 pts).
    Logs change to weightage_edits.
    """
    total = sum(w["weightage"] for w in new_weightages)
    if total > TOTAL_WEIGHTAGE_BUDGET:
        raise ValueError(f"Total weightage {total} exceeds budget {TOTAL_WEIGHTAGE_BUDGET}")

    changes = []
    for w in new_weightages:
        result = await db.execute(
            select(PlayerWeightage).where(
                PlayerWeightage.game_id == game_id,
                PlayerWeightage.player_id == w["player_id"],
                PlayerWeightage.selected == True,
            )
        )
        pw = result.scalar_one_or_none()
        if pw:
            old_wt = pw.weightage
            pw.weightage = w["weightage"]
            pw.updated_at = datetime.utcnow()
            changes.append({"player_id": w["player_id"], "old": old_wt, "new": w["weightage"]})

    # Log the edit
    edit = WeightageEdit(
        game_id=game_id,
        over_number=0,
        changes=changes,
        edit_trigger=edit_trigger,
    )
    db.add(edit)
    await db.commit()
    return changes


async def get_leaderboard(room_id: str, limit: int = 50) -> list:
    """Get top players from Redis sorted set."""
    from app.core.redis import redis_zrevrange
    raw = await redis_zrevrange(f"leaderboard:{room_id}", 0, limit - 1)
    result = []
    for i in range(0, len(raw), 2):
        result.append({
            "user_id": raw[i],
            "points": int(float(raw[i + 1]))
        })
    return result


async def finalize_room_results(db: AsyncSession, room_id) -> dict:
    """
    Compute final ranks for a room's games and bump user stats.

    Call when a room transitions to a terminal state ('closed' or 'completed').
    Idempotent: skips if any game in the room already has a non-null rank, so
    overlapping pollers won't double-credit. Does NOT commit — caller commits
    as part of the close transaction.

    Tie handling: dense ranking by score (e.g. 100, 100, 80 → ranks 1, 1, 3).
    Wins are only awarded if the rank-1 score is > 0 (no one wins a 0-pt game).
    """
    from app.models.user import User

    room_uuid = uuid.UUID(room_id) if isinstance(room_id, str) else room_id

    games_result = await db.execute(select(Game).where(Game.room_id == room_uuid))
    games = games_result.scalars().all()
    if not games:
        return {"ranked": 0, "winners": 0}
    if any(g.rank is not None for g in games):
        return {"ranked": 0, "winners": 0, "skipped": "already_finalized"}

    sorted_games = sorted(games, key=lambda g: -(g.total_points or 0))
    last_score: object = object()
    last_rank = 0
    for i, g in enumerate(sorted_games, start=1):
        score = g.total_points or 0
        if score != last_score:
            last_rank = i
            last_score = score
        g.rank = last_rank

    user_ids = list({g.user_id for g in games})
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    top_score = sorted_games[0].total_points or 0
    winners = 0
    for g in games:
        u = users_by_id.get(g.user_id)
        if not u:
            continue
        u.total_games = (u.total_games or 0) + 1
        if g.rank == 1 and top_score > 0:
            u.total_wins = (u.total_wins or 0) + 1
            winners += 1

    return {"ranked": len(games), "winners": winners}
