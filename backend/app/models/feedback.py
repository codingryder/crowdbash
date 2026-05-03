from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(100), nullable=True)
    contact = Column(String(200), nullable=True)
    sport = Column(String(20), nullable=False, default="cricket")
    category = Column(String(40), nullable=False, default="general")
    severity = Column(String(20), nullable=True)
    nps = Column(Integer, nullable=True)
    message = Column(Text, nullable=False)
    answers = Column(JSONB, nullable=True)
    user_agent = Column(String(400), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_feedback_room_created", "room_id", "created_at"),
        Index("idx_feedback_category_created", "category", "created_at"),
    )
