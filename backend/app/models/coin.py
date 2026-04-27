from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class CoinTransaction(Base):
    __tablename__ = "coin_transactions"
    __table_args__ = (
        UniqueConstraint("user_id", "room_id", "reason", name="coin_tx_unique_award"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    room_id = Column(UUID(as_uuid=True), nullable=True)
    delta = Column(Integer, nullable=False)
    reason = Column(String(64), nullable=False)
    rank = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Reward(Base):
    __tablename__ = "rewards"
    __table_args__ = (CheckConstraint("coin_cost > 0", name="reward_cost_positive"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku = Column(String(64), unique=True, nullable=False)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    coin_cost = Column(Integer, nullable=False)
    stock = Column(Integer, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Redemption(Base):
    __tablename__ = "redemptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    reward_id = Column(UUID(as_uuid=True), nullable=False)
    coins_spent = Column(Integer, nullable=False)
    code = Column(String(120), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    fulfilled_at = Column(DateTime(timezone=True), nullable=True)
