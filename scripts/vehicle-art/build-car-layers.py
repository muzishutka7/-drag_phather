"""Splits a car side view (transparent PNG, front facing right) into game layers.

python scripts/vehicle-art/build-car-layers.py <car.png> <config.json> <outDir>
e.g. python scripts/vehicle-art/build-car-layers.py assets-source/vehicles/cars/lanos/side.png \\
       scripts/vehicle-art/cars/lanos.json out/lanos

Then resize body-*.png to each quality and save as WebP (quality 90) into
public/vehicles/cars/<name>/<low|medium|high>/body-paint.webp and body-details.webp.
Game scales (px per mm): low 0.16, medium 0.27, high 0.4 (see src/assets/vehicleAssets.ts).
Wheels/brakes/suspension are shared parts: see generate-wheel-svg.py,
generate-brakes-svg.py and render-vehicle-assets.cjs.
Requires: numpy, opencv-python, Pillow.

config.json:
  lengthMm        real body length the image width (alpha bbox) maps to
  wheels          [[cx, cy], ...] wheel centres in source px
  tireRadiusPx    outer tire radius in source px (pixels inside are removed)
  paintHue        [min, max] hue range of the paint, degrees
  windows         [x0, y0, x1, y1] source rect of the side glass (kept untinted)
  glassMinAlpha / glassClarity / glassClearFrom   optional glass see-through tuning
  flip            optional: mirror the picture first (source faces left); all other
                  coordinates are given in the mirrored picture
  glassMinV       optional: min brightness of glass (default 0.38). Raise it when the
                  panes are framed by dark rubber, so frames do not join the glass
  glassMinThicknessPx  optional: a pane must be at least this thick (distance
                  transform), which drops thin chrome strips that are as light as glass
  keepWindowTint  optional (default true): leave paint-coloured pixels inside the
                  windows rect as they are; false greys them like everywhere else
  paintExclude    optional: [[x0, y0, x1, y1], ...] rects never treated as paint
                  (e.g. an amber turn signal on an orange car)
Only the largest opaque part of the picture is kept (drops a drop shadow).

Outputs body-paint.png (greyscale shading, tinted in game),
body-details.png (glass, lights, trims, rubber) and meta.json with all
positions converted to millimetres (origin: top-left of the body image)."""
import sys, os, json, numpy as np, cv2
from PIL import Image

src, cfg_path, out = sys.argv[1:4]
cfg = json.load(open(cfg_path))
name = cfg['name']
os.makedirs(out, exist_ok=True)

rgba = np.array(Image.open(src).convert('RGBA'))
if cfg.get('flip'):
    rgba = np.ascontiguousarray(rgba[:, ::-1])
