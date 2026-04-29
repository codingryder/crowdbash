from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.game import Game, PlayerWeightage
from app.models.room import Room
from app.models.match_squad import MatchSquad
from app.services.game_service import update_weightages
from app.services.sport_service import get_adapter
from app.services.player_image_service import attach_image_urls
from pydantic import BaseModel
import uuid
from typing import List
from datetime import datetime, timezone

router = APIRouter()

TOTAL_BUDGET = 33
MAX_SQUAD_SIZE = 11

# Cricket — per-team role caps. WK has no upper cap; the minimum of 1 is
# enforced separately.
ROLE_CAPS = {"batsman": 6, "all-rounder": 3, "bowler": 5}
MIN_WICKET_KEEPERS = 1

# Football — (min, max) per role, summing to 11. Defaults assume a free-form
# composition broadly compatible with 4-3-3, 4-4-2, 3-5-2, 5-3-2 etc.
FOOTBALL_ROLE_CAPS: dict[str, tuple[int, int]] = {
    "GK": (1, 1),
    "DEF": (3, 5),
    "MID": (3, 5),
    "FW": (1, 3),
}
FOOTBALL_ROLE_LABELS = {"GK": "goalkeeper", "DEF": "defender", "MID": "midfielder", "FW": "forward"}


def _role_key(role: str) -> str:
    """Normalize player_role to a canonical cricket key matching ROLE_CAPS."""
    r = (role or "").lower()
    if "keep" in r or r == "wk":
        return "wicket-keeper"
    if "all" in r:
        return "all-rounder"
    if "bowl" in r:
        return "bowler"
    if "bat" in r:
        return "batsman"
    return r


def _football_role_key(role: str) -> str:
    """Normalize football player_role to a canonical key in FOOTBALL_ROLE_CAPS."""
    r = (role or "").upper().strip()
    if not r:
        return ""
    if r in {"GK", "G"} or "GOAL" in r or "KEEPER" in r:
        return "GK"
    if r in {"DEF", "D", "DF", "CB", "LB", "RB", "LWB", "RWB"} or "DEFEN" in r or "BACK" in r:
        return "DEF"
    if r in {"MID", "M", "MF", "CM", "CDM", "CAM", "LM", "RM"} or "MID" in r:
        return "MID"
    if r in {"FW", "F", "FWD", "ST", "CF", "LW", "RW"} or "FORW" in r or "ATTACK" in r or "STRIK" in r or "WING" in r:
        return "FW"
    return ""


def _validate_role_composition(roles: list[str], sport: str = "cricket") -> str | None:
    """Return an error message if the role mix violates the sport's caps; None if valid."""
    if (sport or "cricket").lower() == "football":
        return _validate_football_composition(roles)

    counts: dict[str, int] = {}
    for r in roles:
        k = _role_key(r)
        counts[k] = counts.get(k, 0) + 1
    for role, cap in ROLE_CAPS.items():
        if counts.get(role, 0) > cap:
            label = {"batsman": "batsmen", "all-rounder": "all-rounders", "bowler": "bowlers"}[role]
            return f"Too many {label}: max {cap} allowed."
    if counts.get("wicket-keeper", 0) < MIN_WICKET_KEEPERS:
        return f"Pick at least {MIN_WICKET_KEEPERS} wicket-keeper."
    return None


def _validate_football_composition(roles: list[str]) -> str | None:
    counts: dict[str, int] = {k: 0 for k in FOOTBALL_ROLE_CAPS}
    unknown = 0
    for r in roles:
        k = _football_role_key(r)
        if k in counts:
            counts[k] += 1
        else:
            unknown += 1
    if unknown > 0:
        return f"{unknown} player(s) have unrecognised positions. Pick players whose role is goalkeeper, defender, midfielder, or forward."
    for role, (lo, hi) in FOOTBALL_ROLE_CAPS.items():
        c = counts[role]
        label = FOOTBALL_ROLE_LABELS[role]
        plural_label = label + "s"
        if c < lo:
            return f"Pick at least {lo} {label if lo == 1 else plural_label}."
        if c > hi:
            return f"Too many {plural_label}: max {hi} allowed."
    return None


