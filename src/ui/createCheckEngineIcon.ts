import Phaser from 'phaser';

/** Below this health the outline blinks red. */
export const CHECK_ENGINE_WARNING_HEALTH = 70;
const CRITICAL_HEALTH = 35;

const OUTLINE_OK = 0x8a949a;
const OUTLINE_WARNING = 0xe2463f;
const OUTLINE_OVERREV = 0xffb22e;
const TEXT_OK = '#e4e8ea';
const TEXT_WARNING = '#ff7a63';

export type CheckEngineState = 'ok' | 'warning' | 'critical' | 'over-rev';

export interface CheckEngineIcon {
  container: Phaser.GameObjects.Container;
  /** timeMs drives the blinking. */
  update: (health: number, overRevving: boolean, timeMs: number) => void;
}

/** Outline of the classic "check engine" pictogram, centered on 0,0 (≈ 100×56). */
const ENGINE_OUTLINE: ReadonlyArray<[number, number]> = [
  [-38, -4], [-30, -4], [-30, -16], [-12, -16], [-12, -22], [-22, -22], [-22, -28],
  [20, -28], [20, -22], [10, -22], [10, -16], [24, -16], [32, -8], [40, -8],
  [40, -16], [48, -16], [48, 20], [40, 20], [40, 12], [32, 12], [22, 24],
  [-30, 24], [-30, 10], [-38, 10],
];

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
 * "CHECK" engine light with the engine condition inside.
 * - ok (≥ 70 %): grey outline
 * - warning (< 70 %): outline blinks red
 * - critical (< 35 %): fast red blink, red numbers
 * - over-rev: amber flashing while the engine is past the redline
 */
export function createCheckEngineIcon(scene: Phaser.Scene, label = 'CHECK'): CheckEngineIcon {
  const container = scene.add.container(0, 0).setName('check-engine-icon');
  const outline = scene.add.graphics();
  const percentText = scene.add.text(5, 3, '', {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: '18px',
    color: TEXT_OK,
  }).setOrigin(0.5);
  const labelText = scene.add.text(5, 40, label, {
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
    outline.fillStyle(0x0e1213, 0.85);
    outline.lineStyle(4, color, alpha);
    outline.beginPath();
    outline.moveTo(ENGINE_OUTLINE[0][0], ENGINE_OUTLINE[0][1]);
    ENGINE_OUTLINE.slice(1).forEach(([x, y]) => outline.lineTo(x, y));
    outline.closePath();
    outline.fillPath();
    outline.strokePath();
    // Connector on the left side.
    outline.lineBetween(-46, -10, -46, 16);
    outline.lineBetween(-46, 3, -38, 3);
  };

  return {
    container,
    update: (health, overRevving, timeMs) => {
      const state = getCheckEngineState(health, overRevving);
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

function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
