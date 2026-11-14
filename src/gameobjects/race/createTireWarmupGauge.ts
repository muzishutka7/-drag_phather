import Phaser from 'phaser';
import { palette } from '../../config/palette';
import type { TireProfile } from '../cars/carProfiles';
import { t } from '../../i18n';
import { getGripMultiplier } from './raceEngine';

const BAR_WIDTH = 360;
const BAR_HEIGHT = 22;
const ZONE_STRIP_HEIGHT = 8;
const TICK_STEP = 10;
const MAJOR_TICK_STEP = 50;
const COLD_COLOR = 0x3f8fd8;
const OPTIMAL_COLOR = 0x2fc25b;
const HOT_COLOR = 0xe2463f;

export interface TireWarmupGaugeState {
  warmup: number;
  gripMultiplier: number;
  /** Seconds left, or undefined when the countdown has not started. */
  countdownSeconds: number | undefined;
  locked: boolean;
}

export interface TireWarmupGauge {
  container: Phaser.GameObjects.Container;
  update: (state: TireWarmupGaugeState) => void;
  layout: (width: number, layoutScale: number) => void;
}

/**
 * Tire warmup bar. The colored strip under the bar is drawn from the tire's
 * warmup → grip curve, so the "divisions" always match the physics.
 */
export function createTireWarmupGauge(
  scene: Phaser.Scene,
  tires: TireProfile,
): TireWarmupGauge {
  const container = scene.add.container(0, 0).setName('tire-warmup-gauge').setDepth(6);
  const staticLayer = scene.add.graphics();
  const fillLayer = scene.add.graphics();
  const textStyle = {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    color: '#f3f5f7',
    stroke: '#101820',
    strokeThickness: 4,
  };
  const gripText = scene.add.text(-BAR_WIDTH / 2, -BAR_HEIGHT / 2 - 6, '', {
    ...textStyle,
    fontSize: '16px',
  }).setOrigin(0, 1);
  const countdownText = scene.add.text(BAR_WIDTH / 2 + 18, 0, '', {
    ...textStyle,
    fontSize: '34px',
    strokeThickness: 6,
  }).setOrigin(0, 0.5);
  container.add([staticLayer, fillLayer, gripText, countdownText]);

  const peakMultiplier = Math.max(...tires.warmupGripCurve.map((point) => point.gripMultiplier));
  const minMultiplier = Math.min(...tires.warmupGripCurve.map((point) => point.gripMultiplier));
  const optimalPoints = tires.warmupGripCurve.filter(
    (point) => point.gripMultiplier === peakMultiplier,
  );
  const optimalStart = optimalPoints[0].warmup;
  const optimalEnd = optimalPoints[optimalPoints.length - 1].warmup;

  const colorAt = (warmup: number): number => {
    const multiplier = getGripMultiplier(tires, warmup);
    const quality = (multiplier - minMultiplier) / Math.max(0.0001, peakMultiplier - minMultiplier);
    return warmup > optimalEnd
      ? lerpColor(HOT_COLOR, OPTIMAL_COLOR, quality)
      : lerpColor(COLD_COLOR, OPTIMAL_COLOR, quality);
  };
  const xAt = (warmup: number): number => -BAR_WIDTH / 2 + (BAR_WIDTH * warmup) / 100;

  drawStaticLayer();

  function drawStaticLayer(): void {
    staticLayer.clear();
    staticLayer.fillStyle(0x161c1b, 0.92);
    staticLayer.fillRoundedRect(-BAR_WIDTH / 2 - 4, -BAR_HEIGHT / 2 - 4, BAR_WIDTH + 8,
      BAR_HEIGHT + ZONE_STRIP_HEIGHT + 12, 6);

    // Grip zone strip under the bar.
    const stripTop = BAR_HEIGHT / 2 + 2;
    for (let warmup = 0; warmup < 100; warmup += 1) {
      staticLayer.fillStyle(colorAt(warmup + 0.5), 1);
      staticLayer.fillRect(xAt(warmup), stripTop, BAR_WIDTH / 100 + 0.5, ZONE_STRIP_HEIGHT);
    }

    // Optimal window outline.
    staticLayer.lineStyle(2, OPTIMAL_COLOR, 1);
    staticLayer.strokeRect(
      xAt(optimalStart),
      -BAR_HEIGHT / 2 - 2,
      xAt(optimalEnd) - xAt(optimalStart),
      BAR_HEIGHT + ZONE_STRIP_HEIGHT + 6,
    );
  }

  function drawTicks(): void {
    for (let warmup = TICK_STEP; warmup < 100; warmup += TICK_STEP) {
      const major = warmup % MAJOR_TICK_STEP === 0;
      fillLayer.lineStyle(major ? 2 : 1, palette.textPrimary, major ? 0.8 : 0.45);
      fillLayer.lineBetween(
        xAt(warmup),
        -BAR_HEIGHT / 2,
        xAt(warmup),
        major ? BAR_HEIGHT / 2 : -BAR_HEIGHT / 2 + BAR_HEIGHT * 0.45,
      );
    }
  }

  return {
    container,
    update: ({ warmup, gripMultiplier, countdownSeconds, locked }) => {
      const value = Phaser.Math.Clamp(warmup, 0, 100);
      fillLayer.clear();
      fillLayer.fillStyle(0x252a29, 1);
      fillLayer.fillRect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT);
      // Each step of the fill takes the color of its grip zone.
      for (let step = 0; step < value; step += 1) {
        const stepEnd = Math.min(value, step + 1);
        fillLayer.fillStyle(colorAt(step + 0.5), 1);
        fillLayer.fillRect(xAt(step), -BAR_HEIGHT / 2, xAt(stepEnd) - xAt(step) + 0.5, BAR_HEIGHT);
      }
      drawTicks();

      // Current value marker.
      fillLayer.fillStyle(locked ? 0xffffff : palette.textPrimary, 1);
      fillLayer.fillTriangle(
        xAt(value) - 7, -BAR_HEIGHT / 2 - 9,
        xAt(value) + 7, -BAR_HEIGHT / 2 - 9,
        xAt(value), -BAR_HEIGHT / 2 + 1,
      );
      fillLayer.lineStyle(2, palette.textPrimary, 0.9);
      fillLayer.strokeRect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT);

      const label = locked ? t('raceGripLocked') : t('raceGrip');
      gripText.setText(`${label}  ×${gripMultiplier.toFixed(2)}`);
      gripText.setColor(locked ? '#7cf0a0' : '#f3f5f7');
      countdownText.setText(countdownSeconds === undefined ? '' : String(Math.ceil(countdownSeconds)));
      countdownText.setColor(countdownSeconds !== undefined && countdownSeconds <= 3 ? '#ff7a63' : '#f3f5f7');
    },
    layout: (width, layoutScale) => {
      container.setPosition(width / 2, 78 * layoutScale).setScale(layoutScale);
    },
  };
}

function lerpColor(from: number, to: number, progress: number): number {
  const amount = Phaser.Math.Clamp(progress, 0, 1);
  const channel = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
