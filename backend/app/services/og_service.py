"""
Per-room Open Graph image generator.

Renders a 1200×630 PNG poster with team abbreviations, league, sport-
themed accent and match status — used as og:image when someone shares
a Crowdbash room URL on WhatsApp/Twitter/LinkedIn/iMessage.

Cached in Redis: 60s for live, 5min for upcoming, 1h for closed rooms.
The image bytes are returned directly so the route handler can stream
them as image/png.
"""
from __future__ import annotations

import io
import math
import os
from datetime import datetime, timezone
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

from app.models.room import Room


# ── Brand palette (matches frontend CSS vars) ──────────────────────────────
BG = (26, 27, 30)
SURFACE = (38, 40, 45)
GREEN = (45, 214, 122)
AMBER = (245, 158, 11)
BLUE = (74, 158, 255)
RED = (240, 90, 90)
TEXT = (240, 240, 244)
MUTED = (160, 164, 174)
FAINT = (110, 114, 124)
DARK = (7, 26, 14)

W, H = 1200, 630


# ── Cricket abbreviations (mirrors the frontend cricketAbbr map) ───────────
CRICKET_ABBR = {
    # IPL
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
    # Internationals
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
    # Football: 3-letter algorithmic, splits on space and hyphen
    words = [w for w in name.replace("-", " ").split() if w]
    if len(words) >= 3:
        return ("".join(w[0] for w in words))[:3].upper()
    if len(words) == 2:
        return (words[0][0] + words[1][:2]).upper()
    return words[0][:3].upper() if words else "TBD"


def _split_teams(match_name: str) -> tuple[str, str]:
    if not match_name:
        return ("Team A", "Team B")
    for sep in (" vs ", " VS ", " v ", " V "):
        if sep in match_name:
            parts = match_name.split(sep, 1)
            return (parts[0].strip(), parts[1].strip())
    return (match_name.strip(), "")


def _load_font(size: int, weight: str = "bold") -> ImageFont.FreeTypeFont:
    """
    Load a font, walking common system paths. Linux deploys (Render,
    Railway) typically have DejaVu; macOS dev has Helvetica Neue.
    """
    # (path, index) candidates in priority order.
    candidates = []
    if weight == "black":
        candidates += [
            ("/System/Library/Fonts/HelveticaNeue.ttc", 9),  # Condensed Black (mac)
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
            ("/System/Library/Fonts/HelveticaNeue.ttc", 1),  # Bold fallback
        ]
    elif weight == "bold":
        candidates += [
            ("/System/Library/Fonts/HelveticaNeue.ttc", 1),  # Bold (mac)
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
        ]
    else:  # regular / medium
        candidates += [
            ("/System/Library/Fonts/HelveticaNeue.ttc", 0),  # Regular (mac)
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
        ]
    # Common Linux fallbacks regardless of weight
    candidates += [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 0),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
    ]
    for path, idx in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=idx)
            except Exception:
                continue
    return ImageFont.load_default()


def _hex_points(cx: float, cy: float, r: float, rotate: float = -90) -> list:
    return [
        (
            cx + r * math.cos(math.radians(60 * i + rotate)),
            cy + r * math.sin(math.radians(60 * i + rotate)),
        )
        for i in range(6)
    ]


def _format_match_status(room: Room) -> tuple[str, tuple[int, int, int]]:
    """Return (text, color) summarizing the room's current state."""
    if room.status == "locked":
        return ("● LIVE NOW", RED)
    if room.status == "closed":
        return ("MATCH RESULT", MUTED)
    # Open / upcoming
    if room.match_date:
        try:
            md = room.match_date
            # Ensure tz-aware
            if md.tzinfo is None:
                md = md.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            today = now.date()
            tomorrow = today.replace(day=today.day) if False else None  # noqa
            # Simple labels; the time portion is rendered in IST-ish utc
            d = md.date()
            t = md.strftime("%I:%M %p").lstrip("0")
            if d == today:
                return (f"TODAY · {t}", AMBER)
            from datetime import timedelta
            if d == today + timedelta(days=1):
                return (f"TOMORROW · {t}", AMBER)
            return (md.strftime("%b %d · %I:%M %p").replace(" 0", " ").upper(), AMBER)
        except Exception:
            pass
    return ("OPEN", GREEN)


