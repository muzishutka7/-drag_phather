import Phaser from 'phaser';
import { palette, toCssColor } from '../config/palette';
import { typography } from '../config/typography';

/** Size of one settings row at scale 1. */
export const SETTING_ROW_HEIGHT = 24;
const LABEL_WIDTH = 84;
const CORNER = 6;
const INSET = 2;

export interface SegmentedOption<T> {
  value: T;
  text: string;
}

export interface SegmentedSettingOptions<T> {
  /** Row width (the label sits on the left, the segments fill the rest). */
  width: number;
  label: string;
  options: readonly SegmentedOption<T>[];
  get: () => T;
  /** Called when another segment is picked. */
  set: (value: T) => void;
}

export interface SegmentedSetting {
  container: Phaser.GameObjects.Container;
  refresh: () => void;
  setEnabled: (enabled: boolean) => void;
}

/**
 * One compact settings row: a muted label on the left and a single rounded
 * segmented control on the right; the picked segment is filled with the
 * accent colour. The container's origin is the row's left edge, vertical centre.
 */
export function createSegmentedSetting<T>(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  config: SegmentedSettingOptions<T>,
): SegmentedSetting {
  const container = scene.add.container(x, y);
  const height = SETTING_ROW_HEIGHT * scale;
  const labelWidth = LABEL_WIDTH * scale;
  const trackWidth = config.width - labelWidth;
  const cellWidth = trackWidth / config.options.length;

  container.add(scene.add.text(0, 0, config.label, {
    fontFamily: typography.fontFamily,
    fontSize: `${Math.max(1, Math.round(11 * scale))}px`,
    color: toCssColor(palette.textMuted),
    letterSpacing: scale,
  }).setOrigin(0, 0.5));

  const track = scene.add.graphics();
  track.fillStyle(palette.track, 1);
  track.fillRoundedRect(labelWidth, -height / 2, trackWidth, height, CORNER * scale);
  track.lineStyle(scale, palette.trackBorder, 1);
  track.strokeRoundedRect(labelWidth, -height / 2, trackWidth, height, CORNER * scale);
  // thin dividers between the segments
  track.lineStyle(scale, palette.trackBorder, 0.7);
  for (let index = 1; index < config.options.length; index += 1) {
    const dividerX = labelWidth + index * cellWidth;
    track.lineBetween(dividerX, -height / 2 + 5 * scale, dividerX, height / 2 - 5 * scale);
  }
  container.add(track);

  const highlight = scene.add.graphics();
  container.add(highlight);

  const texts = config.options.map((option, index) => {
    const cellX = labelWidth + index * cellWidth;
    const text = scene.add.text(cellX + cellWidth / 2, 0, option.text, {
      fontFamily: typography.fontFamily,
      fontSize: `${Math.max(1, Math.round(10 * scale))}px`,
      fontStyle: 'bold',
      color: toCssColor(palette.textSecondary),
    }).setOrigin(0.5);
    container.add(text);
    return text;
  });

  const hitAreas = config.options.map((option, index) => {
    const zone = scene.add.zone(labelWidth + index * cellWidth, -height / 2, cellWidth, height)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.POINTER_UP, () => {
      if (option.value === config.get()) {
        return;
      }
      config.set(option.value);
      refresh();
    });
    container.add(zone);
    return zone;
  });

  function refresh(): void {
    const selected = config.get();
    highlight.clear();
    config.options.forEach((option, index) => {
      const isSelected = option.value === selected;
      texts[index].setColor(toCssColor(isSelected ? palette.textPrimary : palette.textSecondary));
      if (isSelected) {
        highlight.fillStyle(palette.accent, 1);
        highlight.fillRoundedRect(
          labelWidth + index * cellWidth + INSET * scale,
          -height / 2 + INSET * scale,
          cellWidth - INSET * 2 * scale,
          height - INSET * 2 * scale,
          (CORNER - 1) * scale,
        );
      }
    });
  }

  function setEnabled(enabled: boolean): void {
    hitAreas.forEach((zone) => {
      if (zone.input) {
        zone.input.enabled = enabled;
      }
    });
    container.setAlpha(enabled ? 1 : 0.55);
  }

  refresh();
  return { container, refresh, setEnabled };
}
