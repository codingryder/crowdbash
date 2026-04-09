from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class MatchEvent(Base):
    __tablename__ = "match_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"))
    event_type = Column(String(30), nullable=False)
    player_id = Column(String(100), nullable=True)
    player_name = Column(String(100), nullable=True)
    team = Column(String(50), nullable=True)
    minute = Column(Integer, nullable=True)
    over_number = Column(Numeric(4, 1), nullable=True)
    details = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
