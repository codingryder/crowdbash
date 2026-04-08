from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.websocket import room_manager
from app.api.routes import auth, rooms, game, quiz, leaderboard, payments, cricket
from app.services.game_service import calculate_and_update_points
from app.services.cricket_service import get_match_score, extract_current_over
from app.core.database import AsyncSessionLocal
import asyncio
import json

app = FastAPI(title="Crowdbash API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(cricket.router, prefix="/api/cricket", tags=["cricket"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await room_manager.connect(websocket, room_id)
    try:
        await room_manager.broadcast(room_id, {
            "type": "fan_count",
            "payload": {"count": room_manager.get_fan_count(room_id)}
        })

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg["type"] == "ping":
                await room_manager.send_to_user(websocket, {"type": "pong"})
            elif msg["type"] == "chat":
                await room_manager.broadcast(room_id, {
                    "type": "chat",
                    "payload": msg["payload"]
                })

    except WebSocketDisconnect:
        room_manager.disconnect(websocket, room_id)
        await room_manager.broadcast(room_id, {
            "type": "fan_count",
            "payload": {"count": room_manager.get_fan_count(room_id)}
        })


async def score_poller():
    """
    Polls CricAPI for live scores and broadcasts to all active rooms.
    Runs every 60 seconds. Designed to stay within 100 calls/day free limit.
    """
    from sqlalchemy import select
    from app.models.room import Room

    while True:
        await asyncio.sleep(60)
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Room).where(Room.status == "live")
                )
                live_rooms = result.scalars().all()

                for room in live_rooms:
                    scorecard = await get_match_score(room.match_id)
                    if not scorecard:
                        continue

                    await room_manager.broadcast(str(room.id), {
                        "type": "score_update",
                        "payload": scorecard
                    })

                    await calculate_and_update_points(
                        db, str(room.id), room.match_id, scorecard
                    )

                    current_over = extract_current_over(scorecard)
                    if current_over != float(room.current_over or 0):
                        room.current_over = current_over
                        over_int = int(current_over)
                        if over_int > 0 and over_int % 5 == 0 and current_over == over_int:
                            await room_manager.broadcast(str(room.id), {
                                "type": "over_complete",
                                "payload": {
                                    "over": current_over,
                                    "edit_window_open": True
                                }
                            })

                await db.commit()
        except Exception as e:
            print(f"Score poller error: {e}")


@app.on_event("startup")
async def startup():
    asyncio.create_task(score_poller())
