"""Builds the static 1200x630 share cards in public/og/ (one per game + one for the site).
Run: python3 scripts/build-og.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "og"
FONTS = Path("/System/Library/Fonts/Supplemental")
SLAB = str(FONTS / "Georgia Bold.ttf")
SANS = str(FONTS / "Arial.ttf")
SANS_B = str(FONTS / "Arial Bold.ttf")
INK = "#121212"

# Colors match the --<game> tokens in public/assets/mint.css.
CARDS = {
    "word": ("Mint Word", "Guess the five-letter word in six tries", "#8cc8ff"),
    "hive": ("Mint Hive", "Make words from seven letters", "#ffa47e"),
    "box": ("Mint Box", "Chain words around a box of letters", "#ff9ec4"),
    "sum": ("Mint Sum", "Combine six numbers to hit the target", "#8fd8b8"),
    "sudoku": ("Mini Sudoku", "A 6×6 sudoku every day", "#ffcb57"),
    "nonogram": ("Mint Nonogram", "A picture logic puzzle every day", "#bcaeff"),
    "site": ("Mint Puzzles", "Six free daily word, number and logic puzzles", "#8fd8b8"),
}
SWATCH = ["#8cc8ff", "#ffa47e", "#ff9ec4", "#8fd8b8", "#ffcb57", "#bcaeff"]


def card(key, title, tagline, color):
    im = Image.new("RGB", (1200, 630), color)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((60, 60, 1140, 570), radius=36, fill="#ffffff")
    d.text((120, 130), "MINT PUZZLES", font=ImageFont.truetype(SANS_B, 30), fill="#5f6368")
    d.text((116, 190), title, font=ImageFont.truetype(SLAB, 104), fill=INK)
    d.text((120, 340), tagline, font=ImageFont.truetype(SANS, 42), fill=INK)
    d.text((120, 470), "Free every day · no signup · mintsitestudio.com", font=ImageFont.truetype(SANS, 30), fill="#5f6368")
    for i, c in enumerate(SWATCH):
        x = 1060 - (5 - i) * 46
        d.rounded_rectangle((x, 130, x + 34, 164), radius=8, fill=c)
    im.save(OUT / f"{key}.png", optimize=True)


for k, v in CARDS.items():
    card(k, *v)
