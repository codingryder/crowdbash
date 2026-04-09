from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import uuid


class MatchSquad(Base):
    __tablename__ = "match_squads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"))
    player_id = Column(String(100), nullable=False)
    player_name = Column(String(100), nullable=False)
    team = Column(String(50), nullable=False)
    player_role = Column(String(30), nullable=True)
