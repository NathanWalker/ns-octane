#!/usr/bin/env python3
"""Generate a 1024x1024 app icon with PIL only (no numpy).

  python3 make-icon.py icon-1024.png [--bg 3,6,14] [--accent 120,170,255]

Dark radial gradient, a few stars, a planet limb with rim light and a soft
glow. Tweak the palette; the structure (opaque RGB, 1024 px, no alpha) is what
the iOS appiconset requires.
"""
import argparse, random
from PIL import Image, ImageDraw, ImageFilter

p = argparse.ArgumentParser()
p.add_argument('out')
p.add_argument('--bg', default='3,6,14')
p.add_argument('--accent', default='120,170,255')
p.add_argument('--seed', type=int, default=7)
a = p.parse_args()
bg = tuple(int(x) for x in a.bg.split(','))
accent = tuple(int(x) for x in a.accent.split(','))
S = 1024
random.seed(a.seed)

# gradient background (dark centre-bottom → slightly lighter top)
img = Image.new('RGB', (S, S), bg)
px = img.load()
for y in range(S):
    t = y / S
    for x in range(S):
        d = ((x - S / 2) ** 2 + (y - S * 0.9) ** 2) ** 0.5 / S
        k = max(0.0, 1.0 - d) * 0.35 + (1 - t) * 0.08
        px[x, y] = tuple(min(255, int(c + k * 40)) for c in bg)

# stars
draw = ImageDraw.Draw(img)
for _ in range(180):
    x, y, r = random.randint(0, S), random.randint(0, int(S * 0.7)), random.choice([1, 1, 1, 2])
    draw.ellipse((x - r, y - r, x + r, y + r), fill=(200, 210, 230))

# glow layer under the planet
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
g = ImageDraw.Draw(glow)
g.ellipse((S * 0.12, S * 0.55, S * 0.88, S * 1.31), fill=accent + (160,))
glow = glow.filter(ImageFilter.GaussianBlur(60))
img = Image.alpha_composite(img.convert('RGBA'), glow)

# planet body with a rim light towards the top
planet = Image.new('RGBA', (S, S), (0, 0, 0, 0))
pd = ImageDraw.Draw(planet)
pd.ellipse((S * 0.15, S * 0.58, S * 0.85, S * 1.28), fill=(int(bg[0] * 1.5) + 8, int(bg[1] * 1.5) + 12, int(bg[2] * 1.5) + 30, 255))
rim = Image.new('RGBA', (S, S), (0, 0, 0, 0))
rd = ImageDraw.Draw(rim)
rd.ellipse((S * 0.15, S * 0.58, S * 0.85, S * 1.28), outline=accent + (255,), width=10)
rim = rim.filter(ImageFilter.GaussianBlur(6))
planet = Image.alpha_composite(planet, rim)
img = Image.alpha_composite(img, planet)

img.convert('RGB').save(a.out)
print(f'wrote {a.out} ({S}x{S})')
