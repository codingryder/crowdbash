from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Game(Base):
    __tablename__ = "games"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    mode = Column(String(10), default="room")
    opponent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    total_points = Column(Integer, default=0)
    extra_weightage_used = Column(Integer, default=0)
    status = Column(String(20), default="active")
    rank = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PlayerWeightage(Base):
    __tablename__ = "player_weightages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"))
    player_id = Column(String(100), nullable=False)
    player_name = Column(String(100), nullable=False)
    team = Column(String(10), nullable=False)
    weightage = Column(Integer, nullable=False, default=0)
    points_earned = Column(Integer, default=0)
    player_role = Column(String(30), nullable=True)
    scoring_breakdown = Column(JSONB, default={})
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class WeightageEdit(Base):
    __tablename__ = "weightage_edits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"))
    over_number = Column(Numeric(4, 1), nullable=False)
    changes = Column(JSONB, nullable=False)
    edit_trigger = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
