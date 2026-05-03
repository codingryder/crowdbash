from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.websocket import room_manager
from app.api.routes import auth, rooms, game, quiz, leaderboard, payments, cricket
from app.api.routes import sports, admin, matches, coins, og, sitemap, feedback
from app.services.game_service import calculate_and_update_points, finalize_room_results
from app.services.sport_service import get_adapter
from app.services.edit_window_service import (
    ACTIVE_EDIT_WINDOWS,
    DEFAULT_EDIT_WINDOW_DURATION,
    open_edit_window,
)
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
app.include_router(coins.router, prefix="/api/coins", tags=["coins"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
# OG router uses absolute paths (/api/og/... and /share/...) — no prefix.
app.include_router(og.router, tags=["og"])
# Sitemap is served at the root path /sitemap.xml — no prefix.
app.include_router(sitemap.router, tags=["sitemap"])


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

        # If a reshuffle window is active, replay it to this freshly-connected
        # client so reload/late-arrivals don't miss the open broadcast.
        import time as _time
        active_until = ACTIVE_EDIT_WINDOWS.get(room_id, 0)
        _now = _time.time()
        if active_until > _now:
            await room_manager.send_to_user(websocket, {
                "type": "edit_window",
                "payload": {
                    "edit_window_open": True,
                    "closes_at": active_until,
                    "duration_seconds": int(active_until - _now),
                    "replay": True,
                }
            })

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg["type"] == "ping":
                await room_manager.send_to_user(websocket, {"type": "pong"})

            elif msg["type"] == "chat":
                import uuid as _uuid
                from datetime import datetime, timezone
                from app.models.chat import ChatMessage

                payload = msg.get("payload", {})
                text = (payload.get("message") or "").strip()
                if not text:
                    continue

                username = payload.get("username") or "Anonymous"
                raw_user_id = payload.get("user_id") or ""

                user_uuid = None
                try:
                    if raw_user_id:
                        user_uuid = _uuid.UUID(raw_user_id)
                except (ValueError, TypeError):
                    user_uuid = None

                try:
                    room_uuid = _uuid.UUID(room_id)
                except (ValueError, TypeError):
                    room_uuid = None

                msg_id = _uuid.uuid4()
                created_at = datetime.now(timezone.utc)

                # Persist so the chat tab can show history (room not yet closed).
                # Use raw SQL + lazy CREATE TABLE so a missing chat_messages table
                # heals itself instead of swallowing every insert silently.
                if room_uuid is not None:
                    from sqlalchemy import text as _text
                    insert_sql = _text("""
                        INSERT INTO chat_messages (id, room_id, user_id, username, message, created_at)
                        VALUES (:id, :room_id, :user_id, :username, :message, :created_at)
                    """)
                    params = {
                        "id": msg_id,
                        "room_id": room_uuid,
                        "user_id": user_uuid,
                        "username": username[:100],
                        "message": text,
                        "created_at": created_at,
                    }
                    try:
                        async with AsyncSessionLocal() as db:
                            try:
                                await db.execute(insert_sql, params)
                                await db.commit()
                            except Exception as inner:
                                # Table missing OR missing columns — heal and retry once
                                print(f"Chat insert failed, attempting heal: {inner}")
                                await db.rollback()
                                await db.execute(_text("""
                                    CREATE TABLE IF NOT EXISTS chat_messages (
                                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                                        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                                        username VARCHAR(100) NOT NULL DEFAULT 'Anonymous',
                                        message TEXT NOT NULL,
                                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                                    )
                                """))
                                await db.execute(_text(
                                    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS username VARCHAR(100) NOT NULL DEFAULT 'Anonymous'"
                                ))
                                await db.execute(_text(
                                    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message TEXT"
                                ))
                                await db.execute(_text(
                                    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL"
                                ))
                                await db.execute(_text(
                                    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
                                ))
                                await db.execute(_text("""
                                    CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
                                        ON chat_messages (room_id, created_at)
                                """))
                                await db.commit()
                                async with AsyncSessionLocal() as db2:
                                    await db2.execute(insert_sql, params)
                                    await db2.commit()
                                    print("Chat insert succeeded after heal")
                    except Exception as e:
                        print(f"Chat persist failed (final): {e}")

                chat_msg = {
                    "id": str(msg_id),
                    "user_id": raw_user_id,
                    "username": username,
                    "message": text,
                    "timestamp": created_at.isoformat(),
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


# Tracks room ids whose squad sync is currently in flight, so the score
# poller doesn't spawn a second ESPN call before the first one finishes.
_SYNCING_SQUADS: set = set()


async def score_poller():
    """
    Multi-sport score poller. Polls live matches for all sports,
    broadcasts updates via WebSocket and recalculates game points.
    """
    from sqlalchemy import select
    from app.models.room import Room

    while True:
        await asyncio.sleep(15)  # Poll every 15 seconds — keeps reshuffle-window detection lag low
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
                        adapter.set_match_context(room.match_name, room.league or '')

                    # Self-heal: any football room that's gone live without
                    # ever syncing its match-day squad gets one populated from
                    # ESPN now. Re-syncs anything older than 7 days too
                    # (transfer windows). Also re-syncs when the existing
                    # rows have unknown roles ("?") so a fix to the position
                    # mapper retroactively cleans up older synced rooms.
                    # Debounced via _SYNCING_SQUADS so we don't spawn a new
                    # ESPN/Gemini call on every 15s tick while the first one
                    # is still in flight.
                    if room.sport == "football":
                        from datetime import datetime as _dt2, timezone as _tz2, timedelta as _td2
                        from app.models.match_squad import MatchSquad as _MS
                        from sqlalchemy import or_ as _or
                        last = room.squads_last_refreshed_at
                        if last is not None and last.tzinfo is None:
                            last = last.replace(tzinfo=_tz2.utc)
                        stale = last is None or (_dt2.now(_tz2.utc) - last) > _td2(days=7)
                        # If we synced the squad before kickoff, ESPN's
                        # match-summary rosters[] would have been empty and
                        # we'd have fallen back to full first-team data
                        # (Gemini / team-roster). Now that we're past
                        # kickoff, ESPN has the announced matchday squad
                        # (starters + named subs) — trigger a re-sync to
                        # narrow the picker down so users can't pick a
                        # player who wasn't in the matchday 18.
                        if not stale and last is not None and room.match_date is not None:
                            md = room.match_date if room.match_date.tzinfo else room.match_date.replace(tzinfo=_tz2.utc)
                            if last < md:
                                stale = True
                        if not stale:
                            # Cheap check: does any row for this room have a
                            # blank or non-canonical role? If so, treat as stale.
                            empty_count = (await db.execute(
                                select(_MS).where(
                                    _MS.room_id == room.id,
                                    _or(
                                        _MS.player_role == None,
                                        _MS.player_role == "",
                                        ~_MS.player_role.in_(["GK", "DEF", "MID", "FW"]),
                                    ),
                                )
                            )).scalars().first()
                            if empty_count is not None:
                                stale = True
                        if stale and room.id not in _SYNCING_SQUADS:
                            _SYNCING_SQUADS.add(room.id)
                            from app.api.routes.admin import _populate_match_squads
                            async def _bg(rid):
                                try:
                                    async with AsyncSessionLocal() as bg_db:
                                        bg_room = (await bg_db.execute(
                                            select(Room).where(Room.id == rid)
                                        )).scalar_one_or_none()
                                        if bg_room:
                                            await _populate_match_squads(bg_db, bg_room)
                                except Exception as bg_e:
                                    print(f"Auto squad sync failed for {rid}: {bg_e}")
                                finally:
                                    _SYNCING_SQUADS.discard(rid)
                            asyncio.create_task(_bg(room.id))

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
                            await finalize_room_results(db, room.id)
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
                        await finalize_room_results(db, room.id)
                        await room_manager.broadcast(str(room.id), {
                            "type": "score_update",
                            "payload": {"sport": room.sport, "data": match_data}
                        })
                        continue

                    # Normalize and broadcast score update.
                    # For ESPN football rooms, source the broadcast from the
                    # SAME ESPN scorecard the HTTP scorecard endpoint uses.
                    # Otherwise the WS payload (adapter shape, 45s per-event
                    # cache) and the HTTP payload (all_live, 120s) fight in
                    # the frontend store and the right rail flickers
                    # between two scores every couple of seconds.
                    normalized = None
                    if (
                        room.sport == "football"
                        and room.match_id
                        and room.match_id.startswith("espn_")
                    ):
                        try:
                            from app.api.routes.matches import _get_espn_scorecard
                            espn_event_id = room.match_id.replace("espn_", "")
                            espn_payload = await _get_espn_scorecard(
                                "football", espn_event_id, room.match_name
                            )
                            if espn_payload:
                                normalized = espn_payload
                        except Exception as e:
                            print(f"WS broadcast: ESPN scorecard fetch failed for {room.match_name}: {e}")
                    if normalized is None:
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

                        # Check edit window (T20: after 10 overs per innings + innings break).
                        # Idempotency: skip auto-trigger while ANY window (admin or auto)
                        # is already active. Admin overrides remain authoritative.
                        import time as _time
                        rid_str = str(room.id)
                        active_until = ACTIVE_EDIT_WINDOWS.get(rid_str, 0)
                        if active_until <= _time.time() and adapter.is_edit_window(new_progress, old_progress):
                            trigger = adapter.get_edit_trigger(new_progress)
                            innings = new_progress.get("innings", 1)
                            over = int(float(new_progress.get("over", 0)))
                            await open_edit_window(
                                rid_str,
                                DEFAULT_EDIT_WINDOW_DURATION,
                                db=db,
                                source="auto",
                                extra_payload={
                                    "sport": room.sport,
                                    "progress": new_progress,
                                    "trigger": trigger,
                                    "innings": innings,
                                    "over": over,
                                },
                            )

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
                # Lock rooms whose scheduled match start time has actually arrived.
                # ESPN often flips state="in" early (toss / ~30 min before first ball),
                # so we deliberately don't trust ESPN's is_live here — match_date is
                # the source of truth for "match is live". ESPN is only consulted to
                # close rooms early when a match is genuinely finished.
                due_rooms = await db.execute(
                    select(Room).where(
                        Room.status == "open",
                        Room.match_date != None,
                        Room.match_date <= now,
                        Room.match_date >= now - timedelta(hours=4),
                    )
                )
                locked = 0
                closed_early = 0
                for room in due_rooms.scalars().all():
                    try:
                        from app.services.espn_service import get_espn_match_status
                        espn = await get_espn_match_status(room.match_name, room.sport, room.league or "")
                        if espn and espn.get("is_finished"):
                            room.status = "closed"
                            room.completed_at = now
                            await finalize_room_results(db, room.id)
                            closed_early += 1
                            continue
                    except Exception:
                        pass
                    room.status = "locked"
                    locked += 1

                # Self-heal: rooms previously locked too early (e.g. by the old
                # 30-min-before rule, or an ESPN toss-time is_live flip) should
                # come back to "open" if the scheduled match_date hasn't arrived
                # yet. This unblocks Edit XI for late joiners.
                stale_locked = await db.execute(
                    select(Room).where(
                        Room.status == "locked",
                        Room.match_date != None,
                        Room.match_date > now,
                    )
                )
                unlocked = 0
                for room in stale_locked.scalars().all():
                    room.status = "open"
                    unlocked += 1

                if locked or closed_early or unlocked:
                    await db.commit()
                    if locked:
                        print(f"Room sync: locked {locked} rooms (match_date reached)")
                    if closed_early:
                        print(f"Room sync: closed {closed_early} rooms (ESPN says finished)")
                    if unlocked:
                        print(f"Room sync: unlocked {unlocked} rooms (match_date not yet reached)")
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
                    await finalize_room_results(db, room.id)

                if stale_rooms:
                    await db.commit()
                    print(f"Auto-completed {len(stale_rooms)} past matches")
        except Exception as e:
            print(f"Auto-complete error: {e}")


async def _notify_xi_by_email(*, room_ids: list, xi: dict):
    """Best-effort email blast to every joinee of the given rooms.

    Per recipient: figures out how many of THEIR selected players didn't
    make the announced XI, and includes that count + a CTA back to the
    room. Errors are swallowed per-recipient.
    """
    if not room_ids:
        return
    try:
        import re
        import unicodedata
        from sqlalchemy import select as _select
        from app.models.room import Room as _Room
        from app.models.game import Game as _Game, PlayerWeightage as _PW
        from app.models.user import User as _User
        from app.services.email_service import send_playing_xi_email

        def _norm(name: str) -> str:
            n = unicodedata.normalize("NFD", (name or "").lower())
            n = "".join(c for c in n if unicodedata.category(c) != "Mn")
            n = re.sub(r"[^a-z0-9 ]", " ", n)
            return re.sub(r"\s+", " ", n).strip()

        xi_names = {_norm(n) for n in (xi.get("xi_a") or []) + (xi.get("xi_b") or [])}
        team_a = xi.get("team_a") or "Team A"
        team_b = xi.get("team_b") or "Team B"
        xi_a = list(xi.get("xi_a") or [])
        xi_b = list(xi.get("xi_b") or [])
        frontend_url = (settings.FRONTEND_URL or "").rstrip("/")

        async with AsyncSessionLocal() as db:
            rooms = (await db.execute(
                _select(_Room).where(_Room.id.in_(room_ids))
            )).scalars().all()
            room_by_id = {r.id: r for r in rooms}

            # Pull every active game in these rooms with the user's email.
            games = (await db.execute(
                _select(_Game.id, _Game.room_id, _User.email)
                .join(_User, _User.id == _Game.user_id)
                .where(_Game.room_id.in_(room_ids), _Game.status == "active", _User.email != None)
            )).all()

            # Dedupe by (email, room_id) so re-joins don't double-mail.
            seen: set = set()
            for game_id, room_id, email in games:
                if not email:
                    continue
                key = (email.lower(), room_id)
                if key in seen:
                    continue
                seen.add(key)

                room = room_by_id.get(room_id)
                if room is None:
                    continue

                # How many of this user's picks aren't in the announced XI?
                pws = (await db.execute(
                    _select(_PW.player_name).where(_PW.game_id == game_id, _PW.selected == True)
                )).scalars().all()
                benched = sum(1 for p in pws if _norm(p) not in xi_names)

                date_label = None
                if room.match_date is not None:
                    try:
                        date_label = room.match_date.strftime("%a %d %b · %H:%M UTC")
                    except Exception:
                        date_label = None

                room_url = f"{frontend_url}/room/{room.id}" if frontend_url else f"/room/{room.id}"

                try:
                    await send_playing_xi_email(
                        email,
                        match_name=room.match_name,
                        league=room.league,
                        venue=room.venue,
                        match_date_label=date_label,
                        team_a=team_a,
                        team_b=team_b,
                        xi_a=xi_a,
                        xi_b=xi_b,
                        benched_count=benched,
                        room_url=room_url,
                    )
                except Exception as send_err:
                    print(f"XI email to {email} failed: {send_err}")
    except Exception as outer:
        print(f"_notify_xi_by_email crashed: {outer}")


async def playing_xi_poller():
    """
    Poll Gemini for the announced playing XI of upcoming matches.

    Targets rooms whose match_date is within the next 90 minutes (team sheets
    typically drop ~30 min before first ball, but starting earlier covers
    delayed-start matches and gives users time to react).

    Once we get a confident XI for a fixture, the result is cached in Redis
    (per-fixture, not per-room) and persisted on every room for that fixture.
    """
    from sqlalchemy import select, update as _update
    from app.models.room import Room
    from datetime import datetime, timezone, timedelta
    from app.services.live_score_service import fetch_announced_xi_via_gemini

    while True:
        await asyncio.sleep(300)  # every 5 minutes
        try:
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                window_end = now + timedelta(minutes=90)
                # Only rooms that are still open (pre-match) AND within the
                # 90-min lookahead AND don't already have an announced XI.
                result = await db.execute(
                    select(Room).where(
                        Room.status == "open",
                        Room.match_date != None,
                        Room.match_date <= window_end,
                        Room.match_date >= now - timedelta(minutes=10),
                        Room.playing_xi == None,
                    )
                )
                pending_rooms = result.scalars().all()
                # Dedupe by match_name so two rooms for the same fixture share
                # one Gemini call (cache_key is per match_name).
                by_fixture: dict[tuple[str, str], list[Room]] = {}
                for r in pending_rooms:
                    by_fixture.setdefault((r.sport, r.match_name), []).append(r)

                announced = 0
                for (sport, match_name), rooms in by_fixture.items():
                    try:
                        xi = await fetch_announced_xi_via_gemini(match_name, sport)
                    except Exception as e:
                        print(f"XI poll error for {match_name}: {e}")
                        continue
                    if not xi:
                        continue
                    # Persist on every room sharing this fixture.
                    await db.execute(
                        _update(Room)
                        .where(Room.id.in_([r.id for r in rooms]))
                        .values(playing_xi=xi, playing_xi_announced_at=now)
                    )
                    announced += len(rooms)
                    # Notify connected clients so banner shows immediately.
                    for r in rooms:
                        await room_manager.broadcast(str(r.id), {
                            "type": "playing_xi_announced",
                            "payload": {
                                "playing_xi": xi,
                                "announced_at": now.isoformat(),
                            }
                        })

                    # Email every joinee in each room so users who aren't
                    # currently connected still get the heads-up. Best-effort:
                    # one bad address must not block the rest, and the email
                    # work runs in the background so the poller loop stays
                    # snappy. Cricket-only for now per the most recent user
                    # request — football's squad churn is handled by the
                    # ESPN re-sync above instead of an email blast.
                    if sport == "cricket":
                        asyncio.create_task(_notify_xi_by_email(
                            room_ids=[r.id for r in rooms],
                            xi=xi,
                        ))

                    # Football: now that team sheets are out, re-sync the
                    # match-day squad from ESPN so the player picker only
                    # offers starters + named subs (excluding players who
                    # didn't make the matchday 18). Cricket stays on
                    # whatever squad source it had — cricket squads don't
                    # change on team-sheet drop the way football does.
                    if sport == "football":
                        from app.api.routes.admin import _populate_match_squads
                        for r in rooms:
                            if r.id in _SYNCING_SQUADS:
                                continue
                            _SYNCING_SQUADS.add(r.id)
                            async def _bg(rid):
                                try:
                                    async with AsyncSessionLocal() as bg_db:
                                        bg_room = (await bg_db.execute(
                                            select(Room).where(Room.id == rid)
                                        )).scalar_one_or_none()
                                        if bg_room:
                                            await _populate_match_squads(bg_db, bg_room)
                                except Exception as bg_e:
                                    print(f"Post-XI squad sync failed for {rid}: {bg_e}")
                                finally:
                                    _SYNCING_SQUADS.discard(rid)
                            asyncio.create_task(_bg(r.id))

                if announced:
                    await db.commit()
                    print(f"Playing XI announced for {announced} room(s)")
        except Exception as e:
            print(f"Playing XI poller error: {e}")


async def keep_alive():
    """Ping self every 10 minutes to prevent Render free tier from sleeping."""
    import httpx
    while True:
        await asyncio.sleep(600)  # 10 minutes
        try:
            async with httpx.AsyncClient() as client:
                await client.get("https://crowdbash-xf00.onrender.com/health", timeout=10)
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

    # Self-heal: ensure chat_messages table exists with the right columns.
    # An older schema version is missing some columns, so use ALTER TABLE
    # ADD COLUMN IF NOT EXISTS to fill the gaps without dropping data.
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    username VARCHAR(100) NOT NULL DEFAULT 'Anonymous',
                    message TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            # Heal older schemas that may be missing columns
            await db.execute(text(
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS username VARCHAR(100) NOT NULL DEFAULT 'Anonymous'"
            ))
            await db.execute(text(
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message TEXT"
            ))
            await db.execute(text(
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL"
            ))
            await db.execute(text(
                "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ))
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
                    ON chat_messages (room_id, created_at)
            """))
            await db.commit()
            print("chat_messages table ensured (with column heal)")
    except Exception as e:
        print(f"chat_messages migration failed: {e}")

    # Self-heal: player_images cache (global, deduped by lowercased name).
    # Stores Wikipedia thumbnail URL per cricket/football player so we don't
    # re-hit Wikipedia for the same player across rooms.
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS player_images (
                    name_key VARCHAR(160) PRIMARY KEY,
                    display_name VARCHAR(160) NOT NULL,
                    image_url TEXT NULL,
                    source VARCHAR(20) NULL,
                    not_found BOOLEAN NOT NULL DEFAULT FALSE,
                    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            await db.commit()
            print("player_images table ensured")
    except Exception as e:
        print(f"player_images migration failed: {e}")

    # Self-heal: rooms.edit_window_closes_at column for persisted reshuffle
    # window state. Lets reconnect/reload clients see the active window with
    # correct remaining time instead of relying on a one-shot WS broadcast.
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text(
                "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS edit_window_closes_at TIMESTAMPTZ NULL"
            ))
            await db.commit()
            print("rooms.edit_window_closes_at ensured")
    except Exception as e:
        print(f"rooms.edit_window_closes_at migration failed: {e}")

    # Self-heal: rooms.playing_xi_announced_at + playing_xi for tracking
    # when the official team sheets drop (~30 min pre-match).
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text(
                "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playing_xi_announced_at TIMESTAMPTZ NULL"
            ))
            await db.execute(text(
                "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playing_xi JSONB NULL"
            ))
            await db.commit()
            print("rooms.playing_xi columns ensured")
    except Exception as e:
        print(f"rooms.playing_xi migration failed: {e}")

    # Self-heal: rooms.squads_last_refreshed_at — populated by the football
    # squad auto-sync flow so we know when each room last pulled rosters.
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text(
                "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS squads_last_refreshed_at TIMESTAMPTZ NULL"
            ))
            await db.commit()
            print("rooms.squads_last_refreshed_at ensured")
    except Exception as e:
        print(f"rooms.squads_last_refreshed_at migration failed: {e}")

    # Self-heal: rooms.late_join_enabled — admin override flag for keeping
    # the late-join window open on a specific room without a code change.
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text(
                "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS late_join_enabled BOOLEAN NOT NULL DEFAULT FALSE"
            ))
            await db.commit()
            print("rooms.late_join_enabled ensured")
    except Exception as e:
        print(f"rooms.late_join_enabled migration failed: {e}")

    # Self-heal: rooms.player_edit_window_closes_at — distinct timed window
    # from edit_window_closes_at (reshuffle). When set, users can join +
    # swap players + edit XI (not just redistribute power).
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text(
                "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS player_edit_window_closes_at TIMESTAMPTZ NULL"
            ))
            await db.commit()
            print("rooms.player_edit_window_closes_at ensured")
    except Exception as e:
        print(f"rooms.player_edit_window_closes_at migration failed: {e}")

    # Self-heal: user_feedback table for the in-room Feedback tab.
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS user_feedback (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
                    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    username VARCHAR(100),
                    contact VARCHAR(200),
                    sport VARCHAR(20) NOT NULL DEFAULT 'cricket',
                    category VARCHAR(40) NOT NULL DEFAULT 'general',
                    severity VARCHAR(20),
                    nps INT,
                    message TEXT NOT NULL,
                    answers JSONB,
                    user_agent VARCHAR(400),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            await db.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_feedback_room_created ON user_feedback (room_id, created_at)"
            ))
            await db.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_feedback_category_created ON user_feedback (category, created_at)"
            ))
            await db.commit()
            print("user_feedback table ensured")
    except Exception as e:
        print(f"user_feedback migration failed: {e}")

    asyncio.create_task(score_poller())
    asyncio.create_task(room_sync())
    asyncio.create_task(auto_close_past_rooms())
    asyncio.create_task(playing_xi_poller())
    asyncio.create_task(keep_alive())
