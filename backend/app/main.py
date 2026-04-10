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
    broadcasts updates via WebSocket, recalculates game points,
    and generates AI commentary from score changes.
    """
    from sqlalchemy import select
    from app.models.room import Room
    from app.services.commentary_service import detect_cricket_changes, generate_commentary
    from app.core.redis import redis_get_json, redis_set_json

    while True:
        await asyncio.sleep(30)  # Poll every 30 seconds for faster live updates
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

                    # Set match context for Gemini fallback
                    if hasattr(adapter, 'set_match_context'):
                        adapter.set_match_context(room.match_name)

                    match_data = await adapter.get_match_score(room.match_id)
                    if not match_data:
                        continue

                    # Auto-lock all unlocked squads when match is live
                    from app.models.game import Game as GameModel
                    unlock_result = await db.execute(
                        select(GameModel).where(
                            GameModel.room_id == room.id,
                            GameModel.squad_locked == False,
                            GameModel.status == "active",
                        )
                    )
                    for unlocked_game in unlock_result.scalars().all():
                        unlocked_game.squad_locked = True
                        from datetime import datetime as dt2, timezone as tz2
                        unlocked_game.squad_locked_at = dt2.now(tz2.utc)

                    # Check if match has finished — ONLY trust ESPN for status
                    match_finished = False
                    try:
                        from app.services.espn_service import get_espn_match_status
                        espn_status = await get_espn_match_status(
                            room.match_name, room.sport, room.league or ""
                        )
                        if espn_status and espn_status.get("is_finished"):
                            match_finished = True
                            print(f"[ESPN] Match finished: {room.match_name}")
                    except Exception as e:
                        print(f"ESPN status check error: {e}")

                    # Fallback: CricketData.org 'ms' field (not Gemini)
                    if not match_finished:
                        match_finished = adapter.is_match_finished(match_data)
                    if match_finished:
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

                    # Generate AI commentary from score changes (cricket)
                    if room.sport == "cricket":
                        try:
                            cache_key = f"prev_score:{room.id}"
                            prev_score = await redis_get_json(cache_key) or {}
                            events = detect_cricket_changes(prev_score, match_data)

                            if events and normalized:
                                batting = normalized.get("current_batting", [])
                                bowling = normalized.get("current_bowling", [])
                                commentaries = await generate_commentary(
                                    room.match_name, events, batting, bowling
                                )
                                for comm in commentaries:
                                    await room_manager.broadcast(str(room.id), {
                                        "type": "match_event",
                                        "payload": comm,
                                    })

                            # Save current score for next comparison
                            await redis_set_json(cache_key, {
                                "score": match_data.get("score", []),
                            }, ex=600)
                        except Exception as e:
                            print(f"Commentary error for {room.match_name}: {e}")

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
                                if not _is_allowed_cricket(league, mformat):
                                    continue
                                status = "live"
                                # Extract team names for matching
                                team1_clean = re.sub(r'\s*\[.*?\]', '', t1).strip().lower()
                                team2_clean = re.sub(r'\s*\[.*?\]', '', t2).strip().lower()
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
                                team1_clean = home.lower()
                                team2_clean = away.lower()
                            else:
                                continue

                            if not mid:
                                continue

                            # Check if room already exists by API match_id
                            existing_result = await db.execute(
                                select(Room).where(Room.match_id == str(mid))
                            )
                            existing_room = existing_result.scalar_one_or_none()

                            if existing_room:
                                # Room exists — verify with ESPN before reactivating
                                if existing_room.status != "live" and status == "live":
                                    # Double-check with ESPN (the truth source)
                                    espn_confirmed = False
                                    try:
                                        from app.services.espn_service import get_espn_match_status
                                        espn_status = await get_espn_match_status(
                                            existing_room.match_name, sport, existing_room.league or ""
                                        )
                                        if espn_status and espn_status.get("is_live"):
                                            espn_confirmed = True
                                    except Exception:
                                        # ESPN unavailable — fall back to date check
                                        from datetime import date as date_cls
                                        match_date = existing_room.match_date
                                        is_today = match_date and match_date.date() == date_cls.today() if match_date else False

                                        if is_today:
                                            espn_confirmed = True

                                    if espn_confirmed:
                                        existing_room.status = "live"
                                        existing_room.completed_at = None
                                        print(f"Room sync: reactivated '{existing_room.match_name}' to live (ESPN/date confirmed)")
                                    else:
                                        print(f"Room sync: skipped reactivation of '{existing_room.match_name}' (ESPN says not live)")
                                continue

                            # Check if an upcoming room exists for these teams by name
                            all_upcoming = await db.execute(
                                select(Room).where(
                                    Room.sport == sport,
                                    Room.status == "upcoming",
                                )
                            )
                            matched_room = None
                            for r in all_upcoming.scalars().all():
                                rname = r.match_name.lower()
                                if team1_clean and team2_clean and team1_clean in rname and team2_clean in rname:
                                    matched_room = r
                                    break

                            if matched_room:
                                matched_room.match_id = str(mid)
                                matched_room.status = "live"
                                matched_room.completed_at = None
                                if venue:
                                    matched_room.venue = venue
                                print(f"Room sync: updated '{matched_room.match_name}' to live with API ID {mid}")
                            else:
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


async def auto_complete_past_matches():
    """
    Auto-complete matches whose date has passed.
    Runs every 10 minutes. Marks 'upcoming' rooms as 'completed'
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
                        Room.status == "upcoming",
                        Room.match_date != None,
                        Room.match_date < cutoff,
                    )
                )
                stale_rooms = result.scalars().all()
                for room in stale_rooms:
                    room.status = "completed"
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
    asyncio.create_task(auto_complete_past_matches())
    asyncio.create_task(keep_alive())
