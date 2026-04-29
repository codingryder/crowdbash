"""
Player-edit window state + broadcast helpers.

Distinct from the reshuffle/edit-window infrastructure (see
edit_window_service.py): the reshuffle window is power-only, blind, and
auto-opens at sport events. THIS window is admin-controlled, lets users
join the room, swap players, and edit XI for the duration set, and
broadcasts a different WS message type so the frontend renders a
separate banner.

Persisted on Room.player_edit_window_closes_at; in-memory ACTIVE_PLAYER
_EDIT_WINDOWS keeps the running set so the auto-close timer can ignore
overrides cleanly.
"""
import asyncio
import time
import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import update as _update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.room import Room

DEFAULT_PLAYER_EDIT_DURATION = 600  # 10 min
MIN_DURATION_SECONDS = 30
MAX_DURATION_SECONDS = 60 * 60 * 4  # 4 hours — admin can stretch a window across a long match


ACTIVE_PLAYER_EDIT_WINDOWS: dict[str, float] = {}


async def open_player_edit_window(
    room_id: str,
    duration_seconds: int,
    *,
    db: AsyncSession,
    source: str,
) -> float:
    """Open (or replace) the player-edit window for a room. Returns closes_at epoch seconds."""
    from app.api.websocket import room_manager

    duration_seconds = max(MIN_DURATION_SECONDS, min(int(duration_seconds), MAX_DURATION_SECONDS))
    closes_at = time.time() + duration_seconds
    ACTIVE_PLAYER_EDIT_WINDOWS[room_id] = closes_at

    try:
        await db.execute(
            _update(Room)
            .where(Room.id == _uuid.UUID(room_id))
            .values(player_edit_window_closes_at=datetime.fromtimestamp(closes_at, tz=timezone.utc))
        )
        await db.commit()
    except Exception as e:
        print(f"open_player_edit_window persist failed: {e}")

    await room_manager.broadcast(room_id, {
        "type": "player_edit_window",
        "payload": {
            "player_edit_window_open": True,
            "closes_at": closes_at,
            "duration_seconds": duration_seconds,
            "source": source,
        },
    })

    asyncio.create_task(_auto_close(room_id, closes_at, source))
    print(f"PLAYER EDIT WINDOW OPEN ({source}): room {room_id}, {duration_seconds}s")
    return closes_at


async def close_player_edit_window(
    room_id: str,
    *,
    source: str,
    db: AsyncSession | None = None,
) -> bool:
    """Close any active player-edit window for the room. Returns True if one was active."""
    from app.api.websocket import room_manager

    was_active = ACTIVE_PLAYER_EDIT_WINDOWS.pop(room_id, None) is not None

    try:
        if db is not None:
            await db.execute(
                _update(Room)
                .where(Room.id == _uuid.UUID(room_id))
                .values(player_edit_window_closes_at=None)
            )
            await db.commit()
        else:
            async with AsyncSessionLocal() as _db:
                await _db.execute(
                    _update(Room)
                    .where(Room.id == _uuid.UUID(room_id))
                    .values(player_edit_window_closes_at=None)
                )
                await _db.commit()
    except Exception as e:
        print(f"close_player_edit_window persist clear failed: {e}")

    await room_manager.broadcast(room_id, {
        "type": "player_edit_window",
        "payload": {"player_edit_window_open": False, "source": source},
    })
    print(f"PLAYER EDIT WINDOW CLOSED ({source}): room {room_id}")
    return was_active


async def _auto_close(room_id: str, expected_closes_at: float, source: str) -> None:
    delay = expected_closes_at - time.time()
    if delay > 0:
        await asyncio.sleep(delay)
    if ACTIVE_PLAYER_EDIT_WINDOWS.get(room_id) != expected_closes_at:
        return
    await close_player_edit_window(room_id, source=f"{source}_timeout")


def is_window_active(room_id: str) -> bool:
    return ACTIVE_PLAYER_EDIT_WINDOWS.get(room_id, 0) > time.time()
