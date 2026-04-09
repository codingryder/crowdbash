from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class PlayerWeightageResponse(BaseModel):
    player_id: str
    player_name: str
    team: str
    weightage: int
    points_earned: int
    player_role: Optional[str] = None
    scoring_breakdown: Dict[str, Any] = {}


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
