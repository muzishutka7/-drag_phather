import Phaser from 'phaser';
import { palette } from '../../../config/palette';
import type { CarStats } from '../../../gameobjects/cars/carStats';
import { t, type MessageKey } from '../../../i18n';
import { carParts, type CarPart } from '../../../state/partHealth';
import { createConditionIcon } from '../../../ui/createCheckEngineIcon';

export const CAR_STATS_PANEL_WIDTH = 320;
const PADDING = 16;
const ROW_HEIGHT = 31;
const BAR_HEIGHT = 4;
const HEADER_HEIGHT = 52;
const ENGINE_SECTION_HEIGHT = 64;
const BAR_COLOR = palette.accent;
const BETTER_COLOR = 0x37c45f;
const WORSE_COLOR = 0xe2463f;
/** Faded bar part: what the car would have with a fully repaired engine. */
const LOST_TO_WEAR_COLOR = 0xf05a36;
const LOST_TO_WEAR_ALPHA = 0.28;

interface StatRow {
  label: MessageKey;
  value: (stats: CarStats) => number | undefined;
  format: (value: number) => string;
  /** Range used to fill the bar. */
  min: number;
  max: number;
  /** Lower is better (weight, drag, times). */
  lowerIsBetter?: boolean;
}

/**
 * Rows of the stats panel. The bar ranges cover everything from a stock
 * economy car to a heavily tuned one, so upgrades visibly move the bars.
 */
/** Smallest visible part of a bar. */
const MIN_BAR_SHARE = 0.03;

const STAT_ROWS: readonly StatRow[] = [
  { label: 'statPower', value: (s) => s.powerHp, format: (v) => `${Math.round(v)} ${t('unitHp')}`, min: 0, max: 400 },
  { label: 'statTorque', value: (s) => s.torqueNm, format: (v) => `${Math.round(v)} ${t('unitNm')}`, min: 0, max: 500 },
  { label: 'statWeight', value: (s) => s.massKg, format: (v) => `${Math.round(v)} ${t('unitKg')}`, min: 600, max: 1800, lowerIsBetter: true },
  { label: 'statPowerToWeight', value: (s) => s.powerToWeightHpPerTon, format: (v) => `${Math.round(v)} ${t('unitHpPerTon')}`, min: 0, max: 350 },
  { label: 'statDrag', value: (s) => s.dragAreaM2, format: (v) => `${v.toFixed(2)} ${t('unitM2')}`, min: 0.4, max: 1.3, lowerIsBetter: true },
  { label: 'statGrip', value: (s) => s.gripCoefficient, format: (v) => `μ ${v.toFixed(2)}`, min: 0.6, max: 1.6 },
  { label: 'statTopSpeed', value: (s) => s.topSpeedKph, format: (v) => `${Math.round(v)} ${t('unitKph')}`, min: 100, max: 320 },
  { label: 'statZeroToHundred', value: (s) => s.zeroToHundredSeconds, format: (v) => `${v.toFixed(1)} ${t('unitSeconds')}`, min: 2.5, max: 22, lowerIsBetter: true },
  { label: 'statQuarterMile', value: (s) => s.quarterMileSeconds, format: (v) => `${v.toFixed(2)} ${t('unitSeconds')}`, min: 9, max: 24, lowerIsBetter: true },
];

export const CAR_STATS_PANEL_HEIGHT = HEADER_HEIGHT + STAT_ROWS.length * ROW_HEIGHT
  + ENGINE_SECTION_HEIGHT + PADDING;

export interface CarStatsPanelOptions {
  title: string;
  subtitle: string;
  stats: CarStats;
  /**
   * Stats before an upgrade. When given, every changed row shows the
   * difference (green = better, red = worse) and a ghost of the old bar.
   */
  baseline?: CarStats;
  /**
   * Stats with a fully repaired engine. Where the current value is worse, the
   * bar is extended with a faded part up to this value (what wear has cost).
   */
  potential?: CarStats;
  /** Condition of every part, 0..100 %. */
  condition: Record<CarPart, number>;
  /** The player tapped a part's condition light. */
  onPartSelected: (part: CarPart) => void;
}

export interface CarStatsPanel {
  container: Phaser.GameObjects.Container;
  update: (timeMs: number) => void;
}

