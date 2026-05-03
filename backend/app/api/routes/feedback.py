from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text as sql_text
from app.core.database import get_db
from app.core.security import get_optional_user_id
from app.api.routes.admin import get_admin_user
from app.models.feedback import UserFeedback
from app.models.user import User
from pydantic import BaseModel, Field
from typing import Any
import uuid

router = APIRouter()

ALLOWED_CATEGORIES = {
    "general",
    "joining",
    "team_building",
    "power_allocation",
    "edit_window",
    "scorecard",
    "playing_xi",
    "quiz",
    "leaderboard",
    "chat",
    "rewards",
    "performance",
    "bug",
}

ALLOWED_SEVERITIES = {"low", "medium", "high", "critical"}


class FeedbackSubmit(BaseModel):
    room_id: str | None = None
    sport: str = "cricket"
    category: str = "general"
    severity: str | None = None
    nps: int | None = Field(default=None, ge=0, le=10)
    message: str = Field(min_length=1, max_length=4000)
    contact: str | None = Field(default=None, max_length=200)
    answers: dict[str, Any] | None = None


@router.post("/submit")
async def submit_feedback(
    body: FeedbackSubmit,
    request: Request,
    user_id: uuid.UUID | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Capture a user feedback / issue report. Auth optional."""
    category = body.category if body.category in ALLOWED_CATEGORIES else "general"
    severity = body.severity if body.severity in ALLOWED_SEVERITIES else None

    room_uuid: uuid.UUID | None = None
    if body.room_id:
        try:
            room_uuid = uuid.UUID(body.room_id)
        except (ValueError, TypeError):
            room_uuid = None

    username: str | None = None
    if user_id is not None:
        u = await db.execute(select(User).where(User.id == user_id))
        user = u.scalar_one_or_none()
        if user is not None:
            username = (user.username or user.email or "")[:100] or None

    user_agent = request.headers.get("user-agent", "")[:400] or None

    fb = UserFeedback(
        room_id=room_uuid,
        user_id=user_id,
        username=username,
        contact=(body.contact or None),
        sport=(body.sport or "cricket")[:20],
        category=category,
        severity=severity,
        nps=body.nps,
        message=body.message.strip(),
        answers=body.answers,
        user_agent=user_agent,
    )
    db.add(fb)
    try:
        await db.commit()
    except Exception as e:
        # Heal a missing table once and retry — mirrors the chat_messages pattern.
        await db.rollback()
        await db.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS user_feedback (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                username VARCHAR(100),
                contact VARCHAR(200),
                sport VARCHAR(20) NOT NULL DEFAULT 'cricket',
                category VARCHAR(40) NOT NULL DEFAULT 'general',
                severity VARCHAR(20),
                nps INT,
                message TEXT NOT NULL,
                answers JSONB,
                user_agent VARCHAR(400),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await db.commit()
        db.add(UserFeedback(
            room_id=room_uuid,
            user_id=user_id,
            username=username,
            contact=(body.contact or None),
            sport=(body.sport or "cricket")[:20],
            category=category,
            severity=severity,
            nps=body.nps,
            message=body.message.strip(),
            answers=body.answers,
            user_agent=user_agent,
        ))
        try:
            await db.commit()
        except Exception as inner:
            print(f"Feedback persist failed (final): {inner}; original: {e}")
            raise HTTPException(status_code=500, detail="Could not save feedback")

    return {"ok": True, "id": str(fb.id)}


@router.get("")
async def list_feedback(
    sport: str | None = None,
    category: str | None = None,
    limit: int = 100,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only listing of recent feedback."""
    q = select(UserFeedback).order_by(UserFeedback.created_at.desc()).limit(min(max(limit, 1), 500))
    if sport:
        q = q.where(UserFeedback.sport == sport)
    if category:
        q = q.where(UserFeedback.category == category)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": str(r.id),
            "room_id": str(r.room_id) if r.room_id else None,
            "user_id": str(r.user_id) if r.user_id else None,
            "username": r.username,
            "contact": r.contact,
            "sport": r.sport,
            "category": r.category,
            "severity": r.severity,
            "nps": r.nps,
            "message": r.message,
            "answers": r.answers,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
