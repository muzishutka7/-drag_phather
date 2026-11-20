"""Splits a car side view (transparent PNG, front facing right) into game layers.

python scripts/vehicle-art/build-car-layers.py <car.png> <config.json> <outDir>
e.g. python scripts/vehicle-art/build-car-layers.py assets-source/vehicles/lanos/lanos-side.png \\
       scripts/vehicle-art/cars/lanos.json out

Wheels/brakes/suspension: generate-wheel-svg.py and generate-brakes-svg.py into
assets-source/vehicles/lanos, then render-vehicle-assets.cjs at each quality.
Game scales (px per mm): low 0.16, medium 0.27, high 0.4 -> public/vehicles/<quality>/*.webp
Requires: numpy, opencv-python, Pillow.

config.json:
  lengthMm        real body length the image width (alpha bbox) maps to
  wheels          [[cx, cy], ...] wheel centres in source px
  tireRadiusPx    outer tire radius in source px (pixels inside are removed)
  paintHue        [min, max] hue range of the paint, degrees
  windows         [x0, y0, x1, y1] source rect of the side glass (kept untinted)
  glassMinAlpha / glassClarity / glassClearFrom   optional glass see-through tuning

Outputs <name>-body-paint.png (greyscale shading, tinted in game),
<name>-body-details.png (glass, lights, trims, rubber) and meta.json with all
positions converted to millimetres (origin: top-left of the body image)."""
import sys, os, json, numpy as np, cv2
from PIL import Image

src, cfg_path, out = sys.argv[1:4]
cfg = json.load(open(cfg_path))
name = cfg['name']
os.makedirs(out, exist_ok=True)

rgba = np.array(Image.open(src).convert('RGBA'))
rgb = rgba[..., :3]
alpha = rgba[..., 3].astype(np.float32) / 255
ys, xs = np.nonzero(alpha > 0.08)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
k = cfg['lengthMm'] / (x1 - x0)                      # mm per source px

# ---- remove the drawn wheels (they become separate rotating sprites)
yy, xx = np.mgrid[0:rgba.shape[0], 0:rgba.shape[1]]
R = cfg['tireRadiusPx']
for cx, cy in cfg['wheels']:
    d = np.hypot(xx - cx, yy - cy)
    alpha *= np.clip(d - R, 0, 1)                     # 1 px anti-aliased cut

# ---- glass: opaque, never tinted
wx0, wy0, wx1, wy1 = cfg['windows']
in_windows = np.zeros(alpha.shape, bool); in_windows[wy0:wy1, wx0:wx1] = True

hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
H, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
h0, h1 = cfg['paintHue']
hue_ok = (H >= h0) & (H <= h1)
paint = hue_ok & (S > 0.35) & (V > 0.12)
# bright, less saturated specular streaks on the paint (outside the glass)
paint |= hue_ok & (S > 0.04) & (V > 0.45) & ~in_windows
paint &= alpha > 0.02
paint = cv2.morphologyEx(paint.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0

# shading map for tinting: brightness relative to the brightest paint
vref = np.percentile(V[paint], 99.7)
grey = np.clip(V / vref, 0, 1)

# anti-aliased paint/trim edge pixels keep the old hue -> neutralise them
neutral = cv2.cvtColor(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), cv2.COLOR_GRAY2RGB)
edge = hue_ok & (S > 0.12) & ~paint & ~in_windows
details_rgb = np.where(edge[..., None], neutral, rgb)

details_alpha = alpha * (~paint)
# glass: light (clear) glass lets the scene behind show through, dark parts
# (seats, frames, pillars, tint) stay solid so the cabin keeps its depth
glass = in_windows & ~paint & (alpha > 0.3)
lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
glass_alpha = np.clip(1.0 - (lum - cfg.get('glassClearFrom', 0.33)) * cfg.get('glassClarity', 1.15), cfg.get('glassMinAlpha', 0.42), 1.0)
details_alpha[glass] = glass_alpha[glass]

def crop(a):
    return a[y0:y1, x0:x1]

paint_img = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
g8 = (crop(grey) * 255).astype(np.uint8)
paint_img[..., 0] = paint_img[..., 1] = paint_img[..., 2] = g8
paint_img[..., 3] = (crop(alpha * paint) * 255).astype(np.uint8)
details_img = np.dstack([crop(details_rgb), (crop(details_alpha) * 255).astype(np.uint8)])
Image.fromarray(paint_img).save(os.path.join(out, f'{name}-body-paint.png'))
Image.fromarray(details_img).save(os.path.join(out, f'{name}-body-details.png'))

meta = {
    'bodyPxPerMm': 1 / k,
    'bodySizeMm': [round((x1 - x0) * k, 1), round((y1 - y0) * k, 1)],
    'axlesMm': [[round((cx - x0) * k, 1), round((cy - y0) * k, 1)] for cx, cy in cfg['wheels']],
    'tireRadiusMm': round(R * k, 1),
    'groundYMm': round((np.mean([c[1] for c in cfg['wheels']]) + R - y0) * k, 1),
}
json.dump(meta, open(os.path.join(out, f'{name}-meta.json'), 'w'), indent=1)
print(json.dumps(meta))
