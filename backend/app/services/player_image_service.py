"""
Player image lookups via Wikipedia REST API.

Free, unlimited, no auth. Thumbnail URLs are CC-licensed; safe to hotlink
from the frontend. We cache the URL (or a "not found" tombstone) in the
player_images table keyed by lowercased name, so each player is fetched
at most once across all rooms.

Coverage is partial (~60% of well-known IPL players, ~0% for new/obscure
ones). The frontend falls back to an initials avatar when image_url is
None, so missing data degrades gracefully.
"""
import asyncio
import re
from typing import Iterable

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
HEADERS = {"User-Agent": "crowdbash/1.0 (https://crowdbash.app)"}
HTTP_TIMEOUT = 6.0
# Tomestone retry: re-attempt "not_found" rows after this many days, in case
# the player got a Wikipedia page since.
NOT_FOUND_RETRY_DAYS = 14


def _normalize_key(name: str) -> str:
    """Lowercased, whitespace-collapsed key for dedupe across casing variants."""
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def _wiki_title_candidates(name: str, sport: str = "cricket") -> list[str]:
    """
    Wikipedia titles to try in order. We prefer the disambiguated form
    (e.g. "Yashasvi_Jaiswal") then fall back to "<Name>_(cricketer)" or
    "<Name>_(footballer)" since many sports pages use that pattern.
    """
    base = name.strip().replace(" ", "_")
    if not base:
        return []
    suffix = "(cricketer)" if sport == "cricket" else "(footballer)"
    return [base, f"{base}_{suffix}"]


async def _fetch_wikipedia_thumbnail(client: httpx.AsyncClient, name: str, sport: str) -> str | None:
    """Try a couple of Wikipedia titles. Return thumbnail URL or None."""
    for title in _wiki_title_candidates(name, sport):
        try:
            res = await client.get(
                WIKIPEDIA_SUMMARY_URL.format(title=title),
                headers=HEADERS,
                timeout=HTTP_TIMEOUT,
                follow_redirects=True,
            )
            if res.status_code != 200:
                continue
            data = res.json()
            # Skip disambiguation pages — they rarely have a real photo
            if data.get("type") == "disambiguation":
                continue
            thumb = (data.get("thumbnail") or {}).get("source")
            if thumb:
                return thumb
        except Exception:
            continue
    return None


async def get_image_urls_for_players(
    db: AsyncSession,
    players: Iterable[dict],
    sport: str = "cricket",
) -> dict[str, str | None]:
    """
    Look up image URLs for a list of player records (each with at least a
    `player_name` field). Returns a dict keyed by normalized name.

    Cached hits return immediately. Misses are fetched from Wikipedia in
    parallel and persisted (URL or tombstone) for next time.
    """
    by_key: dict[str, str] = {}
    for p in players:
        nm = (p.get("player_name") or "").strip()
        if not nm:
            continue
        by_key.setdefault(_normalize_key(nm), nm)

    if not by_key:
        return {}

    keys = list(by_key.keys())
    rows = await db.execute(
        text(
            "SELECT name_key, image_url, not_found, "
            "EXTRACT(EPOCH FROM (NOW() - fetched_at))/86400 AS age_days "
            "FROM player_images WHERE name_key = ANY(:keys)"
        ),
        {"keys": keys},
    )
    cached: dict[str, str | None] = {}
    needs_refetch: list[str] = []
    for row in rows.mappings():
        k = row["name_key"]
        if row["not_found"] and (row["age_days"] or 0) >= NOT_FOUND_RETRY_DAYS:
            needs_refetch.append(k)
        else:
            cached[k] = row["image_url"]

    missing = [k for k in keys if k not in cached] + needs_refetch
    if not missing:
        return cached

    # Fan out to Wikipedia for the misses
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[_fetch_wikipedia_thumbnail(client, by_key[k], sport) for k in missing],
            return_exceptions=True,
        )

    fetched: dict[str, str | None] = {}
    for k, res in zip(missing, results):
        url = res if isinstance(res, str) else None
        fetched[k] = url
        try:
            await db.execute(
                text(
                    "INSERT INTO player_images (name_key, display_name, image_url, source, not_found, fetched_at) "
                    "VALUES (:k, :dn, :u, 'wikipedia', :nf, NOW()) "
                    "ON CONFLICT (name_key) DO UPDATE SET "
                    "image_url = EXCLUDED.image_url, "
                    "not_found = EXCLUDED.not_found, "
                    "fetched_at = NOW()"
                ),
                {"k": k, "dn": by_key[k][:160], "u": url, "nf": url is None},
            )
        except Exception as e:
            print(f"player_images upsert failed for {by_key[k]}: {e}")
    try:
        await db.commit()
    except Exception:
        await db.rollback()

    cached.update(fetched)
    return cached


async def attach_image_urls(
    db: AsyncSession,
    players: list[dict],
    sport: str = "cricket",
) -> list[dict]:
    """
    Mutate each player dict in `players` to add `image_url`. Returns the
    same list for chaining. Safe to call with empty input.
    """
    if not players:
        return players
    url_by_key = await get_image_urls_for_players(db, players, sport)
    for p in players:
        nm = (p.get("player_name") or "").strip()
        p["image_url"] = url_by_key.get(_normalize_key(nm)) if nm else None
    return players
