"""
Generate the social-share preview image at frontend/public/og.png.

Run from the repo root:
    python3 frontend/scripts/generate_og_image.py

The output is committed; you only need to re-run this if you want to
update the brand artwork. Vite serves `public/og.png` at `/og.png` and
`index.html` references it via og:image and twitter:image tags.

Spec: 1200×630 PNG (Open Graph standard for `summary_large_image`).
"""
from PIL import Image, ImageDraw, ImageFont
import os
import math

# ── Output ─────────────────────────────────────────────────────────────────
OUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "public",
    "og.png",
)
W, H = 1200, 630

# ── Brand palette (matches CSS vars from index.css) ────────────────────────
BG = (26, 27, 30)        # var(--bg)
SURFACE = (38, 40, 45)   # var(--surface)
GREEN = (45, 214, 122)   # var(--green)
TEXT = (240, 240, 244)
MUTED = (160, 164, 174)
FAINT = (110, 114, 124)
DARK = (7, 26, 14)       # logo's inner hex color

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img, "RGBA")

# ── Soft radial-ish glows over the bg ──────────────────────────────────────
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
# Green glow top-left
gd.ellipse([-260, -200, 720, 540], fill=(45, 214, 122, 28))
# Purple glow bottom-right
gd.ellipse([700, 220, 1500, 900], fill=(139, 92, 246, 22))
img.paste(glow, (0, 0), glow)

# Subtle dot grid (matches the homepage hero)
for y in range(0, H, 36):
    for x in range(0, W, 36):
        # Fade dots toward the edges
        cx, cy = W / 2, H / 2
        dist = math.hypot(x - cx, y - cy) / max(W, H)
        a = max(0, int(35 * (1 - dist * 1.6)))
        if a > 0:
            draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(255, 255, 255, a))


# ── Hexagon logo (mirrors the top-nav glyph) ───────────────────────────────
def hex_points(cx, cy, r, rotate=0):
    return [
        (
            cx + r * math.cos(math.radians(60 * i + rotate)),
            cy + r * math.sin(math.radians(60 * i + rotate)),
        )
        for i in range(6)
    ]


logo_cx, logo_cy = W // 2, 175
draw.polygon(hex_points(logo_cx, logo_cy, 56, rotate=-90), fill=GREEN)
draw.polygon(hex_points(logo_cx, logo_cy, 28, rotate=-90), fill=DARK)


# ── Fonts ──────────────────────────────────────────────────────────────────
def load_font(size, weight="bold"):
    """
    Load Helvetica Neue. Verified indices on macOS Sonoma+:
      0 = Regular · 1 = Bold · 2 = Italic · 3 = Bold Italic
      4 = Condensed Bold · 9 = Condensed Black · 10 = Medium · 12 = Thin
    """
    indices = {"regular": 0, "medium": 10, "bold": 1, "black": 9}
    idx = indices.get(weight, 1)
    for path in (
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=idx)
            except Exception:
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
    return ImageFont.load_default()


font_brand = load_font(140, "black")   # Condensed Black for max impact
font_h1 = load_font(54, "bold")
font_p = load_font(28, "regular")
font_small = load_font(22, "medium")
font_chip = load_font(24, "bold")


def text_w(text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def draw_centered(y, text, font, fill):
    draw.text(((W - text_w(text, font)) / 2, y), text, font=font, fill=fill)


# ── Wordmark ───────────────────────────────────────────────────────────────
draw_centered(255, "Crowdbash", font_brand, TEXT)

# ── Headline (matches the homepage hero copy) ──────────────────────────────
draw_centered(395, "Your team. Your power. Your rules.", font_h1, TEXT)

# ── Tagline ────────────────────────────────────────────────────────────────
draw_centered(
    470,
    "Live cricket & football fantasy — reshuffle power mid-match.",
    font_p,
    MUTED,
)


# ── Sport chips ────────────────────────────────────────────────────────────
def chip(x, y, label, accent):
    pad_x, pad_y = 22, 12
    w = text_w(label, font_chip) + pad_x * 2
    h = 50
    # rounded rect (soft pill)
    draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=h // 2,
        fill=(accent[0], accent[1], accent[2], 28),
        outline=(accent[0], accent[1], accent[2], 110),
        width=1,
    )
    draw.text((x + pad_x, y + pad_y), label, font=font_chip, fill=accent)
    return w


chip_y = 535
chip_total = 0
labels = [("Cricket", (245, 158, 11)), ("Football", (74, 158, 255))]
# Pre-compute widths for centering the row
widths = [text_w(lbl, font_chip) + 44 for lbl, _ in labels]
gap = 16
total_w = sum(widths) + gap * (len(widths) - 1)
x_start = (W - total_w) // 2
for i, (lbl, accent) in enumerate(labels):
    chip(x_start + chip_total, chip_y, lbl, accent)
    chip_total += widths[i] + gap

# ── Bottom strip with domain + live tag ───────────────────────────────────
draw.rectangle([0, H - 40, W, H], fill=SURFACE)
draw.text((36, H - 30), "crowdbash.codingryder.com", font=font_small, fill=MUTED)

# Right side: drawn green dot + "FANTASY · LIVE" (Helvetica doesn't ship the
# U+25CF glyph so we draw the dot ourselves instead of letting it tofu).
tag = "FANTASY · LIVE"
tag_w = text_w(tag, font_small)
right_pad = 36
tag_x = W - tag_w - right_pad
dot_r = 5
draw.ellipse(
    [tag_x - 16, H - 25, tag_x - 16 + dot_r * 2, H - 25 + dot_r * 2],
    fill=GREEN,
)
draw.text((tag_x, H - 30), tag, font=font_small, fill=GREEN)

# ── Save ───────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
img.save(OUT_PATH, "PNG", optimize=True)
print(f"Wrote {OUT_PATH} ({os.path.getsize(OUT_PATH):,} bytes, {W}x{H})")
