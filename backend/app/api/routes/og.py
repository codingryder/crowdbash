"""
Open Graph routes — per-room poster + share-link HTML stub.

Both routes are unauthenticated and intended for crawler consumption
(WhatsApp, Twitter, LinkedIn, iMessage, etc.) plus optional human use.

  GET /api/og/room/{room_id}.png
      → image/png; 1200×630 poster with team abbrs + sport accent.

  GET /share/room/{room_id}
      → text/html; tiny stub with og:* meta tags pointing at the PNG
        plus a meta-refresh + JS redirect to the SPA route /room/{id}.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.models.room import Room
from app.services.og_service import (
    cache_max_age_for_room,
    og_image_url,
    render_room_og,
    share_html_for_room,
)

router = APIRouter()


def _absolute_api_base(request: Request) -> str:
    """Derive an absolute base URL for the backend from the incoming request."""
    return str(request.base_url).rstrip("/")


@router.get("/api/og/room/{room_id}.png")
async def room_og_image(
    room_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="invalid room id")
    room = (await db.execute(select(Room).where(Room.id == rid))).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    png = render_room_og(room)
    max_age = cache_max_age_for_room(room)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Cache-Control": f"public, max-age={max_age}, s-maxage={max_age}, stale-while-revalidate={max_age * 2}",
            "Content-Length": str(len(png)),
        },
    )


@router.get("/share/room/{room_id}", response_class=HTMLResponse)
async def share_room(
    room_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="invalid room id")
    room = (await db.execute(select(Room).where(Room.id == rid))).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    image_url = og_image_url(_absolute_api_base(request), room.id)
    html = share_html_for_room(room, settings.FRONTEND_URL, image_url)
    max_age = cache_max_age_for_room(room)
    return HTMLResponse(
        content=html,
        headers={
            "Cache-Control": f"public, max-age={max_age}, s-maxage={max_age}",
        },
    )
