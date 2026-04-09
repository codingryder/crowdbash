from pydantic import BaseModel
from typing import Optional, Dict, Any


class RoomResponse(BaseModel):
    id: str
    match_id: str
    match_name: str
    match_format: Optional[str] = None
    venue: Optional[str] = None
    status: str
    current_over: float
    fan_count: int
    sport: str
    league: Optional[str] = None
    season: Optional[str] = None
    match_progress: Dict[str, Any] = {}

    class Config:
        from_attributes = True
