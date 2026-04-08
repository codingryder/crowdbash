from pydantic import BaseModel
from typing import Optional


class RoomResponse(BaseModel):
    id: str
    match_id: str
    match_name: str
    match_format: Optional[str] = None
    venue: Optional[str] = None
    status: str
    current_over: float
    fan_count: int

    class Config:
        from_attributes = True
