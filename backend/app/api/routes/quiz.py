from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.quiz import QuizQuestion, QuizAnswer
from app.services.quiz_service import generate_quiz_question
from pydantic import BaseModel
import uuid

router = APIRouter()


class AnswerRequest(BaseModel):
    question_id: str
    selected_index: int


@router.get("/{room_id}/current")
async def get_current_quiz(
    room_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get the latest quiz question for a room."""
    result = await db.execute(
        select(QuizQuestion)
        .where(QuizQuestion.room_id == uuid.UUID(room_id))
        .order_by(QuizQuestion.created_at.desc())
        .limit(1)
    )
    question = result.scalar_one_or_none()
    if not question:
        return None
    return {
        "id": str(question.id),
        "question": question.question,
        "options": question.options,
        "expires_at": question.expires_at.isoformat() if question.expires_at else None,
    }


@router.post("/answer")
async def submit_answer(
    body: AnswerRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Submit a quiz answer."""
    question_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.id == uuid.UUID(body.question_id))
    )
    question = question_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Check if already answered
    existing = await db.execute(
        select(QuizAnswer).where(
            QuizAnswer.question_id == question.id,
            QuizAnswer.user_id == user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already answered")

    is_correct = body.selected_index == question.correct_index
    points = 50 if is_correct else 0

    answer = QuizAnswer(
        question_id=question.id,
        user_id=user_id,
        selected_index=body.selected_index,
        is_correct=is_correct,
        points_earned=points,
    )
    db.add(answer)
    await db.commit()

    return {
        "is_correct": is_correct,
        "correct_index": question.correct_index,
        "points_earned": points,
    }
