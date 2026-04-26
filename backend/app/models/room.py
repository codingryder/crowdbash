from sqlalchemy import Column, String, Integer, Numeric, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id = Column(String(100), nullable=False)
    match_name = Column(String(200), nullable=False)
    match_format = Column(String(100))
    venue = Column(String(200))
    status = Column(String(20), default="open")
    current_over = Column(Numeric(4, 1), default=0)
    fan_count = Column(Integer, default=0)
    sport = Column(String(20), nullable=False, default="cricket")
    league = Column(String(100), nullable=True)
    season = Column(String(20), nullable=True)
    match_progress = Column(JSONB, default={})
    match_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    admin_created = Column(Boolean, default=False)
    # Persisted reshuffle window state so reload/reconnect users still see
    # the active window with correct remaining time. NULL when no window is
    # active. Set on open, cleared on close.
    edit_window_closes_at = Column(DateTime(timezone=True), nullable=True)
