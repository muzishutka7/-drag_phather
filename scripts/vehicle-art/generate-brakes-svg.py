"""Usage: python scripts/vehicle-art/generate-brakes-svg.py assets-source/vehicles/parts

Stock brake and suspension parts (SVG, millimetres, centred on the axle),
sized for the 13" steel wheel: its vent holes sit at r = 106..138 mm, so the
disc / drum reach r = 186 mm to fill them. Shaded only radially so they can
spin, and kept dark because they sit in the shadow inside the wheel; the
wheel light overlay adds the light direction."""
import math, os, sys
OUT = sys.argv[1]  # parts root: brakes go to <OUT>/brakes, shocks to <OUT>/suspension

def svg(content, half, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-half} {-half} {2 * half} {2 * half}" '
            f'width="{2 * half}" height="{2 * half}"><defs>{defs}</defs>{content}</svg>')

def write(name, half, content, defs=''):
    folder = os.path.join(OUT, 'suspension' if name.startswith('shock') else 'brakes')
    os.makedirs(folder, exist_ok=True)
    open(os.path.join(folder, name), 'w').write(svg(content, half, defs))

def radial(id_, stops, r):
    s = ''.join(f'<stop offset="{o / r:.4f}" stop-color="{c}"/>' for o, c in stops)
    return f'<radialGradient id="{id_}" cx="0" cy="0" r="{r}" gradientUnits="userSpaceOnUse">{s}</radialGradient>'

def ray(r0, r1, a, color, width, opacity=1.0):
    a = math.radians(a)
    return (f'<line x1="{r0 * math.cos(a):.1f}" y1="{r0 * math.sin(a):.1f}" x2="{r1 * math.cos(a):.1f}" '
            f'y2="{r1 * math.sin(a):.1f}" stroke="{color}" stroke-opacity="{opacity}" stroke-width="{width}"/>')

# Front ventilated disc: machined friction ring + dark hat.
write('brake-disc-stock-236.svg', 190, f"""
<circle r="186" fill="url(#ring)"/>
{''.join(ray(102, 182, a, '#ffffff', 2.5, 0.05) for a in range(0, 360, 6))}
{''.join(ray(102, 182, a + 3, '#000000', 2.5, 0.06) for a in range(0, 360, 6))}
<circle r="184" fill="none" stroke="#3e4246" stroke-width="5"/>
<circle r="98" fill="url(#hat)"/>
<circle r="98" fill="none" stroke="#2c2f32" stroke-width="4"/>
""", radial('ring', [(98, '#45494d'), (110, '#5d6266'), (150, '#6a6f73'), (176, '#5a5f63'), (186, '#3c4043')], 186)
   + radial('hat', [(0, '#3d4145'), (60, '#4c5155'), (98, '#383c40')], 98))

# Rear drum with cooling fins.
write('brake-drum-stock.svg', 188, f"""
<circle r="184" fill="url(#drum)"/>
{''.join(ray(150, 182, a, '#26292c', 7) for a in range(0, 360, 12))}
<circle r="148" fill="none" stroke="#2d3033" stroke-width="5"/>
{''.join(ray(80, 140, a, '#ffffff', 2, 0.05) for a in range(0, 360, 10))}
<circle r="78" fill="#3f4347" stroke="#2a2d30" stroke-width="4"/>
""", radial('drum', [(0, '#383c40'), (140, '#43474b'), (150, '#33373a'), (184, '#2a2d30')], 184))

def band(r0, r1, a0, a1):
    a0, a1 = math.radians(a0), math.radians(a1)
    return (f"M {r1 * math.cos(a0):.1f} {r1 * math.sin(a0):.1f} A {r1} {r1} 0 0 1 {r1 * math.cos(a1):.1f} {r1 * math.sin(a1):.1f} "
            f"L {r0 * math.cos(a1):.1f} {r0 * math.sin(a1):.1f} A {r0} {r0} 0 0 0 {r0 * math.cos(a0):.1f} {r0 * math.sin(a0):.1f} Z")

# Front single-piston floating caliper (cast iron, dark), behind the disc centre line.
write('caliper-stock-front.svg', 214, f"""
<path d="{band(132, 206, 194, 244)}" fill="#2f3337" stroke="#16181a" stroke-width="5" stroke-linejoin="round"/>
<path d="{band(146, 194, 200, 238)}" fill="#3d4247"/>
<path d="{band(176, 190, 204, 234)}" fill="#4d5359"/>
<circle cx="{196 * math.cos(math.radians(199)):.1f}" cy="{196 * math.sin(math.radians(199)):.1f}" r="7" fill="#8b9196"/>
<circle cx="{196 * math.cos(math.radians(239)):.1f}" cy="{196 * math.sin(math.radians(239)):.1f}" r="7" fill="#8b9196"/>
""")

def strut(lean):
    """Coil-over strut seen through the wheel well. Kept within r < 352 mm so it
    never covers the body above the arch (the arch edge sits at ~360 mm)."""
    coils = ''.join(
        f'<ellipse cx="{lean * (150 + i * 32) / 340:.1f}" cy="{-150 - i * 32}" rx="62" ry="14" fill="none" '
        f'stroke="#2f3337" stroke-width="15"/>' for i in range(6))
    return f"""
<path d="M -20 -40 L {lean - 20} -350 L {lean + 20} -350 L 20 -40 Z" fill="#26292d"/>
<path d="M -7 -40 L {lean - 7} -350" stroke="#4a4f54" stroke-width="5"/>
{coils}
<ellipse cx="{lean * 0.4:.1f}" cy="-128" rx="70" ry="12" fill="#1d2023"/>
<ellipse cx="{lean * 0.97:.1f}" cy="-342" rx="70" ry="10" fill="#1d2023"/>
"""


write('shock-front-stock.svg', 360, strut(18))
write('shock-rear-stock.svg', 360, strut(-22))
print('ok')
