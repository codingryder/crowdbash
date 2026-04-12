from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.websocket import room_manager
from app.api.routes import auth, rooms, game, quiz, leaderboard, payments, cricket
from app.api.routes import sports, admin, matches
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
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])


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
                import uuid as _uuid
                from datetime import datetime, timezone
                payload = msg.get("payload", {})
                chat_msg = {
                    "id": str(_uuid.uuid4()),
                    "user_id": payload.get("user_id", ""),
                    "username": payload.get("username", "Anonymous"),
                    "message": payload.get("message", ""),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                await room_manager.broadcast(room_id, {
                    "type": "chat",
                    "payload": chat_msg,
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
    broadcasts updates via WebSocket and recalculates game points.
    """
    from sqlalchemy import select
    from app.models.room import Room

    while True:
        await asyncio.sleep(30)  # Poll every 30 seconds for faster live updates
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Room).where(Room.status == "locked")
                )
                live_rooms = result.scalars().all()

                for room in live_rooms:
                    try:
                        adapter = get_adapter(room.sport)
                    except ValueError:
                        continue

                    # Set match context for Gemini fallback
                    if hasattr(adapter, 'set_match_context'):
                        adapter.set_match_context(room.match_name)

                    # ── ESPN status check (truth source) ──
                    try:
                        from app.services.espn_service import get_espn_match_status
                        espn_status = await get_espn_match_status(
                            room.match_name, room.sport, room.league or ""
                        )
                        if espn_status and espn_status.get("is_finished"):
                            print(f"ESPN: {room.match_name} is FINISHED")
                            from datetime import datetime as _dt, timezone as _tz
                            room.status = "closed"
                            room.completed_at = _dt.now(_tz.utc)
                            # Fetch final score for summary
                            final_data = await adapter.get_match_score(room.match_id)
                            if final_data:
                                try:
                                    room.match_progress = adapter.format_match_summary(final_data, room.match_name)
                                except Exception:
                                    room.match_progress = {"status": "closed"}
                                await calculate_and_update_points(db, str(room.id), room.match_id, final_data, room.sport)
                                await room_manager.broadcast(str(room.id), {
                                    "type": "score_update",
                                    "payload": {"sport": room.sport, "data": final_data}
                                })
                            else:
                                room.match_progress = {"status": "closed"}
                            continue
                    except Exception as e:
                        print(f"ESPN check error for {room.match_name}: {e}")

                    match_data = await adapter.get_match_score(room.match_id)
                    if not match_data or not match_data.get("score"):
                        continue  # Skip if no actual score data

                    # Auto-lock unlocked squads that have 11 players selected
                    from app.models.game import Game as GameModel, PlayerWeightage as PW
                    from sqlalchemy import func as sqfunc
                    unlock_result = await db.execute(
                        select(GameModel).where(
                            GameModel.room_id == room.id,
                            GameModel.squad_locked == False,
                            GameModel.status == "active",
                        )
                    )
                    for unlocked_game in unlock_result.scalars().all():
                        # Only auto-lock if they have 11 players selected
                        pw_count = await db.execute(
                            select(sqfunc.count()).where(
                                PW.game_id == unlocked_game.id,
                                PW.selected == True,
                            )
                        )
                        count = pw_count.scalar() or 0
                        if count >= 11:
                            unlocked_game.squad_locked = True
                            from datetime import datetime as dt2, timezone as tz2
                            unlocked_game.squad_locked_at = dt2.now(tz2.utc)
                        else:
                            print(f"Skipping auto-lock for game {unlocked_game.id}: only {count}/11 players")

                    # Check if match has finished via adapter (CricketData/Football-Data source)
                    match_finished = adapter.is_match_finished(match_data)
                    if match_finished:
                        room.status = "closed"
                        from datetime import datetime, timezone
                        room.completed_at = datetime.now(timezone.utc)
                        try:
                            summary = adapter.format_match_summary(match_data, room.match_name)
                            room.match_progress = summary
                        except Exception as e:
                            print(f"Failed to format summary for {room.match_name}: {e}")
                            room.match_progress = {"status": "closed"}
                        await room_manager.broadcast(str(room.id), {
                            "type": "score_update",
                            "payload": {"sport": room.sport, "data": match_data}
                        })
                        continue

                    # Normalize and broadcast score update
                    try:
                        normalized = adapter.normalize_score(match_data, room.match_name)
                    except Exception:
                        normalized = match_data
                    await room_manager.broadcast(str(room.id), {
                        "type": "score_update",
                        "payload": {
                            "sport": room.sport,
                            "data": normalized,
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
    Auto-lock open rooms when match starts.
    - Locks 'open' rooms when match_date is reached or ESPN says match is live
    - Closes rooms when ESPN says match is finished
    """
    from sqlalchemy import select
    from app.models.room import Room
    from datetime import datetime, timezone, timedelta

    while True:
        await asyncio.sleep(60)  # every 1 minute for faster auto-lock
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                # Auto-lock open rooms whose match_date is within 30 min from now
                open_rooms = await db.execute(
                    select(Room).where(
                        Room.status == "open",
                        Room.match_date != None,
                        Room.match_date <= now + timedelta(minutes=30),
                        Room.match_date >= now - timedelta(hours=4),
                    )
                )
                locked = 0
                closed_early = 0
                for room in open_rooms.scalars().all():
                    # Verify with ESPN before locking
                    try:
                        from app.services.espn_service import get_espn_match_status
                        espn = await get_espn_match_status(room.match_name, room.sport, room.league or "")
                        if espn:
                            if espn.get("is_finished"):
                                room.status = "closed"
                                room.completed_at = now
                                closed_early += 1
                                continue
                            elif espn.get("is_live"):
                                room.status = "locked"
                                locked += 1
                                continue
                    except Exception:
                        pass
                    # Default: time-based lock
                    room.status = "locked"
                    locked += 1

                if locked or closed_early:
                    await db.commit()
                    if locked:
                        print(f"Room sync: locked {locked} rooms (match started)")
                    if closed_early:
                        print(f"Room sync: closed {closed_early} rooms (ESPN says finished)")
        except Exception as e:
            print(f"Room sync error: {e}")


async def auto_close_past_rooms():
    """
    Auto-close rooms whose match date has long passed.
    Runs every 10 minutes. Closes 'open' or 'locked' rooms
    if their match_date is more than 4 hours in the past.
    """
    from sqlalchemy import select
    from app.models.room import Room
    from datetime import datetime, timezone, timedelta

    while True:
        await asyncio.sleep(600)  # every 10 minutes
        try:
            async with AsyncSessionLocal() as db:
                cutoff = datetime.now(timezone.utc) - timedelta(hours=4)
                result = await db.execute(
                    select(Room).where(
                        Room.status.in_(["open", "locked"]),
                        Room.match_date != None,
                        Room.match_date < cutoff,
                    )
                )
                stale_rooms = result.scalars().all()
                for room in stale_rooms:
                    room.status = "closed"
                    room.completed_at = datetime.now(timezone.utc)

                if stale_rooms:
                    await db.commit()
                    print(f"Auto-completed {len(stale_rooms)} past matches")
        except Exception as e:
            print(f"Auto-complete error: {e}")


async def keep_alive():
    """Ping self every 10 minutes to prevent Render free tier from sleeping."""
    import httpx
    while True:
        await asyncio.sleep(600)  # 10 minutes
        try:
            async with httpx.AsyncClient() as client:
                await client.get("https://crowdbash.onrender.com/health", timeout=10)
        except Exception:
            pass


@app.on_event("startup")
async def startup():
    # Warm up DB connection on startup
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))
            print("DB connection warmed up")
    except Exception as e:
        print(f"DB warmup failed: {e}")

    asyncio.create_task(score_poller())
    asyncio.create_task(room_sync())
    asyncio.create_task(auto_close_past_rooms())
    asyncio.create_task(keep_alive())
