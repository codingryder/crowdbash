"""
Open Graph share-link route.

  GET /share/room/{room_id}
      → text/html; tiny stub with per-room og:title / og:description
        and the static /og.png brand image, plus a meta-refresh + JS
        redirect to the SPA route /room/{id}.

The canonical frontend host for the response is derived from the incoming
request's X-Forwarded-Host header (set by Vercel when it proxies through
its rewrite). This way the OG meta tags and the human redirect always
target whichever Crowdbash domain the user came in through, regardless
of what the backend's FRONTEND_URL env var happens to be.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.models.room import Room
from app.services.og_service import cache_max_age_for_room, share_html_for_room

router = APIRouter()


# Frontend hosts we trust to be presented to users. If a request arrives via
# one of these (X-Forwarded-Host), the share HTML emits URLs back to that
# host. Anything else falls back to settings.FRONTEND_URL — prevents an
# attacker from forging a Host header to make our redirects point elsewhere.
_TRUSTED_FRONTEND_HOSTS = {
    "crowdbash.codingryder.com",
    "crowdbash.vercel.app",
}


def _canonical_frontend_url(request: Request) -> str:
    fwd_host = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
    if fwd_host in _TRUSTED_FRONTEND_HOSTS:
        proto = request.headers.get("x-forwarded-proto", "https").split(",")[0].strip()
        return f"{proto}://{fwd_host}"
    return settings.FRONTEND_URL.rstrip("/")


@router.get("/share/room/{room_id}", response_class=HTMLResponse)
async def share_room(room_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        rid = uuid.UUID(room_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="invalid room id")
    room = (await db.execute(select(Room).where(Room.id == rid))).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    html = share_html_for_room(room, _canonical_frontend_url(request))
    max_age = cache_max_age_for_room(room)
    return HTMLResponse(
        content=html,
        headers={
            "Cache-Control": f"public, max-age={max_age}, s-maxage={max_age}",
        },
    )
