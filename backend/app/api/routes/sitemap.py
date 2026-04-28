"""
Dynamic XML sitemap.

  GET /sitemap.xml
      → application/xml listing static SPA routes, distinct league hub
        pages, and per-room match pages. Cached for 1 hour.

The frontend host is resolved the same way as og.py — trust the
X-Forwarded-Host header from Vercel when it matches a known frontend
domain, fall back to FRONTEND_URL otherwise. This way the sitemap is
always emitted with URLs on whichever Crowdbash domain the request
came in through.
"""
from datetime import datetime, timezone
from xml.sax.saxutils import escape as _xml_escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.room import Room

router = APIRouter()


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


def _iso_date(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.date().isoformat()


def _url_entry(loc: str, lastmod: str | None, changefreq: str, priority: str) -> str:
    parts = [f"  <url>", f"    <loc>{_xml_escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    parts.append(f"    <changefreq>{changefreq}</changefreq>")
    parts.append(f"    <priority>{priority}</priority>")
    parts.append("  </url>")
    return "\n".join(parts)


@router.get("/sitemap.xml")
async def sitemap_xml(request: Request, db: AsyncSession = Depends(get_db)):
    base = _canonical_frontend_url(request)
    today = datetime.now(timezone.utc).date().isoformat()

    entries: list[str] = []

    # Static routes — public pages worth indexing.
    static_pages = [
        ("/", "daily", "1.0"),
        ("/games", "hourly", "0.9"),
        ("/games?sport=cricket", "hourly", "0.8"),
        ("/games?sport=football", "hourly", "0.8"),
        ("/leaderboard", "daily", "0.6"),
        ("/terms", "monthly", "0.3"),
        ("/privacy", "monthly", "0.3"),
    ]
    for path, freq, prio in static_pages:
        entries.append(_url_entry(f"{base}{path}", today, freq, prio))

    # Per-room match pages. Skip rooms whose match has been over for a
    # while (older than 90 days) — the long tail isn't worth bloating
    # the sitemap with.
    cutoff = datetime.now(timezone.utc)
    try:
        result = await db.execute(select(Room).order_by(Room.created_at.desc()))
        rooms = result.scalars().all()
    except Exception as e:
        print(f"sitemap: room fetch failed: {e}")
        rooms = []

    leagues_seen: set[str] = set()
    for r in rooms:
        # Drop rooms older than 90 days from any signal (created_at OR
        # completed_at — completed long ago = stale page for SEO).
        ref = r.completed_at or r.match_date or r.created_at
        if ref is not None:
            if ref.tzinfo is None:
                ref = ref.replace(tzinfo=timezone.utc)
            if (cutoff - ref).days > 90:
                continue

        if r.status == "locked":
            freq, prio = "hourly", "0.8"
        elif r.status == "open":
            freq, prio = "daily", "0.7"
        else:
            freq, prio = "weekly", "0.5"

        lastmod = _iso_date(r.completed_at or r.match_date or r.created_at)
        entries.append(_url_entry(f"{base}/room/{r.id}", lastmod, freq, prio))

        if r.league:
            leagues_seen.add(r.league)

    # League hub pages — one per distinct league with active/recent rooms.
    for lg in sorted(leagues_seen):
        slug = lg.replace(" ", "%20")
        entries.append(_url_entry(f"{base}/league/{slug}", today, "daily", "0.6"))

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    return Response(
        content=body,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
