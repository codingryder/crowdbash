from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.models.room import Room
from app.services.sport_service import get_adapter
import re

router = APIRouter()

# ── Allowed cricket leagues / series keywords ──
# Only matches whose "series" field contains one of these keywords will be synced.
ALLOWED_CRICKET_KEYWORDS = [
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
    # International bilateral series (keyword patterns)
    "tour of",   # e.g. "India tour of England, 2026"
    "T20I Series", "ODI Series", "Test Series",
]

# Match formats that indicate international matches
INTERNATIONAL_FORMATS = ["t20i", "odi", "test"]


def _is_allowed_cricket(series: str, match_format: str) -> bool:
    """Check if a cricket match belongs to an allowed league or is international."""
    series_lower = series.lower()
    fmt_lower = match_format.lower()

    # Allow if format is international
    if fmt_lower in INTERNATIONAL_FORMATS:
        return True

    # Allow if series matches any keyword
    for keyword in ALLOWED_CRICKET_KEYWORDS:
        if keyword.lower() in series_lower:
            return True

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

        # Skip completed
        if status == "completed":
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

        room = Room(
            match_id=str(match_id),
            match_name=clean_name,
            match_format=match_format,
            venue=venue,
            sport=sport,
            league=league,
            status=status,
            match_progress={},
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
