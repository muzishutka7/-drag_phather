import Phaser from 'phaser';
import { palette, toCssColor } from '../config/palette';
import type { RenderResolution } from '../settings/renderResolution';
import { getRenderResolution, renderResolutions, setRenderResolution } from '../settings/renderResolution';
import { createUiText } from './createUiText';

const resolutionLabels: Record<RenderResolution, 'resolutionLow' | 'resolutionMedium' | 'resolutionHigh'> = {
  low: 'resolutionLow',
  medium: 'resolutionMedium',
  high: 'resolutionHigh',
};

export interface RenderResolutionSelector {
  container: Phaser.GameObjects.Container;
  refresh: () => void;
  setEnabled: (enabled: boolean) => void;
}

export function createRenderResolutionSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  onChange: (resolution: RenderResolution) => void,
): RenderResolutionSelector {
  const selector = scene.add.container(x, y);
  const labelWidth = 104 * scale;
  const optionWidth = 62 * scale;
  const optionHeight = 28 * scale;
  const gap = 5 * scale;
  const left = -(labelWidth + gap + optionWidth * renderResolutions.length
    + gap * (renderResolutions.length - 1)) / 2;

  selector.add(createUiText(
    scene,
    left + labelWidth / 2,
    0,
    'renderResolution',
    'qualityLabel',
    scale,
  ));

  const backgrounds = new Map<RenderResolution, Phaser.GameObjects.Rectangle>();
  const labels = new Map<RenderResolution, Phaser.GameObjects.Text>();

  renderResolutions.forEach((resolution, index) => {
    const optionX = left + labelWidth + gap + optionWidth / 2
      + index * (optionWidth + gap);
    const background = scene.add.rectangle(optionX, 0, optionWidth, optionHeight, palette.track);
    background.setStrokeStyle(scale, palette.trackBorder);
    background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, optionWidth, optionHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    background.on(Phaser.Input.Events.POINTER_UP, () => {
      if (resolution === getRenderResolution()) {
        return;
      }

      setRenderResolution(resolution);
      updateSelection();
      onChange(resolution);
    });

    const optionLabel = createUiText(
      scene,
      optionX,
      0,
      resolutionLabels[resolution],
      'qualityOption',
      scale,
    );

    backgrounds.set(resolution, background);
    labels.set(resolution, optionLabel);
    selector.add([background, optionLabel]);
  });

  function updateSelection(): void {
    const selectedResolution = getRenderResolution();
    renderResolutions.forEach((resolution) => {
      const selected = resolution === selectedResolution;
      backgrounds.get(resolution)?.setFillStyle(selected ? palette.accent : palette.track);
      labels.get(resolution)?.setColor(toCssColor(
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
  return { container: selector, refresh: updateSelection, setEnabled };
}
