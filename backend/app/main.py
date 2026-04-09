from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.websocket import room_manager
from app.api.routes import auth, rooms, game, quiz, leaderboard, payments, cricket
from app.api.routes import sports, admin
from app.services.game_service import calculate_and_update_points
from app.services.sport_service import get_adapter
from app.core.database import AsyncSessionLocal
import asyncio
import json

app = FastAPI(title="Crowdbash API", version="2.0.0")

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
app.include_router(sports.router, prefix="/api/sports", tags=["sports"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "sports": ["cricket", "football"]}


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
    Multi-sport score poller. Polls live matches for all sports,
    broadcasts updates via WebSocket, and recalculates game points.
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
                    try:
                        adapter = get_adapter(room.sport)
                    except ValueError:
                        continue

                    match_data = await adapter.get_match_score(room.match_id)
                    if not match_data:
                        continue

                    # Check if match has finished — save summary to DB
                    if adapter.is_match_finished(match_data):
                        room.status = "completed"
                        from datetime import datetime, timezone
                        room.completed_at = datetime.now(timezone.utc)
                        # Save full match summary into match_progress
                        try:
                            summary = adapter.format_match_summary(match_data, room.match_name)
                            room.match_progress = summary
                        except Exception as e:
                            print(f"Failed to format summary for {room.match_name}: {e}")
                            room.match_progress = {"status": "completed"}
                        await room_manager.broadcast(str(room.id), {
                            "type": "score_update",
                            "payload": {"sport": room.sport, "data": match_data}
                        })
                        continue

                    # Broadcast score update with sport context
                    await room_manager.broadcast(str(room.id), {
                        "type": "score_update",
                        "payload": {
                            "sport": room.sport,
                            "data": match_data,
                        }
                    })

                    # Recalculate game points
                    await calculate_and_update_points(
                        db, str(room.id), room.match_id, match_data, room.sport
                    )

                    # Check match progress and edit windows
                    new_progress = adapter.extract_match_progress(match_data)
                    old_progress = room.match_progress or {}

                    if new_progress != old_progress:
                        room.match_progress = new_progress

                        # Also update current_over for cricket backward compat
                        if room.sport == "cricket":
                            room.current_over = new_progress.get("over", 0)

                        # Check edit window
                        if adapter.is_edit_window(new_progress, old_progress):
                            await room_manager.broadcast(str(room.id), {
                                "type": "edit_window",
                                "payload": {
                                    "sport": room.sport,
                                    "progress": new_progress,
                                    "edit_window_open": True,
                                    "trigger": adapter.get_edit_trigger(new_progress),
                                }
                            })

                await db.commit()
        except Exception as e:
            print(f"Score poller error: {e}")


async def room_sync():
    """
    Periodically syncs live matches into rooms table.
    Runs every 5 minutes. Creates rooms for allowed leagues only.
    """
    import re
    from app.api.routes.admin import _is_allowed_cricket

    while True:
        await asyncio.sleep(300)  # every 5 minutes
        try:
            async with AsyncSessionLocal() as db:
                from app.models.room import Room
                from sqlalchemy import select

                for sport in ["cricket", "football"]:
                    try:
                        adapter = get_adapter(sport)
                        matches = await adapter.get_live_matches()
                        if not matches:
                            continue

                        for match in matches:
                            if sport == "cricket":
                                mid = match.get("id", "")
                                t1 = match.get("t1", "")
                                t2 = match.get("t2", "")
                                mname = f"{t1} vs {t2}" if t1 and t2 else "Unknown"
                                mname = re.sub(r'\s*\[.*?\]', '', mname).strip()
                                mformat = match.get("matchType", "")
                                venue = match.get("venue", "")
                                league = match.get("series", "")
                                ms = match.get("ms", "")
                                if ms != "live":
                                    continue
                                # League filter
                                if not _is_allowed_cricket(league, mformat):
                                    continue
                                status = "live"
                            elif sport == "football":
                                mid = str(match.get("id", ""))
                                home = match.get("homeTeam", {}).get("name", "")
                                away = match.get("awayTeam", {}).get("name", "")
                                mname = f"{home} vs {away}"
                                comp = match.get("competition", {})
                                mformat = comp.get("name", "")
                                venue = match.get("venue", "")
                                league = comp.get("name", "")
                                status_raw = match.get("status", "")
                                if status_raw not in ("IN_PLAY", "PAUSED"):
                                    continue
                                status = "live"
                            else:
                                continue

                            if not mid:
                                continue

                            existing = await db.execute(
                                select(Room).where(Room.match_id == str(mid))
                            )
                            if existing.scalar_one_or_none():
                                continue

                            room = Room(
                                match_id=str(mid),
                                match_name=mname,
                                match_format=mformat,
                                venue=venue,
                                sport=sport,
                                league=league,
                                status=status,
                                match_progress={},
                            )
                            db.add(room)

                            await db.commit()
                    except Exception as e:
                        print(f"Room sync error ({sport}): {e}")
        except Exception as e:
            print(f"Room sync outer error: {e}")


@app.on_event("startup")
async def startup():
    asyncio.create_task(score_poller())
    asyncio.create_task(room_sync())
