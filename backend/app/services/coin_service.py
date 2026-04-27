from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.coin import CoinTransaction, Reward, Redemption
import uuid


class RedemptionError(Exception):
    pass


async def redeem_reward(
    db: AsyncSession, user_id: uuid.UUID, reward_id: uuid.UUID
) -> Redemption:
    """
    Atomic debit + redemption record. Locks user and reward rows
    to prevent races on balance/stock.
    """
    user = (
        await db.execute(select(User).where(User.id == user_id).with_for_update())
    ).scalar_one_or_none()
    if user is None:
        raise RedemptionError("user not found")

    reward = (
        await db.execute(
            select(Reward).where(Reward.id == reward_id).with_for_update()
        )
    ).scalar_one_or_none()
    if reward is None or not reward.active:
        raise RedemptionError("reward unavailable")
    if reward.stock is not None and reward.stock <= 0:
        raise RedemptionError("out of stock")
    if user.lifetime_coins < reward.coin_cost:
        raise RedemptionError("insufficient coins")

    user.lifetime_coins -= reward.coin_cost
    if reward.stock is not None:
        reward.stock -= 1

    redemption = Redemption(
        user_id=user_id,
        reward_id=reward_id,
        coins_spent=reward.coin_cost,
        status="pending",
    )
    db.add(redemption)
    await db.flush()

    db.add(
        CoinTransaction(
            user_id=user_id,
            room_id=None,
            delta=-reward.coin_cost,
            reason=f"redemption:{redemption.id}",
        )
    )
    await db.commit()
    await db.refresh(redemption)
    return redemption
