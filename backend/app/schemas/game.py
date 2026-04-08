from pydantic import BaseModel
from typing import Optional, List


class PlayerWeightageResponse(BaseModel):
    player_id: str
    player_name: str
    team: str
    weightage: int
    points_earned: int


class GameResponse(BaseModel):
    id: str
    room_id: str
    user_id: str
    mode: str
    total_points: int
    extra_weightage_used: int
    status: str
    rank: Optional[int] = None
    player_weightages: List[PlayerWeightageResponse] = []

    class Config:
        from_attributes = True
