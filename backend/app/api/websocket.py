from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json


class RoomManager:
    """Manages WebSocket connections per room."""

    def __init__(self):
        # room_id -> set of WebSocket connections
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].discard(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast(self, room_id: str, message: dict):
        """Broadcast a message to all clients in a room."""
        if room_id not in self.rooms:
            return
        data = json.dumps(message)
        dead = set()
        for ws in self.rooms[room_id]:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.rooms[room_id].discard(ws)

    async def send_to_user(self, websocket: WebSocket, message: dict):
        """Send a message to a specific user."""
        await websocket.send_text(json.dumps(message))

    def get_fan_count(self, room_id: str) -> int:
        return len(self.rooms.get(room_id, set()))


room_manager = RoomManager()
