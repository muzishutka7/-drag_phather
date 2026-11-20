"""Usage: python scripts/vehicle-art/generate-wheel-svg.py assets-source/vehicles/lanos

Stock 13" steel wheel (shared by all cars), drawn so that it can spin without
flicker: every rotating layer (tire, rim) is shaded only radially (no light
direction baked in). Directional light and the contact shadow live in a
separate, non-rotating overlay (wheel-light-stock) drawn on top.
All units are millimetres; every image is centred on the axle."""
import math, os, sys
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)

TIRE_R = 333
# Visible rim edge. 0.58 of the tire radius = a 13" rim with a 70-series tire
# (tall sidewall); bigger values make the wheel look like 16-17".
RIM_R = 193
HOLE_RING = 122      # centre radius of the round vent holes
HOLE_R = 16          # vent hole radius
HOLES = 14


def svg(content, half, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-half} {-half} {2 * half} {2 * half}" '
            f'width="{2 * half}" height="{2 * half}"><defs>{defs}</defs>{content}</svg>')


def write(name, half, content, defs=''):
    open(os.path.join(OUT, name), 'w').write(svg(content, half, defs))


def radial(id_, stops, r):
    s = ''.join(f'<stop offset="{o / r:.4f}" stop-color="{c}"/>' for o, c in stops)
    return f'<radialGradient id="{id_}" cx="0" cy="0" r="{r}" gradientUnits="userSpaceOnUse">{s}</radialGradient>'


# ------------------------------------------------------------------ tire
tread = []
for i in range(120):                       # tread blocks on the shoulder, every 3 degrees
    a = i * 3
    tread.append(f'<rect x="{TIRE_R - 30}" y="-4.5" width="26" height="9" rx="2" fill="#141516" '
                 f'transform="rotate({a})"/>')
    if i % 2 == 0:
        tread.append(f'<rect x="{TIRE_R - 44}" y="-2" width="12" height="4" rx="1.5" fill="#1d1f21" '
                     f'transform="rotate({a + 1.5})"/>')
tire_defs = radial('side', [(RIM_R - 4, '#141517'), (RIM_R + 10, '#1e2022'), (RIM_R + 40, '#2e3134'),
                            (270, '#323538'), (300, '#2a2c2f'), (TIRE_R - 30, '#232527'),
                            (TIRE_R, '#1a1b1d')], TIRE_R) + \
    f'<path id="lettering" d="M -268 0 A 268 268 0 1 1 268 0 A 268 268 0 1 1 -268 0"/>'
tire = f"""
<path fill-rule="evenodd" fill="url(#side)"
  d="M {-TIRE_R} 0 A {TIRE_R} {TIRE_R} 0 1 0 {TIRE_R} 0 A {TIRE_R} {TIRE_R} 0 1 0 {-TIRE_R} 0 Z
     M {-(RIM_R - 6)} 0 A {RIM_R - 6} {RIM_R - 6} 0 1 1 {RIM_R - 6} 0 A {RIM_R - 6} {RIM_R - 6} 0 1 1 {-(RIM_R - 6)} 0 Z"/>
{''.join(tread)}
<circle r="{TIRE_R - 1.5}" fill="none" stroke="#0e0f10" stroke-width="3"/>
<circle r="{TIRE_R - 47}" fill="none" stroke="#3a3d41" stroke-width="2"/>
<circle r="{RIM_R + 22}" fill="none" stroke="#3a3d41" stroke-width="2"/>
<circle r="{RIM_R + 4}" fill="none" stroke="#0d0e0f" stroke-width="8"/>
<g font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="22" fill="#45484c" letter-spacing="3">
  <text><textPath href="#lettering" startOffset="4%">175/70 R13 82T</textPath></text>
  <text><textPath href="#lettering" startOffset="30%">TUBELESS · RADIAL</textPath></text>
  <text><textPath href="#lettering" startOffset="54%">175/70 R13 82T</textPath></text>
  <text><textPath href="#lettering" startOffset="80%">TUBELESS · RADIAL</textPath></text>
</g>
"""
write('tire-175-70-r13.svg', TIRE_R + 2, tire, tire_defs)

# ------------------------------------------------------------------ rim (steel, 14 round vent holes)
# Proportions follow the stock 13" steel wheel: a thick outer lip, a dark
# well groove, a face with 14 round holes, a raised ring around the 4 studs.
def hole_path(a_deg):
    a = math.radians(a_deg)
    cx, cy = HOLE_RING * math.cos(a), HOLE_RING * math.sin(a)
    return (f'M {cx - HOLE_R:.2f} {cy:.2f} A {HOLE_R} {HOLE_R} 0 1 0 {cx + HOLE_R:.2f} {cy:.2f} '
            f'A {HOLE_R} {HOLE_R} 0 1 0 {cx - HOLE_R:.2f} {cy:.2f} Z')


