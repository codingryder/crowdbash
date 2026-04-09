from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.models.room import Room
from app.services.sport_service import get_adapter
import re

router = APIRouter()

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

        # Rate limit: Gemini free tier is 15 RPM, plus Google search needs gaps
        await asyncio.sleep(5)

        # Process up to 10 per call to stay within Gemini limits
        if enriched + failed >= 10:
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
