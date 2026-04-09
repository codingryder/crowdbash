from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.room import Room
import re
from app.services.sport_service import get_adapter
from typing import Optional

router = APIRouter()

# Popular leagues to prioritize for room creation
POPULAR_CRICKET_LEAGUES = [
    "Indian Premier League", "IPL",
    "Pakistan Super League", "PSL",
    "Big Bash League", "BBL",
    "Caribbean Premier League", "CPL",
    "SA20",
    "ICC", "World Cup", "Champions Trophy",
    "County Championship",
    "tour of", "T20I", "ODI", "Test",
]

POPULAR_FOOTBALL_LEAGUES = [
    "Premier League", "La Liga", "Serie A", "Bundesliga",
    "Ligue 1", "Eredivisie", "Champions League", "Europa League",
    "World Cup", "Euro", "Copa",
]


@router.post("/sync-rooms/{sport}")
async def sync_rooms_from_live_matches(
    sport: str,
    include_upcoming: bool = Query(True, description="Also create rooms for upcoming matches"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch matches from the sport API and create rooms for any
    that don't already exist. Includes live + upcoming matches.
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

            if ms == "live":
                status = "live"
            elif ms == "result":
                status = "completed"
            else:
                status = "upcoming"

            # Skip upcoming matches if not requested
            if not include_upcoming and status == "upcoming":
                continue

        elif sport == "football":
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

        # Skip completed matches
        if status == "completed":
            continue

        # Check if room already exists
        existing = await db.execute(
            select(Room).where(Room.match_id == str(match_id))
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Clean up match name — remove team codes in brackets
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
    }


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
        sport = r.sport or "cricket"
        status = r.status or "upcoming"
        if sport in stats and status in stats[sport]:
            stats[sport][status] += 1
        room_list.append({
            "id": str(r.id),
            "match_name": r.match_name,
            "sport": r.sport,
            "league": r.league,
            "status": r.status,
        })

    return {
        "total_rooms": len(rooms),
        "by_sport": stats,
        "rooms": room_list[:20],
    }
