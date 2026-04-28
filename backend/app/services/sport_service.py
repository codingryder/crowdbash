from abc import ABC, abstractmethod
from typing import List, Dict, Any


class SportAdapter(ABC):
    """Abstract base for sport-specific data and scoring."""

    @abstractmethod
    async def get_live_matches(self) -> List[Dict[str, Any]]:
        """Get all live matches for this sport."""
        ...

    @abstractmethod
    async def get_match_score(self, match_id: str) -> Dict[str, Any]:
        """Get current score/state for a match."""
        ...

    @abstractmethod
    async def get_match_players(self, match_id: str) -> List[Dict[str, Any]]:
        """Get players. Returns normalized: [{player_id, player_name, team, role}]"""
        ...

    @abstractmethod
    def calculate_player_points(
        self,
        player_id: str,
        match_data: dict,
        weightage: int,
        player_name: str = "",
        player_role: str = "",
        player_team: str = "",
    ) -> tuple[int, dict]:
        """
        Calculate points for a player.
        Returns (total_points, scoring_breakdown).
        scoring_breakdown is sport-specific: {"runs": 45} or {"goals": 2, "assists": 1}

        player_role / player_team are used by some sports (e.g. football for
        the clean-sheet bonus on DEF / GK). Cricket ignores them.
        """
        ...

    @abstractmethod
    def normalize_score(self, match_data: dict, room_name: str) -> dict:
        """Normalize API score data to frontend-expected format."""
        ...

    @abstractmethod
    def extract_match_progress(self, match_data: dict) -> dict:
        """Extract progress. Cricket: {"over": 23.4}. Football: {"half": 2, "minute": 67}"""
        ...

    @abstractmethod
    def is_edit_window(self, current_progress: dict, last_edit_progress: dict) -> bool:
        """Check if edit window should open based on match progress."""
        ...

    @abstractmethod
    def get_edit_trigger(self, current_progress: dict) -> str:
        """Return human-readable edit trigger: 'over_25' or 'halftime'."""
        ...

    @abstractmethod
    def format_match_summary(self, match_data: dict, room_name: str) -> dict:
        """
        Extract a complete match summary from API data.
        Called when a match finishes — result is stored in room.match_progress.
        """
        ...

    @abstractmethod
    def is_match_finished(self, match_data: dict) -> bool:
        """Check if a match has finished based on API response data."""
        ...

    @abstractmethod
    def get_quiz_context(self, match_data: dict, room_name: str) -> dict:
        """Build context dict for quiz generation prompt."""
        ...


def get_adapter(sport: str) -> SportAdapter:
    """Factory: returns the correct adapter for a sport."""
    if sport == "cricket":
        from app.services.cricket_service import CricketAdapter
        return CricketAdapter()
    elif sport == "football":
        from app.services.football_service import FootballAdapter
        return FootballAdapter()
    else:
        raise ValueError(f"Unknown sport: {sport}")
