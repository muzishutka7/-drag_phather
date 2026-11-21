import Phaser from 'phaser';

/** Below this health the outline blinks red. */
export const CHECK_ENGINE_WARNING_HEALTH = 70;
const CRITICAL_HEALTH = 35;

const OUTLINE_OK = 0x8a949a;
const OUTLINE_WARNING = 0xe2463f;
const OUTLINE_OVERREV = 0xffb22e;
const TEXT_OK = '#e4e8ea';
const TEXT_WARNING = '#ff7a63';
const FILL = 0x0e1213;

export type CheckEngineState = 'ok' | 'warning' | 'critical' | 'over-rev';
export type ConditionIconKind = 'engine' | 'suspension' | 'body';

export interface CheckEngineIcon {
  container: Phaser.GameObjects.Container;
  /** timeMs drives the blinking. */
  update: (health: number, overRevving: boolean, timeMs: number) => void;
}

type Point = [number, number];

/** Outline of the classic "check engine" pictogram, centred on 0,0 (≈ 100×56). */
const ENGINE_OUTLINE: readonly Point[] = [
  [-38, -4], [-30, -4], [-30, -16], [-12, -16], [-12, -22], [-22, -22], [-22, -28],
  [20, -28], [20, -22], [10, -22], [10, -16], [24, -16], [32, -8], [40, -8],
  [40, -16], [48, -16], [48, 20], [40, 20], [40, 12], [32, 12], [22, 24],
  [-30, 24], [-30, 10], [-38, 10],
];

type Draw = (g: Phaser.GameObjects.Graphics, color: number, alpha: number) => void;

/** Fills and outlines a closed polygon in the light colour. */
function outlinedShape(
  g: Phaser.GameObjects.Graphics,
  points: readonly Point[],
  color: number,
  alpha: number,
): void {
  g.fillStyle(FILL, 0.85);
  g.lineStyle(4, color, alpha);
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  g.fillPath();
  g.strokePath();
}

const drawEngine: Draw = (g, color, alpha) => {
  outlinedShape(g, ENGINE_OUTLINE, color, alpha);
  // Connector on the left side.
  g.lineBetween(-46, -10, -46, 16);
  g.lineBetween(-46, 3, -38, 3);
};

/**
 * Suspension: a coil-over shock absorber lying diagonally (bottom-left to
 * top-right) with mounting eyes, damper body and spring coils.
 */
const SHOCK_FROM: Point = [-40, 22];
const SHOCK_TO: Point = [34, -26];
const shockAxis = (() => {
  const dx = SHOCK_TO[0] - SHOCK_FROM[0];
  const dy = SHOCK_TO[1] - SHOCK_FROM[1];
  const length = Math.hypot(dx, dy);
  return { ux: dx / length, uy: dy / length, length };
})();

/** Point on the shock axis: t = 0..1 along it, side = offset across it. */
function onShock(t: number, side = 0): Point {
  const { ux, uy, length } = shockAxis;
  return [
    SHOCK_FROM[0] + ux * length * t - uy * side,
    SHOCK_FROM[1] + uy * length * t + ux * side,
  ];
}

/** Rectangle along the axis from t0 to t1, `width` across. */
function shockBox(t0: number, t1: number, width: number): Point[] {
  return [onShock(t0, -width / 2), onShock(t1, -width / 2), onShock(t1, width / 2), onShock(t0, width / 2)];
}

const drawSuspension: Draw = (g, color, alpha) => {
  // piston rod
  g.lineStyle(5, color, alpha);
  g.lineBetween(...onShock(0.42), ...onShock(0.86));
  // damper body and spring seats
  outlinedShape(g, shockBox(0.1, 0.46, 15), color, alpha);
  outlinedShape(g, shockBox(0.38, 0.44, 30), color, alpha);
  outlinedShape(g, shockBox(0.8, 0.86, 30), color, alpha);
  // spring coils: solid slanted bars
  g.fillStyle(color, alpha);
  for (let index = 0; index < 5; index += 1) {
    const t = 0.49 + index * 0.065;
    const bar = [onShock(t - 0.012, -15), onShock(t + 0.03, 15), onShock(t + 0.052, 15), onShock(t + 0.01, -15)];
    g.fillPoints(bar.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
  }
  // mounting eyes
  g.fillStyle(FILL, 0.85);
  g.lineStyle(4, color, alpha);
  const [bx, by] = onShock(0.03);
  const [tx, ty] = onShock(0.95);
  g.fillCircle(bx, by, 7);
  g.strokeCircle(bx, by, 7);
  g.fillCircle(tx, ty, 8.5);
  g.strokeCircle(tx, ty, 8.5);
};

/** Smooth closed curve through the points (Catmull-Rom), as a polygon. */
function smoothPath(points: readonly Point[], closed: boolean, steps = 6): Point[] {
  const out: Point[] = [];
  const count = points.length;
  const last = closed ? count : count - 1;
  for (let index = 0; index < last; index += 1) {
    const p0 = points[closed ? (index - 1 + count) % count : Math.max(index - 1, 0)];
    const p1 = points[index];
    const p2 = points[(index + 1) % count];
    const p3 = points[closed ? (index + 2) % count : Math.min(index + 2, count - 1)];
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const coordinate = (axis: 0 | 1): number => 0.5 * (
        2 * p1[axis]
        + (-p0[axis] + p2[axis]) * t
        + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
        + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
      );
      out.push([coordinate(0), coordinate(1)]);
    }
  }
  if (!closed) {
    out.push(points[count - 1]);
  }
  return out;
}

