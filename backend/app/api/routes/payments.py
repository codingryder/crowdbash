from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.payment import Payment
from app.models.user import User
from app.services.payment_service import create_order, verify_payment_signature
from pydantic import BaseModel
import uuid

router = APIRouter()


class CreateOrderRequest(BaseModel):
    room_id: str
    amount_paise: int
    weightage_granted: int


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/create-order")
async def create_payment_order(
    body: CreateOrderRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a Razorpay order for weightage purchase."""
    receipt = f"cb_{user_id}_{body.room_id}"[:40]
    order = await create_order(body.amount_paise, receipt)

    payment = Payment(
        user_id=user_id,
        room_id=uuid.UUID(body.room_id),
        razorpay_order_id=order["id"],
        amount_paise=body.amount_paise,
        weightage_granted=body.weightage_granted,
    )
    db.add(payment)
    await db.commit()

    return {"order_id": order["id"], "amount": body.amount_paise}


@router.post("/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Verify Razorpay payment and grant weightage."""
    is_valid = verify_payment_signature(
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    result = await db.execute(
        select(Payment).where(Payment.razorpay_order_id == body.razorpay_order_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.razorpay_payment_id = body.razorpay_payment_id
    payment.status = "paid"

    # Grant weightage to user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.weightage_balance += payment.weightage_granted

    await db.commit()

    return {"status": "paid", "weightage_granted": payment.weightage_granted}
