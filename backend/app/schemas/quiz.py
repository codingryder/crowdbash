from pydantic import BaseModel
from typing import Optional, List


class QuizQuestionResponse(BaseModel):
    id: str
    question: str
    options: List[str]
    expires_at: Optional[str] = None


class QuizAnswerResponse(BaseModel):
    is_correct: bool
    correct_index: int
    points_earned: int
