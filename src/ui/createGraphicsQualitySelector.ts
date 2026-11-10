import Phaser from 'phaser';
import { palette, toCssColor } from '../config/palette';
import {
  getGraphicsQuality,
  graphicsQualities,
  setGraphicsQuality,
  type GraphicsQuality,
} from '../settings/graphicsQuality';
import { createUiText } from './createUiText';

const qualityLabels: Record<GraphicsQuality, 'qualityLow' | 'qualityMedium' | 'qualityHigh'> = {
  low: 'qualityLow',
  medium: 'qualityMedium',
  high: 'qualityHigh',
};

export interface GraphicsQualitySelector {
  container: Phaser.GameObjects.Container;
  refresh: () => void;
  setEnabled: (enabled: boolean) => void;
}

export function createGraphicsQualitySelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  onChange: (quality: GraphicsQuality) => void,
): GraphicsQualitySelector {
  const selector = scene.add.container(x, y);
  const labelWidth = 104 * scale;
  const optionWidth = 62 * scale;
  const optionHeight = 28 * scale;
  const gap = 5 * scale;
  const totalWidth = labelWidth + gap + optionWidth * graphicsQualities.length
    + gap * (graphicsQualities.length - 1);
  const left = -totalWidth / 2;

  const label = createUiText(scene, left + labelWidth / 2, 0, 'graphicsQuality', 'qualityLabel', scale);
  selector.add(label);

  const backgrounds = new Map<GraphicsQuality, Phaser.GameObjects.Rectangle>();
  const labels = new Map<GraphicsQuality, Phaser.GameObjects.Text>();

  graphicsQualities.forEach((quality, index) => {
    const optionX = left + labelWidth + gap + optionWidth / 2
      + index * (optionWidth + gap);
    const background = scene.add.rectangle(
      optionX,
      0,
      optionWidth,
      optionHeight,
      palette.track,
    );
    background.setStrokeStyle(scale, palette.trackBorder);
    background.setName(`graphics-quality-${quality}`);
    background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, optionWidth, optionHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    background.on(Phaser.Input.Events.POINTER_UP, () => {
      if (quality === getGraphicsQuality()) {
        return;
      }

      setGraphicsQuality(quality);
      updateSelection();
      onChange(quality);
    });

    const optionLabel = createUiText(
      scene,
      optionX,
      0,
      qualityLabels[quality],
      'qualityOption',
      scale,
    );

    backgrounds.set(quality, background);
    labels.set(quality, optionLabel);
    selector.add([background, optionLabel]);
  });

  function updateSelection(selectedQuality = getGraphicsQuality()): void {

    graphicsQualities.forEach((quality) => {
      const selected = quality === selectedQuality;
      backgrounds.get(quality)?.setFillStyle(selected ? palette.accent : palette.track);
      labels.get(quality)?.setColor(toCssColor(
        selected ? palette.textPrimary : palette.textSecondary,
      ));
    });
  }

  function setEnabled(enabled: boolean): void {
    backgrounds.forEach((background) => {
      if (background.input) {
        background.input.enabled = enabled;
      }
    });
  }

  updateSelection();

  return {
    container: selector,
    refresh: () => updateSelection(),
    setEnabled,
  };
}
