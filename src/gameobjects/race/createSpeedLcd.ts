import Phaser from 'phaser';

/** Segments a..g of a seven-segment digit, standard naming. */
type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

const DIGIT_SEGMENTS: Record<string, readonly Segment[]> = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'd', 'c'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
};
const ALL_SEGMENTS: readonly Segment[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const LCD_BACKGROUND = 0xa9b49c;
const LCD_BORDER = 0x5d655a;
const SEGMENT_ON = 0x1a201c;
const SEGMENT_GHOST_ALPHA = 0.09;
/** Italic slant of the digits, as x shift per 1 px of height. */
const SLANT = 0.12;

export interface SpeedLcd {
  container: Phaser.GameObjects.Container;
  update: (speedKph: number) => void;
}

/**
 * Calculator-style seven-segment speed readout that sits in the empty
 * window of the speedometer artwork. Unlit segments are faintly visible,
 * like on a real LCD.
 */
export function createSpeedLcd(
  scene: Phaser.Scene,
  width: number,
  height: number,
  digitCount = 3,
): SpeedLcd {
  const container = scene.add.container(0, 0).setName('speed-lcd');
  const background = scene.add.graphics();
  const segments = scene.add.graphics();
  container.add([background, segments]);

  background.fillStyle(LCD_BACKGROUND, 1);
  background.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
  // Inner shadow along the top edge makes it look recessed.
  background.fillStyle(0x000000, 0.18);
  background.fillRect(-width / 2 + 2, -height / 2 + 2, width - 4, 4);
  background.lineStyle(2, LCD_BORDER, 1);
  background.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);

  const paddingX = width * 0.08;
  const paddingY = height * 0.14;
  const gap = width * 0.05;
  const digitWidth = (width - paddingX * 2 - gap * (digitCount - 1)) / digitCount;
  const digitHeight = height - paddingY * 2;
  const thickness = Math.max(2, digitHeight * 0.13);

  let lastValue = -1;

  const drawSegment = (left: number, top: number, segment: Segment): void => {
    const w = digitWidth;
    const h = digitHeight;
    const t = thickness;
    const half = h / 2;
    const inset = t * 0.15;
    // Horizontal segment centered at (cx, cy), vertical at (cx, cy) with given length.
    const horizontal = (cy: number): Array<[number, number]> => [
      [left + t / 2 + inset, cy],
      [left + t + inset, cy - t / 2],
      [left + w - t - inset, cy - t / 2],
      [left + w - t / 2 - inset, cy],
      [left + w - t - inset, cy + t / 2],
      [left + t + inset, cy + t / 2],
    ];
    const vertical = (cx: number, fromY: number, toY: number): Array<[number, number]> => [
      [cx, fromY + inset],
      [cx + t / 2, fromY + t / 2 + inset],
      [cx + t / 2, toY - t / 2 - inset],
      [cx, toY - inset],
      [cx - t / 2, toY - t / 2 - inset],
      [cx - t / 2, fromY + t / 2 + inset],
    ];

    const shapes: Record<Segment, Array<[number, number]>> = {
      a: horizontal(top + t / 2),
      g: horizontal(top + half),
      d: horizontal(top + h - t / 2),
      f: vertical(left + t / 2, top + t / 2, top + half),
      b: vertical(left + w - t / 2, top + t / 2, top + half),
      e: vertical(left + t / 2, top + half, top + h - t / 2),
      c: vertical(left + w - t / 2, top + half, top + h - t / 2),
    };

    const points = shapes[segment].map(([x, y]) => new Phaser.Geom.Point(
      x + (top + h - y) * SLANT,
      y,
    ));
    segments.fillPoints(points, true);
  };

  return {
    container,
    update: (speedKph) => {
      const maxValue = 10 ** digitCount - 1;
      const value = Math.min(maxValue, Math.max(0, Math.floor(speedKph)));
      if (value === lastValue) {
        return;
      }
      lastValue = value;

      const text = String(value).padStart(digitCount, ' ');
      segments.clear();
      const top = -height / 2 + paddingY;
      for (let index = 0; index < digitCount; index += 1) {
        const left = -width / 2 + paddingX + index * (digitWidth + gap);
        segments.fillStyle(SEGMENT_ON, SEGMENT_GHOST_ALPHA);
        ALL_SEGMENTS.forEach((segment) => drawSegment(left, top, segment));

        const lit = DIGIT_SEGMENTS[text[index]] ?? [];
        segments.fillStyle(SEGMENT_ON, 1);
        lit.forEach((segment) => drawSegment(left, top, segment));
      }
    },
  };
}
