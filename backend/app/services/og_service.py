"""
Open Graph helpers for share links.

We deliberately use the SAME general Crowdbash poster (frontend's
/og.png) for every room — the per-room title/description still
customizes the unfurl, but the image stays consistent for brand
recognition. This keeps Pillow off the backend and means the image
is served statically by Vercel's CDN.
"""
from __future__ import annotations

from typing import Tuple

from app.models.room import Room


# ── Cricket abbreviations (mirrors the frontend cricketAbbr map) ───────────
CRICKET_ABBR = {
    "mumbai indians": "MI",
    "chennai super kings": "CSK",
    "royal challengers bengaluru": "RCB",
    "royal challengers bangalore": "RCB",
    "kolkata knight riders": "KKR",
    "delhi capitals": "DC",
    "sunrisers hyderabad": "SRH",
    "punjab kings": "PBKS",
    "rajasthan royals": "RR",
    "gujarat titans": "GT",
    "lucknow super giants": "LSG",
    "india": "IND", "australia": "AUS", "england": "ENG", "pakistan": "PAK",
    "south africa": "SA", "new zealand": "NZ", "west indies": "WI",
    "sri lanka": "SL", "bangladesh": "BAN", "afghanistan": "AFG",
    "zimbabwe": "ZIM", "ireland": "IRE", "scotland": "SCO",
    "netherlands": "NED", "nepal": "NEP", "oman": "OMA", "usa": "USA",
}


def _team_abbr(name: str, sport: str) -> str:
    if not name:
        return "TBD"
    key = " ".join(name.strip().lower().split())
    if sport == "cricket":
        if key in CRICKET_ABBR:
            return CRICKET_ABBR[key]
        return key[:3].upper()
    words = [w for w in name.replace("-", " ").split() if w]
    if len(words) >= 3:
        return ("".join(w[0] for w in words))[:3].upper()
    if len(words) == 2:
        return (words[0][0] + words[1][:2]).upper()
    return words[0][:3].upper() if words else "TBD"


def _split_teams(match_name: str) -> Tuple[str, str]:
    if not match_name:
        return ("Team A", "Team B")
    for sep in (" vs ", " VS ", " v ", " V "):
        if sep in match_name:
            parts = match_name.split(sep, 1)
            return (parts[0].strip(), parts[1].strip())
    return (match_name.strip(), "")


def cache_max_age_for_room(room: Room) -> int:
    """Cache-Control max-age in seconds for the share HTML stub."""
    if room.status == "locked":
        return 60
    if room.status == "closed":
        return 3600
    return 300


def share_html_for_room(room: Room, frontend_url: str) -> str:
    """
    Tiny HTML stub for /share/room/{id}. Crawlers parse the og:* tags;
    humans get redirected via meta-refresh + JS to the SPA route.

    Title and description ARE customized per room (so WhatsApp / Twitter
    show "MI vs RCB · Indian Premier League · Crowdbash" as the headline)
    but the image is the same general /og.png poster for brand consistency.
    """
    sport = (room.sport or "cricket").lower()
    sport_label = "Cricket" if sport == "cricket" else "Football"
    league = room.league or room.match_format or sport_label

    t1, t2 = _split_teams(room.match_name or "")
    a1 = _team_abbr(t1, sport)
    a2 = _team_abbr(t2, sport)
    title = f"{a1} vs {a2} · {league} · Crowdbash"

    if room.status == "locked":
        desc = (
            f"{room.match_name} is live now. Join the fantasy room and "
            "reshuffle your power before the next blind window."
        )
    elif room.status == "closed":
        desc = (
            f"Match result for {room.match_name}. See the final leaderboard, "
            "fantasy MVP, and squad recap."
        )
    else:
        desc = (
            f"Build your fantasy XI for {room.match_name}, assign 33 power "
            "across your players, and reshuffle live."
        )

    def esc(s: str) -> str:
        return (
            s.replace("&", "&amp;")
             .replace('"', "&quot;")
             .replace("<", "&lt;")
             .replace(">", "&gt;")
        )

    fe = frontend_url.rstrip("/")
    target = f"{fe}/room/{room.id}"
    image_url = f"{fe}/og.png"

    title_e = esc(title)
    desc_e = esc(desc)
    image_e = esc(image_url)
    target_e = esc(target)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{title_e}</title>
  <meta name="description" content="{desc_e}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Crowdbash" />
  <meta property="og:url" content="{target_e}" />
  <meta property="og:title" content="{title_e}" />
  <meta property="og:description" content="{desc_e}" />
  <meta property="og:image" content="{image_e}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Crowdbash — Live cricket &amp; football fantasy" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title_e}" />
  <meta name="twitter:description" content="{desc_e}" />
  <meta name="twitter:image" content="{image_e}" />

  <!-- Redirect humans -->
  <meta http-equiv="refresh" content="0; url={target_e}" />
  <link rel="canonical" href="{target_e}" />
</head>
<body style="background:#1a1b1e;color:#f0f0f4;font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:60px 20px;">
  <p>Opening Crowdbash…</p>
  <p><a href="{target_e}" style="color:#2dd67a;">Continue to the room →</a></p>
  <script>window.location.replace({target_e!r});</script>
</body>
</html>
"""
