from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import create_jwt, get_current_user_id
from app.models.user import User
from app.models.room import Room
from app.models.game import Game
from app.services.email_service import generate_otp, send_otp_email
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
import uuid

router = APIRouter()


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str = ""


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class SigninRequest(BaseModel):
    email: EmailStr


@router.post("/signup")
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user and send OTP to email."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()

    if existing and existing.email_verified:
        raise HTTPException(status_code=400, detail="Email already registered. Use sign in instead.")

    otp = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    if existing:
        # Update existing unverified user
        existing.first_name = body.first_name
        existing.last_name = body.last_name
        existing.phone = body.phone
        existing.otp_code = otp
        existing.otp_expires_at = expires
        user = existing
    else:
        # Create new user
        username = f"{body.first_name.lower()}_{body.last_name.lower()}"[:50]
        # Ensure unique username
        check = await db.execute(select(User).where(User.username == username))
        if check.scalar_one_or_none():
            username = f"{username}_{str(uuid.uuid4())[:4]}"

        user = User(
            first_name=body.first_name,
            last_name=body.last_name,
            email=body.email,
            phone=body.phone,
            username=username,
            otp_code=otp,
            otp_expires_at=expires,
        )
        db.add(user)

    await db.commit()

    # Send OTP email
    sent = await send_otp_email(body.email, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send verification email")

    return {"message": "OTP sent to your email", "email": body.email}


@router.post("/signin")
async def signin(body: SigninRequest, db: AsyncSession = Depends(get_db)):
    """Send OTP to existing user's email for sign in."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Email not found. Please sign up first.")

    otp = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    user.otp_code = otp
    user.otp_expires_at = expires
    await db.commit()

    sent = await send_otp_email(body.email, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send verification email")

    return {"message": "OTP sent to your email", "email": body.email}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and return JWT token."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.otp_code or not user.otp_expires_at:
        raise HTTPException(status_code=400, detail="No OTP pending. Request a new one.")

    if datetime.now(timezone.utc) > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    if user.otp_code != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Mark email as verified
    user.email_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    await db.commit()

    # Generate JWT
    token = create_jwt(str(user.id))

    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "phone": user.phone,
            "username": user.username,
            "payment_status": user.payment_status,
        },
    }


@router.get("/me")
async def get_me(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "total_games": user.total_games,
        "total_wins": user.total_wins,
        "weightage_balance": user.weightage_balance,
        "payment_status": user.payment_status,
    }


class UpdateProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None


@router.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.first_name is not None:
        user.first_name = body.first_name.strip()
    if body.last_name is not None:
        user.last_name = body.last_name.strip()
    if body.username is not None:
        new_username = body.username.strip().lower()
        if new_username != user.username:
            existing = await db.execute(select(User).where(User.username == new_username))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username already taken")
            user.username = new_username

    await db.commit()
    return {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "message": "Profile updated",
    }


@router.get("/me/past-games")
async def get_my_past_games(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Past games the current user took part in. One row per match,
    most-recent first. Includes the user's own rank/points and the
    total number of players in that game so the UI can show
    "You came 2nd of 5".
    """
    rows = await db.execute(
        select(Game, Room)
        .join(Room, Room.id == Game.room_id)
        .where(
            Game.user_id == user_id,
            Room.status.in_(["closed", "completed"]),
        )
        .order_by(Room.completed_at.desc().nullslast(), Room.created_at.desc())
    )
    history = []
    for game, room in rows.all():
        total_players_q = await db.execute(
            select(func.count(Game.id)).where(Game.room_id == room.id)
        )
        total_players = total_players_q.scalar() or 0
        history.append({
            "room_id": str(room.id),
            "match_name": room.match_name,
            "league": room.league,
            "sport": room.sport,
            "completed_at": room.completed_at.isoformat() if room.completed_at else None,
            "your_rank": game.rank,
            "your_points": game.total_points or 0,
            "total_players": total_players,
            "you_won": game.rank == 1 and (game.total_points or 0) > 0,
        })
    return history
