"""
Open Graph share-link route.

  GET /share/room/{room_id}
      → text/html; tiny stub with per-room og:title / og:description
        and the static /og.png brand image, plus a meta-refresh + JS
        redirect to the SPA route /room/{id}.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.models.room import Room
from app.services.og_service import cache_max_age_for_room, share_html_for_room

router = APIRouter()


@router.get("/share/room/{room_id}", response_class=HTMLResponse)
async def share_room(room_id: str, db: AsyncSession = Depends(get_db)):
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="invalid room id")
    room = (await db.execute(select(Room).where(Room.id == rid))).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    html = share_html_for_room(room, settings.FRONTEND_URL)
    max_age = cache_max_age_for_room(room)
    return HTMLResponse(
        content=html,
        headers={
            "Cache-Control": f"public, max-age={max_age}, s-maxage={max_age}",
        },
    )
