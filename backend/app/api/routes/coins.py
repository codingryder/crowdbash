from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User
from app.models.coin import CoinTransaction, Reward, Redemption
from app.services.coin_service import redeem_reward, RedemptionError
from app.services.rewards_service import (
    DAILY_CHECKIN_BASE,
    SIGNUP_BONUS,
    DailyCheckinError,
    claim_daily_checkin,
    get_current_streak,
    get_lifetime_earned,
    get_tier,
    has_claimed_today,
)
import uuid

router = APIRouter()


@router.get("/balance")
async def get_balance(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Rich payload: spendable balance, tier with multiplier, daily-checkin status.
    The frontend's coin pill reads `lifetime_coins`; everything else is for the
    Rewards page. Backwards-compatible with the old `{lifetime_coins}` shape.
    """
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    earned = await get_lifetime_earned(db, user_id)
    tier = get_tier(earned)
    claimed_today = await has_claimed_today(db, user_id)
    streak = await get_current_streak(db, user_id)
    return {
        "lifetime_coins": user.lifetime_coins,
        "lifetime_earned": earned,
        "tier": tier,
        "daily": {
            "claimed_today": claimed_today,
            "current_streak": streak,
            "base": DAILY_CHECKIN_BASE,
            "next_amount": int(round(DAILY_CHECKIN_BASE * tier["multiplier"])),
        },
        "rules": {
            "signup_bonus": SIGNUP_BONUS,
            "daily_base": DAILY_CHECKIN_BASE,
            "top_finish": {"1": 100, "2": 50, "3": 25},
        },
    }


@router.post("/daily-checkin")
async def daily_checkin(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Claim today's daily bonus. One per UTC calendar day."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    try:
        result = await claim_daily_checkin(db, user)
    except DailyCheckinError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    streak = await get_current_streak(db, user_id)
    return {
        **result,
        "current_streak": streak,
        "new_balance": user.lifetime_coins,
    }


@router.get("/transactions")
async def list_transactions(
    limit: int = 50,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(CoinTransaction)
            .where(CoinTransaction.user_id == user_id)
            .order_by(CoinTransaction.created_at.desc())
            .limit(min(limit, 200))
        )
    ).scalars().all()
    return [
        {
            "id": str(t.id),
            "delta": t.delta,
            "reason": t.reason,
            "rank": t.rank,
            "room_id": str(t.room_id) if t.room_id else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in rows
    ]


@router.get("/rewards")
async def list_rewards(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Reward).where(Reward.active == True).order_by(Reward.coin_cost.asc())
        )
    ).scalars().all()
    return [
        {
            "id": str(r.id),
            "sku": r.sku,
            "title": r.title,
            "description": r.description,
            "coin_cost": r.coin_cost,
            "stock": r.stock,
        }
        for r in rows
    ]


@router.post("/rewards/{reward_id}/redeem")
async def redeem(
    reward_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        reward_uuid = uuid.UUID(reward_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid reward id")

    try:
        redemption = await redeem_reward(db, user_id, reward_uuid)
    except RedemptionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": str(redemption.id),
        "reward_id": str(redemption.reward_id),
        "coins_spent": redemption.coins_spent,
        "status": redemption.status,
        "code": redemption.code,
    }


@router.get("/redemptions")
async def list_redemptions(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Redemption)
            .where(Redemption.user_id == user_id)
            .order_by(Redemption.created_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": str(r.id),
            "reward_id": str(r.reward_id),
            "coins_spent": r.coins_spent,
            "status": r.status,
            "code": r.code,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "fulfilled_at": r.fulfilled_at.isoformat() if r.fulfilled_at else None,
        }
        for r in rows
    ]
