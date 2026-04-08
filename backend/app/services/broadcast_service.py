from app.api.websocket import room_manager


async def broadcast_score_update(room_id: str, scorecard: dict):
    """Broadcast live score update to all clients in a room."""
    await room_manager.broadcast(room_id, {
        "type": "score_update",
        "payload": scorecard
    })


async def broadcast_game_update(room_id: str, user_id: str, total_points: int):
    """Broadcast game point update."""
    await room_manager.broadcast(room_id, {
        "type": "game_update",
        "payload": {"user_id": user_id, "total_points": total_points}
    })


async def broadcast_leaderboard(room_id: str, leaderboard: list):
    """Broadcast leaderboard update to all clients in a room."""
    await room_manager.broadcast(room_id, {
        "type": "leaderboard_update",
        "payload": leaderboard
    })


async def broadcast_quiz(room_id: str, quiz: dict):
    """Broadcast a new quiz question to the room."""
    await room_manager.broadcast(room_id, {
        "type": "quiz_question",
        "payload": quiz
    })


async def broadcast_fan_count(room_id: str, count: int):
    """Broadcast updated fan count."""
    await room_manager.broadcast(room_id, {
        "type": "fan_count",
        "payload": {"count": count}
    })
