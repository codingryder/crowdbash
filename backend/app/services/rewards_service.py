"""
Rewards service: signup bonus, daily check-in, tier multipliers.

Coin earning rules (live):
  - Signup bonus: 50 coins, one-time, on first OTP verification
  - Daily check-in: 10 coins/day (× tier multiplier), one claim per UTC day
  - Top-3 finish: 100 / 50 / 25 coins (× tier multiplier), per room

Tiers are based on lifetime EARNED coins (sum of credit transactions),
not the current spendable balance — so redeeming doesn't demote you.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from app.models.user import User
from app.models.coin import CoinTransaction
import uuid

SIGNUP_BONUS = 50
DAILY_CHECKIN_BASE = 10

# (name, lifetime_earned threshold, multiplier on top-3 + daily payouts)
TIER_THRESHOLDS = [
    ("Bronze", 0, 1.0),
    ("Silver", 500, 1.25),
    ("Gold", 2000, 1.5),
    ("Platinum", 5000, 2.0),
]


def get_tier(lifetime_earned: int) -> dict:
    """Return current tier + the next tier's distance for a given lifetime earned."""
    current = TIER_THRESHOLDS[0]
    next_tier = None
    for i, t in enumerate(TIER_THRESHOLDS):
        if lifetime_earned >= t[1]:
            current = t
            next_tier = TIER_THRESHOLDS[i + 1] if i + 1 < len(TIER_THRESHOLDS) else None
        else:
            break
    out = {
        "name": current[0],
        "threshold": current[1],
        "multiplier": current[2],
        "lifetime_earned": lifetime_earned,
        "next": None,
    }
    if next_tier:
        out["next"] = {
            "name": next_tier[0],
            "threshold": next_tier[1],
            "multiplier": next_tier[2],
            "remaining": next_tier[1] - lifetime_earned,
        }
    return out


async def get_lifetime_earned(db: AsyncSession, user_id) -> int:
    """Sum of CREDIT transactions only — redemptions don't demote tier."""
    res = await db.execute(
        select(func.coalesce(func.sum(CoinTransaction.delta), 0))
        .where(
            CoinTransaction.user_id == user_id,
            CoinTransaction.delta > 0,
        )
    )
    return int(res.scalar() or 0)


async def get_tier_multiplier(db: AsyncSession, user_id) -> float:
    earned = await get_lifetime_earned(db, user_id)
    return get_tier(earned)["multiplier"]


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def has_claimed_today(db: AsyncSession, user_id) -> bool:
    res = await db.execute(
        select(CoinTransaction).where(
            CoinTransaction.user_id == user_id,
            CoinTransaction.reason == f"daily_checkin:{_today_key()}",
        )
    )
    return res.scalar_one_or_none() is not None


async def get_current_streak(db: AsyncSession, user_id) -> int:
    """
    How many consecutive UTC days ending today (or yesterday if today not yet
    claimed) the user has claimed. Computed by walking the daily ledger
    backwards from the most recent claim.
    """
    res = await db.execute(
        select(CoinTransaction.reason)
        .where(
            CoinTransaction.user_id == user_id,
            CoinTransaction.reason.like("daily_checkin:%"),
        )
        .order_by(CoinTransaction.created_at.desc())
        .limit(120)
    )
    reasons = [r[0] for r in res.all()]
    if not reasons:
        return 0
    # Parse "daily_checkin:YYYY-MM-DD" → date
    from datetime import date, timedelta
    claim_dates = sorted(
        {
            datetime.strptime(r.split(":", 1)[1], "%Y-%m-%d").date()
            for r in reasons
            if ":" in r
        },
        reverse=True,
    )
    if not claim_dates:
        return 0
    today = datetime.now(timezone.utc).date()
    # Streak still alive if last claim was today or yesterday
    if claim_dates[0] not in (today, today - timedelta(days=1)):
        return 0
    streak = 1
    for i in range(1, len(claim_dates)):
        if claim_dates[i] == claim_dates[i - 1] - timedelta(days=1):
            streak += 1
        else:
            break
    return streak


async def award_signup_bonus(db: AsyncSession, user: User) -> bool:
    """
    Credit 50 coins on first OTP verification. Idempotent via the
    coin_tx_unique_award constraint on (user_id, room_id, reason).
    Returns True if newly awarded, False if user already received it.
    Caller is responsible for committing.
    """
    existing = await db.execute(
        select(CoinTransaction).where(
            CoinTransaction.user_id == user.id,
            CoinTransaction.reason == "signup",
        )
    )
    if existing.scalar_one_or_none() is not None:
        return False
    db.add(
        CoinTransaction(
            user_id=user.id,
            room_id=None,
            delta=SIGNUP_BONUS,
            reason="signup",
        )
    )
    user.lifetime_coins = (user.lifetime_coins or 0) + SIGNUP_BONUS
    return True


class DailyCheckinError(Exception):
    pass


async def claim_daily_checkin(db: AsyncSession, user: User) -> dict:
    """
    Claim today's daily bonus. Idempotent per UTC calendar day via the
    unique constraint on reason. Multiplier is applied based on the
    user's current tier. Caller commits.
    """
    today = _today_key()
    reason = f"daily_checkin:{today}"

    existing = await db.execute(
        select(CoinTransaction).where(
            CoinTransaction.user_id == user.id,
            CoinTransaction.reason == reason,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise DailyCheckinError("already claimed today")

    multiplier = await get_tier_multiplier(db, user.id)
    delta = int(round(DAILY_CHECKIN_BASE * multiplier))

    db.add(
        CoinTransaction(
            user_id=user.id,
            room_id=None,
            delta=delta,
            reason=reason,
        )
    )
    user.lifetime_coins = (user.lifetime_coins or 0) + delta

    return {
        "awarded": delta,
        "base": DAILY_CHECKIN_BASE,
        "multiplier": multiplier,
    }