# Late-join windows: allow team building after match starts for specific rooms.
# Map of room_id -> sport-specific config:
#   cricket: {"sport": "cricket", "max_innings": int, "max_over": float}
#     window open while innings <= max_innings AND over < max_over
#   football: {"sport": "football", "max_minute": float}
#     window open while in-game minute < max_minute (45 = until half-time)
LATE_JOIN_ROOMS: dict[str, dict] = {
    # RR v SRH (one-off): allow joining and team building up to over 10 of innings 1
    "1b07c88d-6547-43f5-a72c-254864b0689d": {"sport": "cricket", "max_innings": 1, "max_over": 10.0},
    # PSG v Bayern (one-off): allow joining and team building until half-time.
    "582582aa-9e64-40c3-aa1d-9598a88777b3": {"sport": "football", "max_minute": 45.0},
}


def is_late_join_open(room: Room | None) -> bool:
    """True if the room has an active late-join window based on current match progress."""
    if not room:
        return False

    # Admin override: if the per-room late_join_enabled flag is set, the
    # window stays open until match completion regardless of hardcoded caps.
    # Lets admins extend team-build past kickoff for any room without
    # editing LATE_JOIN_ROOMS and redeploying.
    if getattr(room, "late_join_enabled", False) and room.status != "closed":
        return True

    # An active player-edit window (admin-opened, distinct from the
    # reshuffle window) opens the late-join door for its duration. The
    # reshuffle window does NOT — that's blind power-only by design.
    pe_closes_at = getattr(room, "player_edit_window_closes_at", None)
    if pe_closes_at is not None:
        from datetime import datetime as _dt, timezone as _tz
        ca = pe_closes_at if pe_closes_at.tzinfo else pe_closes_at.replace(tzinfo=_tz.utc)
        if ca > _dt.now(_tz.utc):
            return True

    cfg = LATE_JOIN_ROOMS.get(str(room.id))
    if not cfg:
        return False
    sport = (cfg.get("sport") or room.sport or "cricket").lower()
    progress = room.match_progress or {}

    if sport == "football":
        minute = float(progress.get("minute", 0) or 0)
        # Match not started yet (minute=0 + room.status='open' or 'locked' just
        # set) — treat as open. Closes once we cross max_minute, including
        # any stoppage time within the first half.
        if minute <= 0:
            return True
        return minute < float(cfg.get("max_minute", 45.0))

    # Cricket (default for backward compat with the original config shape).
    innings = int(progress.get("innings", 0) or 0)
    over = float(progress.get("over", 0) or 0)
    if innings == 0:
        # Match not started yet
        return True
    return innings <= int(cfg.get("max_innings", 1)) and over < float(cfg.get("max_over", 0))


class SelectSquadRequest(BaseModel):
    player_ids: List[str]


class WeightageUpdate(BaseModel):
    player_id: str
    weightage: int


class UpdateWeightagesRequest(BaseModel):
    weightages: List[WeightageUpdate]


