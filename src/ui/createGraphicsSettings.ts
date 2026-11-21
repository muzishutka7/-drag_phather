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
import { SETTING_ROW_HEIGHT } from './createSegmentedSetting';
import { createSoundVolumeSelector } from './createSoundVolumeSelector';

const PANEL_WIDTH = 300;
const PANEL_PADDING = 16;
const HEADER_GAP = 14;
const ROW_GAP = 8;
/** Space around the thin line between groups of rows. */
const GROUP_GAP = 22;

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
  const panelWidth = Math.min(PANEL_WIDTH * scale, scene.scale.width - 24 * scale);
  const padding = PANEL_PADDING * scale;
  const rowWidth = panelWidth - padding * 2;
  const rowStep = (SETTING_ROW_HEIGHT + ROW_GAP) * scale;

  // Invisible full-screen layer under the open panel: a tap outside closes it
  // (and does not reach the buttons underneath).
  const outside = scene.add.zone(-x, -y, scene.scale.width, scene.scale.height)
    .setOrigin(0)
    .setInteractive();
  outside.on(Phaser.Input.Events.POINTER_UP, () => setOpen(false));
  root.add(outside);

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
    setOpen(!panel.visible);
  });
  root.add(button);

  // Panel content is laid out top-down from the panel's top-left corner.
  const panel = scene.add.container(buttonSize / 2 - panelWidth, buttonSize / 2 + 10 * scale);
  const background = scene.add.graphics();
  const lines = scene.add.graphics();
  panel.add([background, lines]);
  const left = padding;
  let cursorY = padding;

  // Header: title on the left, close on the right.
  const title = createUiText(scene, left, cursorY + 8 * scale, 'settingsTitle', 'settingsTitle', scale)
    .setOrigin(0, 0.5);
  panel.add(title);
  const closeButton = createUiText(scene, panelWidth - padding, cursorY + 8 * scale, 'settingsClose', 'settingsClose', scale)
    .setOrigin(1, 0.5);
  closeButton.setInteractive({ useHandCursor: true });
  closeButton.on(Phaser.Input.Events.POINTER_UP, () => {
    setOpen(false);
  });
  panel.add(closeButton);
  cursorY += 16 * scale + HEADER_GAP * scale;

  const rowY = (): number => cursorY + (SETTING_ROW_HEIGHT * scale) / 2;
  const separator = (): void => {
    cursorY += (GROUP_GAP / 2 - ROW_GAP) * scale;
    lines.lineStyle(scale, palette.trackBorder, 0.6);
    lines.lineBetween(left, cursorY, panelWidth - padding, cursorY);
    cursorY += (GROUP_GAP / 2) * scale;
  };

  // --- Graphics ---
  const qualitySelector = createGraphicsQualitySelector(scene, left, rowY(), rowWidth, scale, onQualityChange);
  panel.add(qualitySelector.container);
  cursorY += rowStep;
  const resolutionSelector = createRenderResolutionSelector(scene, left, rowY(), rowWidth, scale, onResolutionChange);
  panel.add(resolutionSelector.container);
  cursorY += rowStep;
  panel.add(createFrameRateSelector(scene, left, rowY(), rowWidth, scale));
  cursorY += rowStep;
  separator();

  // --- Sound ---
  panel.add(createSoundVolumeSelector(scene, left, rowY(), rowWidth, scale, 'effects', 'effectsSetting'));
  cursorY += rowStep;
  panel.add(createSoundVolumeSelector(scene, left, rowY(), rowWidth, scale, 'music', 'musicSetting'));
  cursorY += rowStep;
  separator();

  // --- Language ---
  panel.add(createLanguageSelector(scene, left, rowY(), rowWidth, scale, onLocaleChange));
  cursorY += rowStep;

  // Footnote for the FPS* row.
  const note = createUiText(scene, left, cursorY + 4 * scale, 'frameRateRestartHint', 'settingsNote', scale)
    .setOrigin(0, 0.5);
  panel.add(note);
  cursorY += 8 * scale + padding;

  const panelHeight = cursorY;
  background.fillStyle(palette.background, 0.97);
  background.fillRoundedRect(0, 0, panelWidth, panelHeight, 12 * scale);
  background.lineStyle(1.5 * scale, palette.trackBorder, 1);
  background.strokeRoundedRect(0, 0, panelWidth, panelHeight, 12 * scale);
  panel.setVisible(initiallyOpen);
  outside.setVisible(initiallyOpen);
  if (outside.input) {
    outside.input.enabled = initiallyOpen;
  }

  function setOpen(open: boolean): void {
    panel.setVisible(open);
    outside.setVisible(open);
    if (outside.input) {
      outside.input.enabled = open;
    }
    onOpenChange(open);
  }
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
