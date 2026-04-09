from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.room import Room
from app.services.sport_service import get_adapter

router = APIRouter()


@router.post("/sync-rooms/{sport}")
async def sync_rooms_from_live_matches(
    sport: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch live matches from the sport API and create rooms for any
    that don't already exist. Called periodically or manually.
    """
    try:
        adapter = get_adapter(sport)
    except ValueError:
        return {"error": f"Unknown sport: {sport}"}

    live_matches = await adapter.get_live_matches()
    created = 0
    skipped = 0

    for match in live_matches:
        # Normalize match data based on sport
        if sport == "cricket":
            match_id = match.get("id", "")
            match_name = match.get("name", "") or match.get("matchType", "")
            match_format = match.get("matchType", "")
            venue = match.get("venue", "")
            league = match.get("series", "") or match.get("league", "")
            status = "live" if match.get("matchStarted", False) else "upcoming"
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
            status = "live" if status_raw in ("IN_PLAY", "PAUSED", "LIVE") else "upcoming"
        else:
            continue

        if not match_id:
            continue

        # Check if room already exists for this match
        existing = await db.execute(
            select(Room).where(Room.match_id == str(match_id))
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        room = Room(
            match_id=str(match_id),
            match_name=match_name,
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
        "live_matches_found": len(live_matches),
        "rooms_created": created,
        "rooms_skipped": skipped,
    }


@router.get("/sync-status")
async def sync_status(db: AsyncSession = Depends(get_db)):
    """Get current room counts by sport and status."""
    result = await db.execute(select(Room))
    rooms = result.scalars().all()

    stats = {"cricket": {"live": 0, "upcoming": 0, "completed": 0}, "football": {"live": 0, "upcoming": 0, "completed": 0}}
    for r in rooms:
        sport = r.sport or "cricket"
        status = r.status or "upcoming"
        if sport in stats and status in stats[sport]:
            stats[sport][status] += 1

    return {"total_rooms": len(rooms), "by_sport": stats}