def _draw_pill(
    draw: ImageDraw.ImageDraw,
    x: float, y: float, w: float, h: float,
    fill: tuple, outline: tuple, text: str, font: ImageFont.FreeTypeFont,
    text_color: tuple,
):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=fill, outline=outline, width=1)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x + (w - tw) / 2, y + (h - th) / 2 - 2), text, font=font, fill=text_color)


def render_room_og(room: Room) -> bytes:
    """Render the per-room OG poster as PNG bytes."""
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img, "RGBA")

    sport = (room.sport or "cricket").lower()
    accent = AMBER if sport == "cricket" else BLUE
    sport_emoji_label = "Cricket" if sport == "cricket" else "Football"

    # Soft glow ovals (sport-tinted)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-220, -220, 700, 480], fill=(*accent, 26))
    gd.ellipse([700, 220, 1500, 900], fill=(*GREEN, 18))
    img.paste(glow, (0, 0), glow)

    # Subtle dot grid
    cx0, cy0 = W / 2, H / 2
    for y in range(0, H, 36):
        for x in range(0, W, 36):
            dist = math.hypot(x - cx0, y - cy0) / max(W, H)
            a = max(0, int(34 * (1 - dist * 1.6)))
            if a > 0:
                draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(255, 255, 255, a))

    # ── Top-left: brand strip (logo + wordmark) ────────────────────────────
    logo_x, logo_y = 56, 50
    draw.polygon(_hex_points(logo_x + 22, logo_y + 22, 22), fill=GREEN)
    draw.polygon(_hex_points(logo_x + 22, logo_y + 22, 11), fill=DARK)
    font_brand = _load_font(28, "bold")
    draw.text((logo_x + 60, logo_y + 8), "Crowdbash", font=font_brand, fill=TEXT)

    # ── Top-right: status pill ─────────────────────────────────────────────
    status_text, status_color = _format_match_status(room)
    font_pill = _load_font(20, "bold")
    pad = 28
    pill_h = 38
    bbox = draw.textbbox((0, 0), status_text, font=font_pill)
    pill_w = (bbox[2] - bbox[0]) + pad * 2
    _draw_pill(
        draw,
        W - pill_w - 56, 56, pill_w, pill_h,
        fill=(*status_color, 26),
        outline=(*status_color, 140),
        text=status_text, font=font_pill, text_color=status_color,
    )

    # ── Center: league label ───────────────────────────────────────────────
    league = (room.league or room.match_format or sport_emoji_label).upper()
    if len(league) > 50:
        league = league[:50].rstrip() + "…"
    font_league = _load_font(22, "bold")
    league_bbox = draw.textbbox((0, 0), league, font=font_league)
    league_w = league_bbox[2] - league_bbox[0]
    draw.text(((W - league_w) / 2, 198), league, font=font_league, fill=accent)

    # ── Center: TEAM1  vs  TEAM2 (huge abbreviations) ──────────────────────
    t1, t2 = _split_teams(room.match_name or "")
    a1 = _team_abbr(t1, sport)
    a2 = _team_abbr(t2, sport)

    font_abbr = _load_font(160, "black")
    font_vs = _load_font(54, "bold")

    a1_bbox = draw.textbbox((0, 0), a1, font=font_abbr)
    a2_bbox = draw.textbbox((0, 0), a2, font=font_abbr)
    a1_w = a1_bbox[2] - a1_bbox[0]
    a2_w = a2_bbox[2] - a2_bbox[0]
    vs_bbox = draw.textbbox((0, 0), "vs", font=font_vs)
    vs_w = vs_bbox[2] - vs_bbox[0]

    abbr_y = 270
    gutter = 80
    total_w = a1_w + vs_w + a2_w + gutter * 2
    x_cursor = (W - total_w) / 2

    draw.text((x_cursor, abbr_y), a1, font=font_abbr, fill=TEXT)
    x_cursor += a1_w + gutter
    draw.text((x_cursor, abbr_y + 56), "vs", font=font_vs, fill=FAINT)
    x_cursor += vs_w + gutter
    draw.text((x_cursor, abbr_y), a2, font=font_abbr, fill=TEXT)

    # ── Below abbrs: full team names ───────────────────────────────────────
    font_tname = _load_font(24, "regular")

    def _trim(name: str, limit: int = 26) -> str:
        return name if len(name) <= limit else name[:limit - 1].rstrip() + "…"

    t1_disp = _trim(t1)
    t2_disp = _trim(t2)
    t1_bbox = draw.textbbox((0, 0), t1_disp, font=font_tname)
    t2_bbox = draw.textbbox((0, 0), t2_disp, font=font_tname)
    name_y = abbr_y + 180

    # Center each team's name under its abbreviation
    a1_center = (W - total_w) / 2 + a1_w / 2
    a2_center = (W - total_w) / 2 + a1_w + gutter + vs_w + gutter + a2_w / 2
    draw.text((a1_center - (t1_bbox[2] - t1_bbox[0]) / 2, name_y), t1_disp, font=font_tname, fill=MUTED)
    draw.text((a2_center - (t2_bbox[2] - t2_bbox[0]) / 2, name_y), t2_disp, font=font_tname, fill=MUTED)

    # ── Bottom: domain + sport tag ─────────────────────────────────────────
    draw.rectangle([0, H - 40, W, H], fill=SURFACE)
    font_small = _load_font(20, "regular")
    draw.text((36, H - 30), "crowdbash.codingryder.com", font=font_small, fill=MUTED)

    sport_tag = f"Build your XI · Reshuffle live · {sport_emoji_label}"
    sport_bbox = draw.textbbox((0, 0), sport_tag, font=font_small)
    sport_w = sport_bbox[2] - sport_bbox[0]
    draw.text((W - sport_w - 36, H - 30), sport_tag, font=font_small, fill=accent)

    # ── Encode ─────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def cache_max_age_for_room(room: Room) -> int:
    """Cache-Control max-age in seconds. Edge/CDN handles the actual caching."""
    if room.status == "locked":
        return 60          # live: status pill might flip
    if room.status == "closed":
        return 3600        # closed: effectively static
    return 300             # open: 5 minutes is plenty


