"""
Reshuffle / edit-window state and broadcast helpers.

Owns the in-memory active-window registry and the open/close routines used
by both the cricket score poller (auto, sport-rule based) and the admin
override endpoints (manual). Admin actions are authoritative: opening
replaces any active window for the same room, closing wins over a pending
auto-close because the timer's expected_closes_at no longer matches.
"""
import asyncio
import time
import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import update as _update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.room import Room

DEFAULT_EDIT_WINDOW_DURATION = 300  # seconds (5 min)
MIN_DURATION_SECONDS = 30
MAX_DURATION_SECONDS = 1800  # 30 min cap

# room_id (str) -> epoch seconds when the active window closes
ACTIVE_EDIT_WINDOWS: dict[str, float] = {}


async def open_edit_window(
    room_id: str,
    duration_seconds: int,
    *,
    db: AsyncSession,
    source: str,
    extra_payload: dict | None = None,
) -> float:
    """
    Open (or replace) a reshuffle window for a room. Returns closes_at
    epoch seconds.
    """
    from app.api.websocket import room_manager  # deferred: avoid import cycle

    duration_seconds = max(
        MIN_DURATION_SECONDS, min(int(duration_seconds), MAX_DURATION_SECONDS)
    )
    closes_at = time.time() + duration_seconds
    ACTIVE_EDIT_WINDOWS[room_id] = closes_at

    try:
        await db.execute(
            _update(Room)
            .where(Room.id == _uuid.UUID(room_id))
            .values(edit_window_closes_at=datetime.fromtimestamp(closes_at, tz=timezone.utc))
        )
        await db.commit()
    except Exception as e:
        print(f"open_edit_window persist failed: {e}")

    payload = {
        "edit_window_open": True,
        "closes_at": closes_at,
        "duration_seconds": duration_seconds,
        "source": source,
    }
    if extra_payload:
        payload.update(extra_payload)
    await room_manager.broadcast(room_id, {"type": "edit_window", "payload": payload})

    asyncio.create_task(_auto_close(room_id, closes_at, source))
    print(f"EDIT WINDOW OPEN ({source}): room {room_id}, {duration_seconds}s")
    return closes_at


async def close_edit_window(
    room_id: str,
    *,
    source: str,
    db: AsyncSession | None = None,
) -> bool:
    """
    Close any active reshuffle window for the room and clear persisted
    state. Returns True if a window was active.
    """
    from app.api.websocket import room_manager

    was_active = ACTIVE_EDIT_WINDOWS.pop(room_id, None) is not None

    try:
        if db is not None:
            await db.execute(
                _update(Room)
                .where(Room.id == _uuid.UUID(room_id))
                .values(edit_window_closes_at=None)
            )
            await db.commit()
        else:
            async with AsyncSessionLocal() as _db:
                await _db.execute(
                    _update(Room)
                    .where(Room.id == _uuid.UUID(room_id))
                    .values(edit_window_closes_at=None)
                )
                await _db.commit()
    except Exception as e:
        print(f"close_edit_window persist clear failed: {e}")

    await room_manager.broadcast(room_id, {
        "type": "edit_window",
        "payload": {"edit_window_open": False, "source": source},
    })
    print(f"EDIT WINDOW CLOSED ({source}): room {room_id}")
    return was_active


async def _auto_close(room_id: str, expected_closes_at: float, source: str) -> None:
    """
    Sleep until expected close, then close iff no later open superseded us
    (a newer open writes a different closes_at into ACTIVE_EDIT_WINDOWS).
    """
    delay = expected_closes_at - time.time()
    if delay > 0:
        await asyncio.sleep(delay)
    if ACTIVE_EDIT_WINDOWS.get(room_id) != expected_closes_at:
        return
    await close_edit_window(room_id, source=f"{source}_timeout")


def is_window_active(room_id: str) -> bool:
    return ACTIVE_EDIT_WINDOWS.get(room_id, 0) > time.time()


def active_closes_at(room_id: str) -> float | None:
    closes_at = ACTIVE_EDIT_WINDOWS.get(room_id)
    if closes_at is None or closes_at <= time.time():
        return None
    return closes_at
