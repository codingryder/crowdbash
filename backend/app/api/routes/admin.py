from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.config import settings
from app.models.room import Room
from app.services.sport_service import get_adapter
from pydantic import BaseModel as PydanticBaseModel
from datetime import datetime, timezone, timedelta
import re
import jwt
import uuid as _uuid_mod

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


# ── Admin Auth ──

class AdminLoginRequest(PydanticBaseModel):
    username: str
    password: str


class AdminRoomCreate(PydanticBaseModel):
    sport: str
    match_name: str
    match_format: str = ""
    venue: str = ""
    league: str = ""
    season: str = ""
    match_date: str | None = None
    match_id: str | None = None


class AdminStatusUpdate(PydanticBaseModel):
    status: str


class EditWindowOpenRequest(PydanticBaseModel):
    duration_seconds: int = 300


def _create_admin_jwt() -> str:
    payload = {
        "sub": "admin",
        "role": "admin",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not an admin")
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/login")
async def admin_login(body: AdminLoginRequest):
    if body.username != settings.ADMIN_USERNAME or body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_admin_jwt()
    return {"token": token, "username": body.username}


@router.post("/rooms")
async def create_room(
    body: AdminRoomCreate,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    match_id = body.match_id or str(_uuid_mod.uuid4())
    match_date_parsed = None
    if body.match_date:
        try:
            match_date_parsed = datetime.fromisoformat(body.match_date.replace("Z", "+00:00"))
        except Exception:
            pass

    room = Room(
        match_id=match_id,
        match_name=body.match_name,
        match_format=body.match_format,
        venue=body.venue,
        sport=body.sport,
        league=body.league,
        season=body.season,
        status="open",
        match_date=match_date_parsed,
        admin_created=True,
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)

    # Football rooms: auto-populate squads in the background so admins don't
    # have to type rosters manually. Cricket already has its own pull-on-demand
    # path via the adapter, so we only fire this for football.
    if room.sport == "football":
        import asyncio as _asyncio
        from app.core.database import AsyncSessionLocal as _SessionLocal
        async def _bg_sync(room_id):
            try:
                async with _SessionLocal() as bg_db:
                    bg_room = (await bg_db.execute(select(Room).where(Room.id == room_id))).scalar_one_or_none()
                    if bg_room:
                        await _populate_match_squads(bg_db, bg_room)
            except Exception as e:
                print(f"Background squad sync failed for room {room_id}: {e}")
        _asyncio.create_task(_bg_sync(room.id))

    return {
        "id": str(room.id),
        "match_name": room.match_name,
        "sport": room.sport,
        "status": room.status,
        "match_date": str(room.match_date) if room.match_date else None,
    }


@router.get("/rooms")
async def list_all_rooms(
    sport: str | None = None,
    status: str | None = None,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List only admin-created rooms."""
    query = select(Room).where(Room.admin_created == True).order_by(Room.created_at.desc())
    if sport:
        query = query.where(Room.sport == sport)
    if status:
        query = query.where(Room.status == status)
    result = await db.execute(query)
    rooms = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "match_id": r.match_id,
            "match_name": r.match_name,
            "sport": r.sport,
            "league": r.league,
            "match_format": r.match_format,
            "venue": r.venue,
            "status": r.status,
            "match_date": str(r.match_date) if r.match_date else None,
            "fan_count": r.fan_count,
            "created_at": str(r.created_at) if r.created_at else None,
            "edit_window_closes_at": (
                r.edit_window_closes_at.isoformat() if r.edit_window_closes_at else None
            ),
            "player_edit_window_closes_at": (
                r.player_edit_window_closes_at.isoformat()
                if getattr(r, "player_edit_window_closes_at", None) else None
            ),
            "late_join_enabled": bool(getattr(r, "late_join_enabled", False)),
            "playing_xi_announced_at": (
                r.playing_xi_announced_at.isoformat()
                if getattr(r, "playing_xi_announced_at", None) else None
            ),
        }
        for r in rooms
    ]


@router.patch("/rooms/{room_id}/status")
async def update_room_status(
    room_id: str,
    body: AdminStatusUpdate,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room.status = body.status
    if body.status == "closed":
        room.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": str(room.id), "status": room.status}


@router.post("/rooms/{room_id}/edit-window/open")
async def admin_open_edit_window(
    room_id: str,
    body: EditWindowOpenRequest,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually open a reshuffle window. Replaces any active window for this
    room (admin overrides the auto-trigger). Duration is clamped to the
    service's MIN/MAX bounds.
    """
    from app.services.edit_window_service import (
        open_edit_window,
        MIN_DURATION_SECONDS,
        MAX_DURATION_SECONDS,
    )

    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    # Reshuffle is normally a mid-match trigger (auto-opens at innings
    # break / 10 overs / half-time). The admin button exists as a manual
    # rescue when the auto-trigger is delayed or for testing flows on a
    # not-yet-locked room — allow open + locked, block only closed.
    if room.status == "closed":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reshuffle a closed room.",
        )
    if body.duration_seconds < MIN_DURATION_SECONDS or body.duration_seconds > MAX_DURATION_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"duration_seconds must be between {MIN_DURATION_SECONDS} and {MAX_DURATION_SECONDS}",
        )

    closes_at = await open_edit_window(
        room_id,
        body.duration_seconds,
        db=db,
        source="admin",
    )
    return {
        "room_id": room_id,
        "closes_at": closes_at,
        "duration_seconds": body.duration_seconds,
    }


@router.post("/rooms/{room_id}/edit-window/close")
async def admin_close_edit_window(
    room_id: str,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually close any active reshuffle window for this room."""
    from app.services.edit_window_service import close_edit_window

    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    was_active = await close_edit_window(room_id, source="admin", db=db)
    return {"room_id": room_id, "was_active": was_active}


class PlayerEditWindowOpenRequest(PydanticBaseModel):
    duration_seconds: int = 600  # default 10 min for the player-edit window


@router.post("/rooms/{room_id}/player-edit-window/open")
async def admin_open_player_edit_window(
    room_id: str,
    body: PlayerEditWindowOpenRequest,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Open a player-edit window. Distinct from the reshuffle window:
    while THIS is open, users can join the room, swap players, and edit
    their XI for the duration set. Reshuffle continues to be the
    power-only blind window.
    """
    from app.services.player_edit_window_service import (
        open_player_edit_window,
        MIN_DURATION_SECONDS,
        MAX_DURATION_SECONDS,
    )

    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.status not in ("locked", "open"):
        raise HTTPException(
            status_code=400,
            detail=f"Player-edit window only meaningful while the room is open or locked (current: {room.status})",
        )
    if body.duration_seconds < MIN_DURATION_SECONDS or body.duration_seconds > MAX_DURATION_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"duration_seconds must be between {MIN_DURATION_SECONDS} and {MAX_DURATION_SECONDS}",
        )

    closes_at = await open_player_edit_window(
        room_id, body.duration_seconds, db=db, source="admin",
    )
    return {
        "room_id": room_id,
        "closes_at": closes_at,
        "duration_seconds": body.duration_seconds,
    }


class AnnounceXiRequest(PydanticBaseModel):
    """
    Optional body for the announce-XI endpoint. If xi_a / xi_b aren't
    provided, the helper auto-picks the first 11 players per team from
    match_squads — useful for QA / staging where you just want the
    Playing-XI banner + Review-team flow to fire on a test room.
    """
    team_a: str | None = None
    team_b: str | None = None
    xi_a: list[str] | None = None
    xi_b: list[str] | None = None


@router.post("/rooms/{room_id}/announce-xi")
async def admin_announce_xi(
    room_id: str,
    body: AnnounceXiRequest,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually announce a playing XI for a room — bypasses the 5-min
    Gemini polling cycle. Without explicit xi_a/xi_b, picks the first 11
    players per team from match_squads. Persists on Room.playing_xi and
    broadcasts the same `playing_xi_announced` WS message the poller
    uses, so the frontend banner + Review-team flow trigger as if the
    real team sheets had dropped.
    """
    from datetime import datetime, timezone
    from app.api.websocket import room_manager
    from app.models.match_squad import MatchSquad

    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    team_a = body.team_a
    team_b = body.team_b
    xi_a = body.xi_a
    xi_b = body.xi_b

    # Auto-pick path — read match_squads, group by team, take the first 11
    # in DB insert order for each team. Caller can pass explicit lists to
    # override.
    if not xi_a or not xi_b or not team_a or not team_b:
        squads_res = await db.execute(
            select(MatchSquad).where(MatchSquad.room_id == _uuid_mod.UUID(room_id))
        )
        squads = squads_res.scalars().all()
        by_team: dict[str, list[str]] = {}
        for s in squads:
            t = s.team or ""
            if t not in by_team:
                by_team[t] = []
            by_team[t].append(s.player_name)
        teams = list(by_team.keys())
        if len(teams) < 2:
            raise HTTPException(
                status_code=400,
                detail=f"Need at least 2 teams in match_squads to auto-pick XI (found {len(teams)}). Sync the squad first.",
            )
        team_a = team_a or teams[0]
        team_b = team_b or teams[1]
        xi_a = xi_a or by_team.get(team_a, [])[:11]
        xi_b = xi_b or by_team.get(team_b, [])[:11]

    if len(xi_a) < 11 or len(xi_b) < 11:
        raise HTTPException(
            status_code=400,
            detail=f"Each XI needs 11 players (got {len(xi_a)} + {len(xi_b)}). Sync the squad first or pass explicit xi_a/xi_b.",
        )

    xi_payload = {
        "team_a": team_a,
        "team_b": team_b,
        "xi_a": xi_a[:11],
        "xi_b": xi_b[:11],
        "announced": True,
    }
    now = datetime.now(timezone.utc)
    room.playing_xi = xi_payload
    room.playing_xi_announced_at = now
    await db.commit()

    await room_manager.broadcast(room_id, {
        "type": "playing_xi_announced",
        "payload": {
            "playing_xi": xi_payload,
            "announced_at": now.isoformat(),
        },
    })
    return {
        "room_id": room_id,
        "team_a": team_a, "team_b": team_b,
        "xi_a_count": len(xi_a[:11]),
        "xi_b_count": len(xi_b[:11]),
        "announced_at": now.isoformat(),
    }


@router.delete("/rooms/{room_id}/announce-xi")
async def admin_clear_xi(
    room_id: str,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear any mock XI announcement on the room — for resetting the test flow."""
    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room.playing_xi = None
    room.playing_xi_announced_at = None
    await db.commit()
    return {"room_id": room_id, "cleared": True}


@router.post("/rooms/{room_id}/player-edit-window/close")
async def admin_close_player_edit_window(
    room_id: str,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually close any active player-edit window for this room."""
    from app.services.player_edit_window_service import close_player_edit_window

    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    was_active = await close_player_edit_window(room_id, source="admin", db=db)
    return {"room_id": room_id, "was_active": was_active}


class LateJoinToggle(PydanticBaseModel):
    enabled: bool


@router.post("/rooms/{room_id}/late-join")
async def admin_set_late_join(
    room_id: str,
    body: LateJoinToggle,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin override: enable or disable the late-join window for a specific
    room. When enabled, users can keep joining and editing their XI even
    after the match has started, regardless of the LATE_JOIN_ROOMS map.
    """
    result = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room.late_join_enabled = bool(body.enabled)
    await db.commit()
    return {"id": str(room.id), "late_join_enabled": bool(room.late_join_enabled)}


@router.delete("/rooms/{room_id}")
async def delete_room(
    room_id: str,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    await db.commit()
    return {"deleted": room_id}


# ── Room invite broadcast ──

class BroadcastRequest(PydanticBaseModel):
    subject: str | None = None
    intro: str | None = None
    test_email: str | None = None


@router.get("/broadcast/recipients")
async def broadcast_recipients(
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Count of users eligible for a broadcast email (verified address)."""
    from app.models.user import User
    from sqlalchemy import func as _func

    res = await db.execute(
        select(_func.count()).select_from(User).where(
            User.email_verified == True,  # noqa: E712
            User.email.is_not(None),
        )
    )
    return {"count": int(res.scalar() or 0)}


@router.post("/rooms/{room_id}/broadcast")
async def broadcast_room_invite(
    room_id: str,
    body: BroadcastRequest,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Email a room invite. With test_email set, sends to that single
    address only. Otherwise fans out to every user with a verified
    email. Per-recipient errors are swallowed and surfaced as `failed`
    in the response — never raises mid-fanout.
    """
    from app.models.user import User
    from app.services.email_service import send_room_invite_email
    import asyncio
    from datetime import timezone, timedelta

    room_res = await db.execute(select(Room).where(Room.id == _uuid_mod.UUID(room_id)))
    room = room_res.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    subject = (body.subject or "").strip() or f"Join the {room.match_name} room on Crowdbash"
    intro_html = (
        (body.intro or "").strip()
        or "Today's match is starting soon — drop into the room, pick your XI, and play live."
    ).replace("\n", "<br>")

    # Hardcoded canonical public host — settings.FRONTEND_URL on Render is
    # the vercel.app internal URL, but users actually visit the custom
    # domain. /share/room/* gets the OG-preview treatment (rich card on
    # WhatsApp/iMessage/etc.) plus a redirect to the SPA.
    room_url = f"https://crowdbash.codingryder.com/share/room/{room.id}"
    match_date_label = None
    if room.match_date:
        # Audience is India-heavy; render kickoff in IST.
        ist = room.match_date.astimezone(timezone(timedelta(hours=5, minutes=30)))
        match_date_label = ist.strftime("%a %d %b · %I:%M %p IST")

    common = dict(
        subject=subject,
        intro_html=intro_html,
        match_name=room.match_name,
        league=room.league,
        match_format=room.match_format,
        venue=room.venue,
        match_date_label=match_date_label,
        room_url=room_url,
    )

    if body.test_email:
        try:
            await send_room_invite_email(body.test_email.strip(), **common)
            return {"sent": 1, "failed": 0, "total": 1, "test": True}
        except Exception as e:
            return {"sent": 0, "failed": 1, "total": 1, "test": True, "error": str(e)}

    users_res = await db.execute(
        select(User).where(
            User.email_verified == True,  # noqa: E712
            User.email.is_not(None),
        )
    )
    users = users_res.scalars().all()

    # Resend's default rate limit is 2 requests/second. A concurrent
    # fan-out trips it on anything past ~2 users; we go sequential with
    # spacing so the limiter stays happy even if the user base grows.
    sent = 0
    failures: list[dict] = []  # each: {"email", "error"}
    for u in users:
        try:
            await send_room_invite_email(u.email, **common)
            sent += 1
        except Exception as e:
            failures.append({"email": u.email, "error": str(e)})
        await asyncio.sleep(0.55)

    result: dict = {
        "sent": sent,
        "failed": len(failures),
        "total": len(users),
        "test": False,
    }
    if failures:
        result["failures"] = failures
    return result


@router.post("/fetch-matches")
async def fetch_upcoming_matches(
    sport: str = Query("cricket"),
    _admin: str = Depends(get_admin_user),
):
    """Fetch upcoming matches: real API first → Gemini fallback."""
    matches = []

    # Layer 1: Real API
    if sport == "cricket":
        try:
            from app.services.cricketdata_service import get_current_matches
            cd_matches = await get_current_matches()
            if cd_matches:
                matches = [
                    {
                        "match_name": m.get("name", f"{m.get('t1', '')} vs {m.get('t2', '')}"),
                        "match_format": m.get("matchType", ""),
                        "venue": m.get("venue", ""),
                        "league": str(m.get("series", "")),
                        "match_date": m.get("dateTimeGMT", ""),
                        "season": "2026",
                        "match_id": m.get("id", ""),
                        "source": "cricketdata",
                    }
                    for m in cd_matches
                ]
        except Exception as e:
            print(f"Admin fetch cricket API error: {e}")

    elif sport == "football":
        try:
            from app.services.footballdata_service import get_upcoming_matches as fd_upcoming
            fd_matches = await fd_upcoming(days=7)
            if fd_matches:
                matches = [
                    {
                        "match_name": f"{m.get('homeTeam', {}).get('name', '')} vs {m.get('awayTeam', {}).get('name', '')}",
                        "match_format": m.get("competition", {}).get("name", "League"),
                        "venue": m.get("venue", ""),
                        "league": m.get("competition", {}).get("name", ""),
                        "match_date": m.get("utcDate", ""),
                        "season": "2025-26",
                        "match_id": m.get("id", ""),
                        "source": "footballdata",
                    }
                    for m in fd_matches
                ]
        except Exception as e:
            print(f"Admin fetch football API error: {e}")

    # Layer 2: Gemini fallback if no API data
    if not matches:
        from app.services.live_score_service import fetch_upcoming_matches_via_gemini
        gemini_matches = await fetch_upcoming_matches_via_gemini(sport)
        if gemini_matches:
            matches = [
                {**m, "source": "gemini", "match_id": ""}
                for m in gemini_matches
            ]

    return {"sport": sport, "matches": matches}

# ── Allowed cricket leagues / series keywords ──
ALLOWED_CRICKET_LEAGUES = [
    # Domestic T20 leagues
    "Indian Premier League", "IPL",
    "Pakistan Super League", "PSL",
    "Big Bash League", "BBL",
    "Caribbean Premier League", "CPL",
    "SA20",
    "The Hundred",
    "Lanka Premier League", "LPL",
    "Bangladesh Premier League", "BPL",
    "Major League Cricket", "MLC",
    # ICC events
    "ICC", "World Cup", "Champions Trophy", "World Test Championship",
]

# Major cricket nations — only tours involving these teams are allowed
MAJOR_CRICKET_NATIONS = [
    "india", "australia", "england", "south africa", "new zealand",
    "pakistan", "sri lanka", "bangladesh", "west indies", "afghanistan",
    "ireland", "zimbabwe",
]

# Exclude these keywords
EXCLUDED_KEYWORDS = [
    "women", "u19", "under-19", "under 19",
    "county championship", "division one", "division two",
    "warm-up", "practice", "unofficial",
    "a tour", "a team",
    "indonesia", "cyprus", "greece", "uganda", "nepal",
    "namibia", "sweden", "oman", "bahrain", "qatar",
    "kuwait", "saudi", "maldives", "bhutan", "vanuatu",
    "papua", "bermuda", "jersey", "guernsey", "gibraltar",
]


def _is_allowed_cricket(series: str, match_format: str) -> bool:
    """Check if a cricket match belongs to an allowed league or is international."""
    series_lower = series.lower()
    fmt_lower = match_format.lower()

    # Exclude if any excluded keyword matches
    for excl in EXCLUDED_KEYWORDS:
        if excl in series_lower:
            return False

    # Allow if series matches a known league
    for keyword in ALLOWED_CRICKET_LEAGUES:
        if keyword.lower() in series_lower:
            return True

    # Allow tours only between major nations
    if "tour of" in series_lower:
        has_major = any(nation in series_lower for nation in MAJOR_CRICKET_NATIONS)
        return has_major

    # Allow international formats only if between major nations
    if fmt_lower in ("t20i", "odi", "test"):
        has_major = any(nation in series_lower for nation in MAJOR_CRICKET_NATIONS)
        return has_major

    return False


@router.post("/sync-rooms/{sport}")
async def sync_rooms_from_live_matches(
    sport: str,
    include_upcoming: bool = Query(True, description="Also create rooms for upcoming matches"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch matches from the sport API and create rooms for allowed
    leagues only. Filters out minor/associate/women's U19 matches.
    """
    try:
        return await _do_sync(sport, include_upcoming, db)
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}


async def _do_sync(sport: str, include_upcoming: bool, db: AsyncSession):
    try:
        adapter = get_adapter(sport)
    except ValueError:
        return {"error": f"Unknown sport: {sport}"}

    all_matches = await adapter.get_live_matches()
    created = 0
    skipped = 0
    filtered = 0

    for match in all_matches:
        if sport == "cricket":
            match_id = match.get("id", "")
            t1 = match.get("t1", "")
            t2 = match.get("t2", "")
            match_name = f"{t1} vs {t2}" if t1 and t2 else match.get("name", "Unknown")
            match_format = match.get("matchType", "")
            venue = match.get("venue", "")
            league = match.get("series", "")
            ms = match.get("ms", "")

            # ── League filter ──
            if not _is_allowed_cricket(league, match_format):
                filtered += 1
                continue

            if ms == "live":
                status = "live"
            elif ms == "result":
                status = "completed"
            else:
                status = "upcoming"

            if not include_upcoming and status == "upcoming":
                continue

        elif sport == "football":
            # Football-Data.org free tier already filters to 12 major leagues
            match_id = str(match.get("id", ""))
            home = match.get("homeTeam", {}).get("name", "")
            away = match.get("awayTeam", {}).get("name", "")
            match_name = f"{home} vs {away}"
            competition = match.get("competition", {})
            match_format = competition.get("name", "")
            venue = match.get("venue", "")
            league = competition.get("name", "")
            status_raw = match.get("status", "")

            if status_raw in ("IN_PLAY", "PAUSED"):
                status = "live"
            elif status_raw == "FINISHED":
                status = "completed"
            else:
                status = "upcoming"

            if not include_upcoming and status == "upcoming":
                continue
        else:
            continue

        if not match_id:
            continue

        # Check if room already exists
        existing = await db.execute(
            select(Room).where(Room.match_id == str(match_id))
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Clean team name brackets
        clean_name = match_name
        if "[" in clean_name:
            clean_name = re.sub(r'\s*\[.*?\]', '', clean_name).strip()

        # For completed matches, try to save match summary
        progress = {}
        if status == "completed":
            try:
                summary = adapter.format_match_summary(match, clean_name)
                progress = summary
            except Exception:
                progress = {"status": "completed"}
            from datetime import datetime, timezone
            completed_at = datetime.now(timezone.utc)
        else:
            completed_at = None

        room = Room(
            match_id=str(match_id),
            match_name=clean_name,
            match_format=match_format,
            venue=venue,
            sport=sport,
            league=league,
            status=status,
            match_progress=progress,
            completed_at=completed_at,
        )
        db.add(room)
        created += 1

    await db.commit()
    return {
        "sport": sport,
        "total_matches_found": len(all_matches),
        "rooms_created": created,
        "rooms_skipped_existing": skipped,
        "rooms_filtered_out": filtered,
    }


@router.post("/cleanup")
async def cleanup_rooms(db: AsyncSession = Depends(get_db)):
    """
    Remove rooms from non-allowed leagues. Call once to clean up
    existing junk data, then the filter prevents new ones.
    """
    result = await db.execute(select(Room).where(Room.sport == "cricket"))
    rooms = result.scalars().all()

    removed = 0
    kept = 0
    for room in rooms:
        league = room.league or ""
        fmt = room.match_format or ""
        if not _is_allowed_cricket(league, fmt):
            await db.execute(delete(Room).where(Room.id == room.id))
            removed += 1
        else:
            kept += 1

    await db.commit()
    return {"cricket_rooms_kept": kept, "cricket_rooms_removed": removed}


@router.post("/backfill-stats")
async def backfill_user_stats(db: AsyncSession = Depends(get_db)):
    """
    One-shot: walk every closed/completed room and apply rank + win
    finalization. Idempotent — rooms already finalized are skipped.
    Use this once after deploying the finalization fix to retro-credit
    users whose past games closed before stats tracking existed.
    """
    from app.services.game_service import finalize_room_results

    result = await db.execute(
        select(Room).where(Room.status.in_(["closed", "completed"]))
    )
    rooms = result.scalars().all()

    finalized = 0
    skipped = 0
    total_winners = 0
    for room in rooms:
        outcome = await finalize_room_results(db, room.id)
        if outcome.get("ranked", 0) > 0:
            finalized += 1
            total_winners += outcome.get("winners", 0)
        else:
            skipped += 1

    await db.commit()
    return {
        "rooms_scanned": len(rooms),
        "rooms_finalized": finalized,
        "rooms_skipped": skipped,
        "winners_credited": total_winners,
    }


@router.post("/check-finished")
async def check_finished_rooms(db: AsyncSession = Depends(get_db)):
    """
    Check all live rooms and mark any finished matches as completed.
    Uses the sport API to verify match status.
    """
    result = await db.execute(select(Room).where(Room.status == "live"))
    live_rooms = result.scalars().all()

    completed = 0
    still_live = 0
    errors = 0

    for room in live_rooms:
        try:
            adapter = get_adapter(room.sport)
            match_data = await adapter.get_match_score(room.match_id)
            if not match_data:
                # No data available — could be API limit, skip
                continue

            if adapter.is_match_finished(match_data):
                room.status = "completed"
                from datetime import datetime, timezone
                room.completed_at = datetime.now(timezone.utc)
                completed += 1
            else:
                still_live += 1
        except Exception:
            errors += 1

    await db.commit()
    return {
        "checked": len(live_rooms),
        "marked_completed": completed,
        "still_live": still_live,
        "errors": errors,
    }


@router.post("/backfill-results")
async def backfill_results(db: AsyncSession = Depends(get_db)):
    """
    Backfill match summaries for completed rooms that don't have one.
    Fetches match data from the sport API and saves summary to match_progress.
    """
    result = await db.execute(select(Room).where(Room.status == "completed"))
    completed_rooms = result.scalars().all()

    filled = 0
    skipped = 0
    errors = 0

    for room in completed_rooms:
        # Skip if already has a summary
        progress = room.match_progress or {}
        if progress.get("status") == "completed" and (progress.get("result") or progress.get("scorers")):
            skipped += 1
            continue

        try:
            adapter = get_adapter(room.sport)
            match_data = await adapter.get_match_score(room.match_id)
            if not match_data:
                errors += 1
                continue

            summary = adapter.format_match_summary(match_data, room.match_name)
            room.match_progress = summary
            filled += 1
        except Exception as e:
            print(f"Backfill error for {room.match_name}: {e}")
            errors += 1

    await db.commit()
    return {"filled": filled, "skipped": skipped, "errors": errors}


@router.post("/scrape-missing")
async def scrape_missing_results(db: AsyncSession = Depends(get_db)):
    """
    Scrape match results from Google for leagues that don't have
    recent completed matches with summaries. Fallback for when
    sport APIs hit rate limits.
    """
    from app.services.scraper_service import scrape_match_result
    import asyncio

    # Find leagues that have 0 completed rooms with summaries
    all_result = await db.execute(select(Room))
    all_rooms = all_result.scalars().all()

    # Group by league
    leagues: dict = {}
    for r in all_rooms:
        lg = r.league or "Other"
        if lg not in leagues:
            leagues[lg] = {"sport": r.sport, "completed_with_summary": 0, "upcoming_rooms": []}
        mp = r.match_progress or {}
        if r.status == "completed" and mp.get("status") == "completed" and (mp.get("result") or mp.get("scorers")):
            leagues[lg]["completed_with_summary"] += 1
        elif r.status == "upcoming":
            leagues[lg]["upcoming_rooms"].append(r)

    # For leagues with < 3 completed summaries, scrape results for upcoming rooms
    # (We'll scrape for the match name to see if results are available)
    scraped = 0
    failed = 0
    skipped_leagues = 0

    for lg, info in leagues.items():
        if info["completed_with_summary"] >= 3:
            skipped_leagues += 1
            continue

        needed = 3 - info["completed_with_summary"]
        sport = info["sport"]

        # Try to scrape results for some upcoming matches
        # (they might have already been played but our API missed them)
        for room_data in info["upcoming_rooms"][:needed]:
            try:
                result = await scrape_match_result(room_data.match_name, sport, lg)
                if result:
                    room_data.match_progress = result
                    room_data.status = "completed"
                    from datetime import datetime, timezone
                    room_data.completed_at = datetime.now(timezone.utc)
                    scraped += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"Scrape failed for {room_data.match_name}: {e}")
                failed += 1

            # Rate limit: 1 request per 2 seconds to avoid Google blocking
            await asyncio.sleep(2)

    await db.commit()
    return {
        "scraped_successfully": scraped,
        "scrape_failed": failed,
        "leagues_already_have_3": skipped_leagues,
    }


@router.post("/scrape-league/{league_name}")
async def scrape_league_results(
    league_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Scrape recent match results for a specific league from Google."""
    from app.services.scraper_service import scrape_match_result
    import asyncio

    decoded = league_name
    result = await db.execute(
        select(Room).where(Room.league == decoded).order_by(Room.created_at.desc())
    )
    rooms = result.scalars().all()

    if not rooms:
        return {"error": f"No rooms found for league: {decoded}"}

    sport = rooms[0].sport
    scraped = 0
    failed = 0
    already_done = 0

    for room in rooms:
        mp = room.match_progress or {}
        if mp.get("status") == "completed" and (mp.get("result") or mp.get("scorers")):
            already_done += 1
            continue

        if scraped >= 3:
            break  # Only scrape up to 3 per league

        try:
            scrape_result = await scrape_match_result(room.match_name, sport, decoded)
            if scrape_result:
                room.match_progress = scrape_result
                room.status = "completed"
                from datetime import datetime, timezone
                room.completed_at = datetime.now(timezone.utc)
                scraped += 1
            else:
                failed += 1
        except Exception as e:
            print(f"Scrape failed for {room.match_name}: {e}")
            failed += 1

        await asyncio.sleep(2)

    await db.commit()
    return {
        "league": decoded,
        "sport": sport,
        "scraped": scraped,
        "failed": failed,
        "already_had_results": already_done,
        "total_rooms": len(rooms),
    }


@router.post("/enrich-stats")
async def enrich_match_stats(db: AsyncSession = Depends(get_db)):
    """
    Enrich completed rooms with full match data using Gemini Flash.
    Google Search provides context, Gemini extracts structured data.
    """
    from app.services.match_data_service import fetch_football_match_data, fetch_cricket_match_data
    import asyncio

    result = await db.execute(select(Room).where(Room.status == "completed"))
    rooms = result.scalars().all()

    enriched = 0
    skipped = 0
    failed = 0

    for room in rooms:
        mp = room.match_progress or {}

        # Skip if already enriched with stats
        if mp.get("stats_enriched"):
            skipped += 1
            continue

        parts = room.match_name.split(" vs ")
        if len(parts) != 2:
            continue

        team1 = parts[0].strip()
        team2 = parts[1].strip()

        try:
            if room.sport == "football":
                data = await fetch_football_match_data(team1, team2, room.league or "")
            else:
                data = await fetch_cricket_match_data(team1, team2, room.league or "")

            if data:
                room.match_progress = data
                enriched += 1
            else:
                failed += 1
        except Exception as e:
            print(f"Gemini enrich error for {room.match_name}: {e}")
            failed += 1

        # Rate limit: Gemini free tier is 15 RPM
        await asyncio.sleep(4)

        # Process max 3 per call to stay within Render's request timeout
        if enriched + failed >= 3:
            break

    await db.commit()
    return {"enriched": enriched, "skipped": skipped, "failed": failed}


@router.get("/sync-status")
async def sync_status(db: AsyncSession = Depends(get_db)):
    """Get current room counts by sport and status."""
    result = await db.execute(select(Room).order_by(Room.created_at.desc()))
    rooms = result.scalars().all()

    stats = {
        "cricket": {"live": 0, "upcoming": 0, "completed": 0},
        "football": {"live": 0, "upcoming": 0, "completed": 0},
    }
    room_list = []
    for r in rooms:
        sp = r.sport or "cricket"
        st = r.status or "upcoming"
        if sp in stats and st in stats[sp]:
            stats[sp][st] += 1
        room_list.append({
            "id": str(r.id),
            "match_name": r.match_name,
            "sport": r.sport,
            "league": r.league,
            "status": r.status,
            "match_format": r.match_format,
        })

    return {
        "total_rooms": len(rooms),
        "by_sport": stats,
        "rooms": room_list[:30],
    }


# ── Squad Management ──

from app.models.match_squad import MatchSquad
from pydantic import BaseModel
from typing import List


class PlayerEntry(BaseModel):
    player_id: str
    player_name: str
    team: str
    player_role: str = ""


class SquadEntry(BaseModel):
    players: List[PlayerEntry]


@router.post("/squads/{room_id}")
async def set_match_squads(
    room_id: str,
    body: SquadEntry,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: replace the squad for a match. Used by the manual CSV-upload
    flow when the live data sources (ESPN / Gemini) can't fill it."""
    import uuid as _uuid

    # Verify room exists
    room_result = await db.execute(select(Room).where(Room.id == _uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()
    if not room:
        return {"error": "Room not found"}

    # Clear existing squads for this room
    await db.execute(delete(MatchSquad).where(MatchSquad.room_id == _uuid.UUID(room_id)))

    # Insert new players
    added = 0
    for p in body.players:
        squad = MatchSquad(
            room_id=_uuid.UUID(room_id),
            player_id=p.player_id,
            player_name=p.player_name,
            team=p.team,
            player_role=p.player_role,
        )
        db.add(squad)
        added += 1

    await db.commit()
    return {
        "room_id": room_id,
        "match_name": room.match_name,
        "players_added": added,
    }


async def _populate_match_squads(db: AsyncSession, room: Room) -> dict:
    """
    Refresh the match_squads rows for a room from the live data source. For
    football this calls grounded Gemini (Google Search) so we get the current
    season's first-team roster instead of stale training-cutoff data. For
    cricket the existing CricketAdapter chain (ESPN → CricketData → Gemini)
    is reused.

    Returns a dict with counts; does NOT raise if the source had no data —
    leaves any existing rows alone in that case.
    """
    import uuid as _uuid
    from datetime import datetime, timezone as _tz
    from app.services.live_score_service import fetch_squad_via_gemini

    players: list[dict] = []
    if room.sport == "football":
        # Football: try ESPN's match summary first — it carries the actual
        # match-day squads (starters + named subs, with current 2025/26
        # rosters) and is way more reliable than Gemini guessing. Only fall
        # back to grounded Gemini if ESPN doesn't return a roster (e.g. the
        # event id wasn't an ESPN id, or ESPN hasn't published rosters yet).
        try:
            from app.services.espn_service import get_espn_football_squad, FOOTBALL_LEAGUES
            league_slug = FOOTBALL_LEAGUES.get(room.league or "")
            event_id = (room.match_id or "").replace("espn_", "").strip()
            if league_slug and event_id:
                # force=True so admin refreshes always re-query ESPN — the
                # cache TTL is 6h and we don't want a stale entry pinning the
                # roster when an admin explicitly asked for a refresh.
                result = await get_espn_football_squad(event_id, league_slug, force=True)
                if isinstance(result, list) and len(result) > 0:
                    players = result
                    print(f"Squad sync (football) for {room.match_name}: ESPN returned {len(players)} players")
        except Exception as e:
            print(f"Squad sync (football, ESPN) failed for {room.match_name}: {e}")

        if not players:
            # force=True skips the 7-day Redis cache so an explicit admin refresh
            # always re-queries Gemini instead of returning a stale or empty hit.
            try:
                result = await fetch_squad_via_gemini(room.match_name, "football", force=True)
                print(f"Squad sync (football) for {room.match_name}: Gemini fallback returned {len(result) if isinstance(result, list) else 'None'} players")
                if isinstance(result, list):
                    players = result
            except Exception as e:
                print(f"Squad sync (football, gemini) failed for {room.match_name}: {e}")
    else:
        # Cricket: lean on the adapter's own player-lookup chain.
        try:
            adapter = get_adapter(room.sport)
            if hasattr(adapter, "set_match_context"):
                adapter.set_match_context(room.match_name)
            if hasattr(adapter, "get_match_players"):
                result = await adapter.get_match_players(room.match_id)
                if isinstance(result, list):
                    players = result
        except Exception as e:
            print(f"Squad sync ({room.sport}) failed for {room.match_name}: {e}")

    if not players:
        return {
            "room_id": str(room.id),
            "match_name": room.match_name,
            "players_added": 0,
            "skipped_reason": "no_data_from_source",
        }

    # Replace existing rows in a single transaction so a partial sync can't
    # leave the squad in a half-old/half-new state.
    await db.execute(delete(MatchSquad).where(MatchSquad.room_id == room.id))
    added = 0
    for p in players:
        try:
            squad = MatchSquad(
                room_id=room.id,
                player_id=str(p.get("player_id") or f"t_{added + 1}"),
                player_name=str(p.get("player_name") or "")[:100],
                team=str(p.get("team") or "")[:50],
                player_role=str(p.get("role") or p.get("player_role") or "")[:30],
            )
            db.add(squad)
            added += 1
        except Exception as e:
            print(f"Skipped malformed player from sync: {p} ({e})")

    room.squads_last_refreshed_at = datetime.now(_tz.utc)
    await db.commit()
    return {
        "room_id": str(room.id),
        "match_name": room.match_name,
        "players_added": added,
        "squads_last_refreshed_at": room.squads_last_refreshed_at.isoformat(),
    }


@router.post("/rooms/{room_id}/refresh-squads")
async def admin_refresh_squads(
    room_id: str,
    _admin: str = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually pull current squads from the live data source for this room."""
    import uuid as _uuid
    result = await db.execute(select(Room).where(Room.id == _uuid.UUID(room_id)))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return await _populate_match_squads(db, room)


@router.get("/squads/{room_id}")
async def get_match_squads(room_id: str, db: AsyncSession = Depends(get_db)):
    """Get squads for a match room."""
    import uuid as _uuid
    result = await db.execute(
        select(MatchSquad).where(MatchSquad.room_id == _uuid.UUID(room_id))
    )
    squads = result.scalars().all()

    # Group by team
    teams: dict = {}
    for s in squads:
        if s.team not in teams:
            teams[s.team] = []
        teams[s.team].append({
            "player_id": s.player_id,
            "player_name": s.player_name,
            "team": s.team,
            "player_role": s.player_role or "",
        })

    return {
        "room_id": room_id,
        "total_players": len(squads),
        "teams": teams,
    }