def share_html_for_room(room: Room, frontend_url: str, og_image_url: str) -> str:
    """
    Tiny HTML stub for /share/room/{id}. Crawlers parse the OG meta tags;
    humans get redirected via meta-refresh + JS to the SPA route.
    """
    sport = (room.sport or "cricket").lower()
    sport_label = "Cricket" if sport == "cricket" else "Football"
    league = room.league or room.match_format or sport_label

    t1, t2 = _split_teams(room.match_name or "")
    a1 = _team_abbr(t1, sport)
    a2 = _team_abbr(t2, sport)
    title = f"{a1} vs {a2} · {league} · Crowdbash"

    if room.status == "locked":
        desc = f"{room.match_name} is live now. Join the fantasy room and reshuffle your power before the next blind window."
    elif room.status == "closed":
        desc = f"Match result for {room.match_name}. See the final leaderboard, fantasy MVP, and squad recap."
    else:
        desc = f"Build your fantasy XI for {room.match_name}, assign 33 power across your players, and reshuffle live."

    # Escape user-supplied strings for HTML attribute safety
    def esc(s: str) -> str:
        return (
            s.replace("&", "&amp;")
             .replace('"', "&quot;")
             .replace("<", "&lt;")
             .replace(">", "&gt;")
        )

    target = f"{frontend_url.rstrip('/')}/room/{room.id}"
    title_e = esc(title)
    desc_e = esc(desc)
    image_e = esc(og_image_url)
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
  <meta property="og:image:alt" content="{title_e}" />

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


# Helper for callers: build the absolute og image URL given a base URL
def og_image_url(api_base_url: str, room_id) -> str:
    return f"{api_base_url.rstrip('/')}/api/og/room/{room_id}.png"