# keep only the car itself: a separate drop shadow under it is removed
n_parts, part_labels, part_stats, _ = cv2.connectedComponentsWithStats((rgba[..., 3] > 20).astype(np.uint8), 8)
if n_parts > 2:
    car_part = 1 + int(np.argmax(part_stats[1:, cv2.CC_STAT_AREA]))
    keep = cv2.dilate((part_labels == car_part).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
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
paint_excluded = np.zeros(alpha.shape, bool)
for ex0, ey0, ex1, ey1 in cfg.get('paintExclude', []):
    paint_excluded[ey0:ey1, ex0:ex1] = True
paint &= ~paint_excluded
paint = cv2.morphologyEx(paint.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0

# ---- glass: light, low-saturation pixels above the belt line (any column)
belt_y = wy1
rows = np.arange(alpha.shape[0])[:, None]
lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
glass = (~paint) & (rows < belt_y) & (S < 0.3) & (V > cfg.get('glassMinV', 0.38)) & (alpha > 0.3)
min_pane_area = cfg.get('glassMinArea', 600)
glass = cv2.morphologyEx(glass.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
# keep only real panes; thin bright highlights on the paint/trim are not glass
n_glass, glass_labels, glass_stats, _ = cv2.connectedComponentsWithStats(glass, 8)
glass = np.isin(glass_labels, [i for i in range(1, n_glass)
                               if glass_stats[i, cv2.CC_STAT_AREA] >= min_pane_area
                               and glass_stats[i, cv2.CC_STAT_HEIGHT] >= 12]).astype(np.uint8)
if 'glassMinThicknessPx' in cfg:
    # pane cores survive an opening as wide as the thickness; thin chrome strips
    # do not. The glass then grows back only a couple of pixels around the cores.
    t = int(cfg['glassMinThicknessPx'])
    core = cv2.morphologyEx(glass, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * t + 1, 2 * t + 1)))
    glass = glass & cv2.dilate(core, np.ones((3, 3), np.uint8), iterations=2)
glass_soft = cv2.GaussianBlur(glass.astype(np.float32), (0, 0), 0.8)

# shading map for tinting: brightness relative to the brightest paint
vref = np.percentile(V[paint], 99.7)
grey = np.clip(V / vref, 0, 1)

# The paint layer covers the whole body except the glass, so no thin gap
# (trim line, reflector, anti-aliased edge) can ever show what is behind the
# car. Under trims and lights the details layer hides it; in those spots the
# shading is filled in from the surrounding paint.
paint_cover = (alpha > 0.02) & ~(glass_soft > 0.5)
holes = (paint_cover & ~paint).astype(np.uint8)
grey8 = (grey * 255).astype(np.uint8)
grey8[holes > 0] = 0
grey8 = cv2.inpaint(grey8, holes, 4, cv2.INPAINT_TELEA)
grey = grey8.astype(np.float32) / 255

# anti-aliased paint/trim edge pixels keep the old hue -> neutralise them
neutral = cv2.cvtColor(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), cv2.COLOR_GRAY2RGB)
edge = hue_ok & (S > 0.12) & ~paint & ~paint_excluded
if cfg.get('keepWindowTint', True):
    edge &= ~in_windows
details_rgb = np.where(edge[..., None], neutral, rgb)

details_alpha = alpha * (~paint)
# glass: clear glass lets the scene behind show through, darker parts
# (seats, tint, reflections of dark things) stay more solid
glass_alpha = np.clip(1.0 - (lum - cfg.get('glassClearFrom', 0.33)) * cfg.get('glassClarity', 1.15),
                      cfg.get('glassMinAlpha', 0.42), 1.0)
details_alpha = details_alpha * (1 - glass_soft) + np.minimum(alpha, glass_alpha) * glass_soft
paint_alpha = alpha * (1 - glass_soft)

def crop(a):
    return a[y0:y1, x0:x1]

paint_img = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
g8 = (crop(grey) * 255).astype(np.uint8)
paint_img[..., 0] = paint_img[..., 1] = paint_img[..., 2] = g8
paint_img[..., 3] = (crop(paint_alpha) * 255).astype(np.uint8)
details_img = np.dstack([crop(details_rgb), (crop(details_alpha) * 255).astype(np.uint8)])
Image.fromarray(paint_img).save(os.path.join(out, 'body-paint.png'))
Image.fromarray(details_img).save(os.path.join(out, 'body-details.png'))

cover = 1 - (1 - paint_alpha) * (1 - details_alpha)
body = (alpha > 0.98) & (glass_soft < 0.02)
print('coverage holes (<0.97) inside body:', int(((cover < 0.97) & body).sum()))
meta = {
    'bodyPxPerMm': 1 / k,
    'bodySizeMm': [round((x1 - x0) * k, 1), round((y1 - y0) * k, 1)],
    'axlesMm': [[round((cx - x0) * k, 1), round((cy - y0) * k, 1)] for cx, cy in cfg['wheels']],
    'tireRadiusMm': round(R * k, 1),
    'groundYMm': round((np.mean([c[1] for c in cfg['wheels']]) + R - y0) * k, 1),
}
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print(json.dumps(meta))
