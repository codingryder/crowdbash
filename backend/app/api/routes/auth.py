from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id, verify_supabase_jwt
from app.models.user import User
import uuid

router = APIRouter()


@router.get("/me")
async def get_me(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user.id),
        "username": user.username,
        "avatar_url": user.avatar_url,
        "total_games": user.total_games,
        "total_wins": user.total_wins,
        "weightage_balance": user.weightage_balance,
    }


@router.post("/register")
async def register_user(
    payload: dict = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db)
):
    """Register or sync user from Supabase Auth."""
    user_id = uuid.UUID(payload["sub"])
    email = payload.get("email", "")
    username = email.split("@")[0] if email else f"user_{str(user_id)[:8]}"

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user:
        return {"id": str(user.id), "username": user.username, "exists": True}

    new_user = User(id=user_id, username=username)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return {"id": str(new_user.id), "username": new_user.username, "exists": False}