@router.post("/join/{room_id}")
async def join_game(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Join a game in a room."""
    room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    existing = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already joined this room")

    # Block joining once the match is locked or finished. Late-join window is the
    # only escape hatch (currently configured per-room in LATE_JOIN_ROOMS).
    if room.status != "open" and not is_late_join_open(room):
        raise HTTPException(
            status_code=403,
            detail="Match has started. You can spectate but can't join the game.",
        )

    game = Game(room_id=uuid.UUID(room_id), user_id=user_id, total_budget=TOTAL_BUDGET)
    db.add(game)
    await db.commit()
    return {"game_id": str(game.id), "message": "Joined! Now select your 11 players."}


@router.get("/{room_id}/squads")
async def get_available_squads(
    room_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get available squads. Auto-fetches from API if not in DB."""
    result = await db.execute(
        select(MatchSquad).where(MatchSquad.room_id == uuid.UUID(room_id))
    )
    squads = result.scalars().all()

    if not squads:
        room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
        room = room_result.scalar_one_or_none()
        if room:
            try:
                adapter = get_adapter(room.sport)
                if hasattr(adapter, 'set_match_context'):
                    adapter.set_match_context(room.match_name, room.league or '')
                api_players = await adapter.get_match_players(room.match_id)
                for p in api_players:
                    sq = MatchSquad(
                        room_id=uuid.UUID(room_id),
                        player_id=p.get("player_id", ""),
                        player_name=p.get("player_name", ""),
                        team=p.get("team", ""),
                        player_role=p.get("role", ""),
                    )
                    db.add(sq)
                await db.commit()
                result = await db.execute(
                    select(MatchSquad).where(MatchSquad.room_id == uuid.UUID(room_id))
                )
                squads = result.scalars().all()
            except Exception as e:
                print(f"Failed to fetch squads from API: {e}")

    teams: dict = {}
    flat: list[dict] = []
    for s in squads:
        if s.team not in teams:
            teams[s.team] = []
        rec = {
            "player_id": s.player_id,
            "player_name": s.player_name,
            "team": s.team,
            "player_role": s.player_role or "",
        }
        teams[s.team].append(rec)
        flat.append(rec)

    # Enrich with Wikipedia thumbnails (cached). Missing images are fine —
    # the frontend falls back to initials.
    room_for_sport = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    _r = room_for_sport.scalar_one_or_none()
    try:
        await attach_image_urls(db, flat, sport=(_r.sport if _r else "cricket"))
    except Exception as e:
        print(f"player image enrich (squads) failed: {e}")

    return {"teams": teams, "total_players": len(squads)}


@router.post("/{room_id}/select-squad")
async def select_squad(
    room_id: str,
    body: SelectSquadRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Select 11 players. Only allowed BEFORE match starts."""
    if len(body.player_ids) != MAX_SQUAD_SIZE:
        raise HTTPException(status_code=400, detail=f"Must select exactly {MAX_SQUAD_SIZE} players.")

    # Check room status — player changes only before match (or during late-join window)
    room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()
    late_join = is_late_join_open(room)
    if room and room.status == "locked" and not late_join:
        raise HTTPException(status_code=400, detail="Match has started. Player changes are no longer allowed.")

    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Join the room first")

    # Allow re-selection if room is still open OR the late-join window is active
    if game.squad_locked and room and room.status != "open" and not late_join:
        raise HTTPException(status_code=400, detail="Match has started. Squad is locked.")

    # Unlock squad if room is still open or late-join active (user is re-editing)
    if game.squad_locked and room and (room.status == "open" or late_join):
        game.squad_locked = False
        game.squad_locked_at = None

    # Validate players exist in squads
    squad_result = await db.execute(
        select(MatchSquad).where(MatchSquad.room_id == uuid.UUID(room_id))
    )
    available = {s.player_id: s for s in squad_result.scalars().all()}
    for pid in body.player_ids:
        if pid not in available:
            raise HTTPException(status_code=400, detail=f"Player {pid} not in match squads")

    # Enforce role caps. Cricket: max 6 BAT / 5 BOWL / 3 AR + min 1 WK.
    # Football: GK exactly 1, DEF/MID 3-5, FW 1-3, must sum to 11.
    role_error = _validate_role_composition(
        [available[pid].player_role or "" for pid in body.player_ids],
        sport=(room.sport if room else "cricket"),
    )
    if role_error:
        raise HTTPException(status_code=400, detail=role_error)

    # Clear previous selections using bulk DELETE
    from sqlalchemy import delete
    await db.execute(delete(PlayerWeightage).where(PlayerWeightage.game_id == game.id))
    await db.flush()

    for pid in body.player_ids:
        s = available[pid]
        pw = PlayerWeightage(
            game_id=game.id,
            player_id=s.player_id,
            player_name=s.player_name,
            team=s.team[:10],
            player_role=s.player_role,
            selected=True,
            weightage=0,
        )
        db.add(pw)

    await db.commit()
    return {"message": "Squad selected! Now allocate weightage points.", "players": len(body.player_ids)}


@router.post("/{room_id}/lock-squad")
async def lock_squad(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually lock squad before match (optional — auto-locks when match starts)."""
    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.squad_locked:
        raise HTTPException(status_code=400, detail="Already locked")

    wt_result = await db.execute(
        select(PlayerWeightage).where(PlayerWeightage.game_id == game.id, PlayerWeightage.selected == True)
    )
    weightages = wt_result.scalars().all()
    if len(weightages) != MAX_SQUAD_SIZE:
        raise HTTPException(status_code=400, detail="Select 11 players first")

    total = sum(w.weightage for w in weightages)
    if total != TOTAL_BUDGET:
        raise HTTPException(status_code=400, detail=f"Weightages must total {TOTAL_BUDGET}. Currently {total}.")

    game.squad_locked = True
    game.squad_locked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Squad locked! Good luck!"}


@router.get("/{room_id}")
async def get_game_state(
    room_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get full game state including room status for lock rules."""
    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    room_result = await db.execute(select(Room).where(Room.id == game.room_id))
    room = room_result.scalar_one_or_none()

    wt_result = await db.execute(select(PlayerWeightage).where(PlayerWeightage.game_id == game.id))
    weightages = wt_result.scalars().all()

    # Determine if editing is allowed
    match_started = room and room.status == "locked"
    late_join = is_late_join_open(room)
    can_edit_players = (not match_started or late_join) and not game.squad_locked
    can_edit_weightages = not match_started or False  # During match: only in edit window (handled by frontend)

    player_weightages = [
        {
            "player_id": pw.player_id,
            "player_name": pw.player_name,
            "team": pw.team,
            "weightage": pw.weightage,
            "points_earned": pw.points_earned,
            "player_role": pw.player_role,
            "scoring_breakdown": pw.scoring_breakdown or {},
            "selected": pw.selected,
        }
        for pw in weightages
    ]
    try:
        await attach_image_urls(db, player_weightages, sport=(room.sport if room else "cricket"))
    except Exception as e:
        print(f"player image enrich (game state) failed: {e}")

    return {
        "id": str(game.id),
        "room_id": str(game.room_id),
        "user_id": str(game.user_id),
        "mode": game.mode,
        "total_points": game.total_points,
        "extra_weightage_used": game.extra_weightage_used,
        "status": game.status,
        "rank": game.rank,
        "squad_locked": game.squad_locked,
        "total_budget": game.total_budget,
        "match_started": match_started,
        "late_join_open": late_join,
        "can_edit_players": can_edit_players,
        "can_edit_weightages": can_edit_weightages,
        "player_weightages": player_weightages,
    }


@router.put("/{room_id}/weightages")
async def update_game_weightages(
    room_id: str,
    body: UpdateWeightagesRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Update weightages.
    Before match: free to change anytime.
    During match: only inside the 5-min reshuffle window.
    """
    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == user_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    total = sum(w.weightage for w in body.weightages)
    if total > game.total_budget:
        raise HTTPException(status_code=400, detail=f"Total weightage {total} exceeds budget {game.total_budget}")

    room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()

    adapter = get_adapter(room.sport)
    progress = room.match_progress or {}
    edit_trigger = adapter.get_edit_trigger(progress)

    changes = await update_weightages(
        db, game.id, user_id,
        [w.model_dump() for w in body.weightages],
        edit_trigger,
    )
    return {"changes": changes}


@router.get("/{room_id}/team/{target_user_id}")
async def get_user_team(
    room_id: str,
    target_user_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """View another user's team in the same room. Only visible after the match start time."""
    room_result = await db.execute(select(Room).where(Room.id == uuid.UUID(room_id)))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    match_started = bool(room.match_date and room.match_date <= datetime.now(timezone.utc))
    # Owner can always view their own team; opponents must wait for match start.
    if not match_started and str(user_id) != target_user_id:
        raise HTTPException(status_code=403, detail="Teams are hidden until match starts")

    game_result = await db.execute(
        select(Game).where(Game.room_id == uuid.UUID(room_id), Game.user_id == uuid.UUID(target_user_id))
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Player not found in this room")

    wt_result = await db.execute(select(PlayerWeightage).where(PlayerWeightage.game_id == game.id))
    weightages = wt_result.scalars().all()

    selected_weightages = [
        {
            "player_id": pw.player_id,
            "player_name": pw.player_name,
            "team": pw.team,
            "weightage": pw.weightage,
            "points_earned": pw.points_earned,
            "player_role": pw.player_role,
            "selected": pw.selected,
        }
        for pw in weightages if pw.selected
    ]
    try:
        await attach_image_urls(db, selected_weightages, sport=(room.sport if room else "cricket"))
    except Exception as e:
        print(f"player image enrich (other team) failed: {e}")

    return {
        "user_id": target_user_id,
        "total_points": game.total_points,
        "player_weightages": selected_weightages,
    }
