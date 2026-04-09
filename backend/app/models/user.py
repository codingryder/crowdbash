from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False)
    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    email_verified = Column(Boolean, default=False)
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    avatar_url = Column(Text, nullable=True)
    total_games = Column(Integer, default=0)
    total_wins = Column(Integer, default=0)
    weightage_balance = Column(Integer, default=0)
    payment_status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