holes = [hole_path(i * 360 / HOLES + 360 / HOLES / 2) for i in range(HOLES)]
hole_rims = ''.join(
    f'<circle cx="{HOLE_RING * math.cos(math.radians(i * 360 / HOLES + 180 / HOLES)):.2f}" '
    f'cy="{HOLE_RING * math.sin(math.radians(i * 360 / HOLES + 180 / HOLES)):.2f}" r="{HOLE_R + 2.5}" '
    f'fill="none" stroke="#5f6469" stroke-width="5"/>' for i in range(HOLES))
rim_defs = radial('face', [
    (0, '#2b2e31'), (27, '#2b2e31'), (29, '#6f7478'),            # centre bore
    (40, '#8c9195'), (58, '#9ea3a7'),                              # stud area
    (62, '#b9bdc0'), (74, '#cfd2d4'), (88, '#a9aeb2'), (94, '#868b8f'),   # raised ring around the studs
    (100, '#9a9fa3'), (146, '#a3a8ac'),                            # face with holes
    (150, '#8e9397'), (156, '#a6abaf'),
    (161, '#5d6266'), (169, '#4d5155'),                            # dark well groove
    (172, '#8b9094'), (178, '#c4c7ca'), (185, '#d9dcde'), (190, '#b3b7ba'),
    (RIM_R, '#6c7175')], RIM_R) + \
    f"""<mask id="vents" maskUnits="userSpaceOnUse" x="-210" y="-210" width="420" height="420">
  <circle r="{RIM_R}" fill="white"/>{''.join(f'<path d="{h}" fill="black"/>' for h in holes)}
</mask>""" + radial('nut', [(0, '#e9ecee'), (4, '#cdd1d4'), (8, '#8e9499'), (10, '#6b7176')], 10)
nuts = ''.join(
    f'<g transform="rotate({45 + 90 * i}) translate(48 0)">'
    f'<circle r="11.5" fill="#5d6368"/>'
    f'<polygon points="{" ".join(f"{9 * math.cos(math.radians(60 * j)):.2f},{9 * math.sin(math.radians(60 * j)):.2f}" for j in range(6))}" fill="url(#nut)"/>'
    f'</g>' for i in range(4))
rim = f"""
<g mask="url(#vents)">
  <circle r="{RIM_R}" fill="url(#face)"/>
  {hole_rims}
</g>
<circle r="{RIM_R - 0.8}" fill="none" stroke="#55595d" stroke-width="1.6"/>
{nuts}
<circle r="27" fill="#25282b"/>
<circle r="27" fill="none" stroke="#5f6468" stroke-width="2.5"/>
<circle r="9" fill="#3a3e42"/>
<!-- valve stem in the well groove -->
<g transform="rotate(-128)"><rect x="{RIM_R - 30}" y="-4.5" width="14" height="9" rx="3" fill="#1c1d1f"/>
<rect x="{RIM_R - 34}" y="-3" width="7" height="6" rx="2" fill="#8a9095"/></g>
"""
write('rim-stock-13.svg', RIM_R + 2, rim, rim_defs)

# ------------------------------------------------------------------ static light (does not rotate)
light_defs = f"""
<radialGradient id="hi" cx="-120" cy="-150" r="300" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
  <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.06"/>
  <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
<linearGradient id="lo" x1="0" y1="-{TIRE_R}" x2="0" y2="{TIRE_R}" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#000" stop-opacity="0"/>
  <stop offset="0.55" stop-color="#000" stop-opacity="0.05"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.38"/>
</linearGradient>
<radialGradient id="rimEdge" cx="0" cy="0" r="{TIRE_R}" gradientUnits="userSpaceOnUse">
  <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
  <stop offset="0.9" stop-color="#000" stop-opacity="0.08"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.3"/>
</radialGradient>
"""
light = f"""
<circle r="{TIRE_R}" fill="url(#lo)"/>
<circle r="{TIRE_R}" fill="url(#rimEdge)"/>
<circle r="{TIRE_R}" fill="url(#hi)"/>
<!-- glint along the upper rim lip -->
<path d="M {-(RIM_R - 6) * math.cos(math.radians(30)):.1f} {-(RIM_R - 6) * math.sin(math.radians(30)):.1f}
         A {RIM_R - 6} {RIM_R - 6} 0 0 1 {(RIM_R - 6) * math.cos(math.radians(110)):.1f} {-(RIM_R - 6) * math.sin(math.radians(110)):.1f}"
  fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>
"""
write('wheel-light-stock.svg', TIRE_R + 2, light, light_defs)
print('ok')
