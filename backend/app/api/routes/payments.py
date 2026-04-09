from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.payment import Payment
from app.models.user import User
from pydantic import BaseModel
import uuid

router = APIRouter()

ROOM_JOIN_AMOUNT_PAISE = 1000  # ₹10


class JoinRoomPaymentRequest(BaseModel):
    room_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/create-order")
async def create_join_order(
    body: JoinRoomPaymentRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a Razorpay order for ₹10 room join fee."""
    from app.services.payment_service import create_order

    receipt = f"join_{user_id}_{body.room_id}"[:40]

    try:
        order = await create_order(ROOM_JOIN_AMOUNT_PAISE, receipt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment creation failed: {str(e)}")

    # Save payment record
    payment = Payment(
        user_id=user_id,
        room_id=uuid.UUID(body.room_id),
        razorpay_order_id=order["id"],
        amount_paise=ROOM_JOIN_AMOUNT_PAISE,
        weightage_granted=0,
    )
    db.add(payment)
    await db.commit()

    return {
        "order_id": order["id"],
        "amount": ROOM_JOIN_AMOUNT_PAISE,
        "currency": "INR",
        "key_id": (await _get_razorpay_key()),
    }


@router.post("/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Verify Razorpay payment and activate user's room access."""
    from app.services.payment_service import verify_payment_signature

    is_valid = verify_payment_signature(
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Update payment record
    result = await db.execute(
        select(Payment).where(Payment.razorpay_order_id == body.razorpay_order_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.razorpay_payment_id = body.razorpay_payment_id
    payment.status = "paid"

    # Update user payment status
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.payment_status = "paid"

    await db.commit()

    return {
        "status": "paid",
        "message": "Payment successful! You can now join rooms.",
    }


@router.get("/status")
async def payment_status(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Check if user has paid the ₹10 join fee."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "payment_status": user.payment_status,
        "has_access": user.payment_status == "paid",
    }


async def _get_razorpay_key() -> str:
    from app.core.config import settings
    return settings.RAZORPAY_KEY_ID
