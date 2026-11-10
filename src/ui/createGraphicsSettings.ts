import Phaser from 'phaser';
import { palette } from '../config/palette';
import type { Locale } from '../i18n';
import type { GraphicsQuality } from '../settings/graphicsQuality';
import type { RenderResolution } from '../settings/renderResolution';
import { createGraphicsQualitySelector, type GraphicsQualitySelector } from './createGraphicsQualitySelector';
import { createUiText } from './createUiText';
import { createLanguageSelector } from './createLanguageSelector';
import { createRenderResolutionSelector, type RenderResolutionSelector } from './createRenderResolutionSelector';
import { createFrameRateSelector } from './createFrameRateSelector';

export interface GraphicsSettings {
  container: Phaser.GameObjects.Container;
  qualitySelector: GraphicsQualitySelector;
  resolutionSelector: RenderResolutionSelector;
  setEnabled: (enabled: boolean) => void;
}

export function createGraphicsSettings(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  onQualityChange: (quality: GraphicsQuality) => void,
  onResolutionChange: (resolution: RenderResolution) => void,
  onLocaleChange: (locale: Locale) => void,
  onOpenChange: (isOpen: boolean) => void,
  initiallyOpen: boolean,
): GraphicsSettings {
  const root = scene.add.container(x, y);
  const buttonSize = 48 * scale;
  const panelWidth = Math.min(360 * scale, scene.scale.width - 24 * scale);
  const panelHeight = 266 * scale;

  const button = scene.add.container(0, 0);
  button.add(
    scene.add.rectangle(0, 0, buttonSize, buttonSize, palette.track, 0.92)
      .setStrokeStyle(1.5 * scale, palette.trackBorder),
  );
  button.add(createGearIcon(scene, scale));
  button.setSize(buttonSize, buttonSize);
  button.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, buttonSize, buttonSize),
    Phaser.Geom.Rectangle.Contains,
  );
  button.on(Phaser.Input.Events.POINTER_UP, () => {
    panel.setVisible(!panel.visible);
    onOpenChange(panel.visible);
  });
  root.add(button);

  const panel = scene.add.container(
    (buttonSize - panelWidth) / 2,
    buttonSize / 2 + 12 * scale + panelHeight / 2,
  );
  panel.add(
    scene.add.rectangle(0, 0, panelWidth, panelHeight, palette.track, 0.97)
      .setStrokeStyle(1.5 * scale, palette.trackBorder),
  );
  panel.add(
    createUiText(scene, 0, -panelHeight * 0.37, 'settingsTitle', 'settingsTitle', scale),
  );

  const closeButton = createUiText(
    scene,
    panelWidth / 2 - 18 * scale,
    -panelHeight * 0.41,
    'settingsClose',
    'settingsClose',
    scale,
  );
  closeButton.setInteractive();
  closeButton.on(Phaser.Input.Events.POINTER_UP, () => {
    panel.setVisible(false);
    onOpenChange(false);
  });
  panel.add(closeButton);

  const qualitySelector = createGraphicsQualitySelector(
    scene,
    0,
    -panelHeight * 0.28,
    scale,
    onQualityChange,
  );
  panel.add(qualitySelector.container);
  const resolutionSelector = createRenderResolutionSelector(
    scene,
    0,
    -panelHeight * 0.08,
    scale,
    onResolutionChange,
  );
  panel.add(resolutionSelector.container);
  panel.add(createFrameRateSelector(scene, 0, panelHeight * 0.12, scale));
  panel.add(
    createUiText(
      scene,
      0,
      panelHeight * 0.24,
      'frameRateRestartHint',
      'qualityLabel',
      scale,
    ),
  );
  panel.add(
    createLanguageSelector(
      scene,
      0,
      panelHeight * 0.39,
      scale,
      onLocaleChange,
    ),
  );
  panel.setVisible(initiallyOpen);
  root.add(panel);

  return {
    container: root,
    qualitySelector,
    resolutionSelector,
    setEnabled: (enabled) => {
      if (button.input) {
        button.input.enabled = enabled;
      }

      qualitySelector.setEnabled(enabled);
      resolutionSelector.setEnabled(enabled);
    },
  };
}

function createGearIcon(scene: Phaser.Scene, scale: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const teeth = 8;
  const radius = 15 * scale;
  const outerRadius = 19 * scale;
  const points: Phaser.Geom.Point[] = [];

  for (let index = 0; index < teeth * 4; index += 1) {
    const angle = (index / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
    const isTooth = index % 4 === 1 || index % 4 === 2;
    const pointRadius = (isTooth ? outerRadius : radius);
    points.push(new Phaser.Geom.Point(
      Math.cos(angle) * pointRadius,
      Math.sin(angle) * pointRadius,
    ));
  }

  graphics.fillStyle(palette.accent);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
  graphics.closePath();
  graphics.fillPath();
  graphics.fillStyle(palette.track);
  graphics.fillCircle(0, 0, 6 * scale);
  graphics.lineStyle(2 * scale, palette.textPrimary, 1);
  graphics.strokeCircle(0, 0, 6 * scale);

  return graphics;
}