export function createCarStatsPanel(
  scene: Phaser.Scene,
  options: CarStatsPanelOptions,
): CarStatsPanel {
  const { stats, baseline, potential } = options;
  const width = CAR_STATS_PANEL_WIDTH;
  const height = CAR_STATS_PANEL_HEIGHT;
  const left = -width / 2;
  const top = -height / 2;
  const container = scene.add.container(0, 0).setName('car-stats-panel');

  const background = scene.add.graphics();
  background.fillStyle(palette.background, 0.82);
  background.fillRoundedRect(left, top, width, height, 14);
  background.lineStyle(1.5, palette.trackBorder, 1);
  background.strokeRoundedRect(left, top, width, height, 14);
  container.add(background);

  container.add(scene.add.text(left + PADDING, top + 12, options.title, {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: '18px',
    color: '#f3f5f7',
  }));
  container.add(scene.add.text(left + PADDING, top + 33, options.subtitle, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    color: '#79868e',
  }));

  const bars = scene.add.graphics();
  container.add(bars);
  const barWidth = width - PADDING * 2;

  STAT_ROWS.forEach((row, index) => {
    const rowTop = top + HEADER_HEIGHT + index * ROW_HEIGHT;
    const value = row.value(stats);
    const previous = baseline ? row.value(baseline) : undefined;

    container.add(scene.add.text(left + PADDING, rowTop + 2, t(row.label), {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#aab4bb',
      letterSpacing: 1,
    }));
    container.add(scene.add.text(-left - PADDING, rowTop, value === undefined ? '—' : row.format(value), {
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      fontSize: '15px',
      color: '#f3f5f7',
    }).setOrigin(1, 0));

    if (value !== undefined && previous !== undefined && Math.abs(value - previous) > 1e-6) {
      const better = row.lowerIsBetter ? value < previous : value > previous;
      const delta = value - previous;
      const deltaText = `${delta > 0 ? '+' : '−'}${row.format(Math.abs(delta))}`;
      container.add(scene.add.text(-left - PADDING - 92, rowTop + 1, deltaText, {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: '12px',
        color: better ? '#5fe08a' : '#ff7a63',
      }).setOrigin(1, 0));
    }

    const barTop = rowTop + 20;
    bars.fillStyle(0x2b3134, 1);
    bars.fillRect(left + PADDING, barTop, barWidth, BAR_HEIGHT);
    if (value === undefined) {
      return;
    }

    const share = (v: number): number => {
      const raw = Phaser.Math.Clamp((v - row.min) / (row.max - row.min), 0, 1);
      // A sliver always stays visible, even for a value outside the range.
      return Math.max(MIN_BAR_SHARE, row.lowerIsBetter ? 1 - raw : raw);
    };
    const current = share(value);
    const ideal = potential ? row.value(potential) : undefined;
    if (ideal !== undefined && share(ideal) > current + 0.001) {
      bars.fillStyle(LOST_TO_WEAR_COLOR, LOST_TO_WEAR_ALPHA);
      bars.fillRect(
        left + PADDING + barWidth * current,
        barTop,
        barWidth * (share(ideal) - current),
        BAR_HEIGHT,
      );
    }
    if (previous !== undefined && Math.abs(value - previous) > 1e-6) {
      const old = share(previous);
      const better = current > old;
      bars.fillStyle(BAR_COLOR, 1);
      bars.fillRect(left + PADDING, barTop, barWidth * Math.min(current, old), BAR_HEIGHT);
      bars.fillStyle(better ? BETTER_COLOR : WORSE_COLOR, 1);
      bars.fillRect(
        left + PADDING + barWidth * Math.min(current, old),
        barTop,
        barWidth * Math.abs(current - old),
        BAR_HEIGHT,
      );
    } else {
      bars.fillStyle(BAR_COLOR, 1);
      bars.fillRect(left + PADDING, barTop, barWidth * current, BAR_HEIGHT);
    }
  });

  // --- Condition lights: engine, suspension, body. Tap one to repair it. ---
  const conditionTop = top + HEADER_HEIGHT + STAT_ROWS.length * ROW_HEIGHT + 6;
  bars.lineStyle(1, palette.trackBorder, 1);
  bars.lineBetween(left + PADDING, conditionTop, -left - PADDING, conditionTop);
  const labels: Record<CarPart, string> = {
    engine: 'CHECK',
    suspension: t('partSuspension'),
    body: t('partBody'),
  };
  const icons = carParts.map((part, index) => {
    const icon = createConditionIcon(scene, part, labels[part]);
    const slotWidth = (width - PADDING * 2) / carParts.length;
    const holder = scene.add.container(left + PADDING + slotWidth * (index + 0.5), conditionTop + 30);
    icon.container.setScale(0.55);
    holder.add(icon.container);
    holder.setSize(slotWidth, ENGINE_SECTION_HEIGHT - 4);
    holder.setInteractive({ useHandCursor: true });
    holder.on(Phaser.Input.Events.POINTER_OVER, () => holder.setScale(1.06));
    holder.on(Phaser.Input.Events.POINTER_OUT, () => holder.setScale(1));
    holder.on(Phaser.Input.Events.POINTER_DOWN, () => holder.setScale(0.95));
    holder.on(Phaser.Input.Events.POINTER_UP, () => {
      holder.setScale(1);
      options.onPartSelected(part);
    });
    container.add(holder);
    return { part, icon };
  });

  return {
    container,
    update: (timeMs) => icons.forEach(({ part, icon }) => (
      icon.update(options.condition[part], false, timeMs)
    )),
  };
}