function archPoints(center: Point, radius: number): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= 12; step += 1) {
    const angle = Math.PI * 2 - (Math.PI * step) / 12; // right -> over the top -> left
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
  }
  return points;
}

/**
 * Body: a plain three-box saloon, front to the right. Only the outline, the
 * side glass and empty wheel arches, so it reads at a glance at small size.
 */
const BODY_ARCH_RADIUS = 10.5;
const BODY_SILL_Y = 13;
const BODY_OUTLINE: readonly Point[] = [
  // smooth top line from the rear bumper to the front bumper
  ...smoothPath([
    [-55, 6], [-54, -4], [-49, -9], [-32, -11], [-19, -23], [6, -24],
    [14, -21], [29, -10], [47, -7], [54, -2], [56, 6],
  ], false),
  [54, BODY_SILL_Y],
  ...archPoints([33, BODY_SILL_Y], BODY_ARCH_RADIUS),
  ...archPoints([-33, BODY_SILL_Y], BODY_ARCH_RADIUS),
  [-53, BODY_SILL_Y],
];
const BODY_GLASS: readonly Point[] = smoothPath([
  [-27, -12], [-17, -20], [5, -21], [12, -18], [24, -11], [-2, -11],
], true, 4);

const drawBody: Draw = (g, color, alpha) => {
  outlinedShape(g, BODY_OUTLINE, color, alpha);
  // side glass with the B-pillar
  g.fillStyle(color, alpha * 0.22);
  g.lineStyle(2.5, color, alpha);
  g.beginPath();
  g.moveTo(BODY_GLASS[0][0], BODY_GLASS[0][1]);
  BODY_GLASS.slice(1).forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.lineStyle(3, color, alpha);
  g.lineBetween(-4, -21, -4, -11);
};

const DRAW: Record<ConditionIconKind, Draw> = {
  engine: drawEngine,
  suspension: drawSuspension,
  body: drawBody,
};

/** Where the % text sits for each pictogram. */
const TEXT_POSITION: Record<ConditionIconKind, Point> = {
  engine: [5, 3],
  suspension: [26, 15],
  body: [0, 2],
};

export function getCheckEngineState(health: number, overRevving: boolean): CheckEngineState {
  if (overRevving) {
    return 'over-rev';
  }
  if (health < CRITICAL_HEALTH) {
    return 'critical';
  }
  if (health < CHECK_ENGINE_WARNING_HEALTH) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Dashboard-style condition light with the part's health inside.
 * - ok (≥ 70 %): grey outline
 * - warning (< 70 %): outline blinks red
 * - critical (< 35 %): fast red blink, red numbers
 * - over-rev (engine only): amber flashing while past the redline
 */
export function createConditionIcon(
  scene: Phaser.Scene,
  kind: ConditionIconKind,
  label: string,
): CheckEngineIcon {
  const container = scene.add.container(0, 0).setName(`${kind}-condition-icon`);
  const outline = scene.add.graphics();
  const [textX, textY] = TEXT_POSITION[kind];
  const percentText = scene.add.text(textX, textY, '', {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: kind === 'body' ? '15px' : '18px',
    color: TEXT_OK,
  }).setOrigin(0.5);
  const labelText = scene.add.text(0, 40, label, {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: '15px',
    color: '#8a949a',
    letterSpacing: 2,
  }).setOrigin(0.5);
  container.add([outline, percentText, labelText]);

  let lastKey = '';

  const draw = (color: number, alpha: number): void => {
    outline.clear();
    DRAW[kind](outline, color, alpha);
  };

  return {
    container,
    update: (health, overRevving, timeMs) => {
      const state = getCheckEngineState(health, kind === 'engine' && overRevving);
      const blinkPeriod = state === 'warning' ? 500 : 180;
      const blinkOn = state === 'ok' || Math.floor(timeMs / blinkPeriod) % 2 === 0;
      const percent = Math.floor(Phaser.Math.Clamp(health, 0, 100));
      const key = `${state}-${blinkOn}-${percent}`;
      if (key === lastKey) {
        return;
      }
      lastKey = key;

      let color = OUTLINE_OK;
      if (state === 'over-rev') {
        color = OUTLINE_OVERREV;
      } else if (state !== 'ok') {
        color = OUTLINE_WARNING;
      }
      draw(blinkOn ? color : OUTLINE_OK, blinkOn ? 1 : 0.45);
      percentText.setText(`${percent}%`);
      percentText.setColor(state === 'critical' ? TEXT_WARNING : TEXT_OK);
      labelText.setColor(state === 'ok' ? '#8a949a' : blinkOn ? toCss(color) : '#8a949a');
    },
  };
}

/** The engine light used on the tachometer and in the garage. */
export function createCheckEngineIcon(scene: Phaser.Scene, label = 'CHECK'): CheckEngineIcon {
  return createConditionIcon(scene, 'engine', label);
}

function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
