import Phaser from 'phaser';
import { palette, toCssColor } from '../config/palette';
import {
  frameRates,
  getFrameRate,
  setFrameRate,
  type FrameRate,
} from '../settings/frameRate';
import { createUiText } from './createUiText';

export function createFrameRateSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
): Phaser.GameObjects.Container {
  const selector = scene.add.container(x, y);
  const labelWidth = 104 * scale;
  const optionWidth = 62 * scale;
  const optionHeight = 28 * scale;
  const gap = 5 * scale;
  const left = -(labelWidth + gap + optionWidth * frameRates.length
    + gap * (frameRates.length - 1)) / 2;
  const backgrounds = new Map<FrameRate, Phaser.GameObjects.Rectangle>();
  const labels = new Map<FrameRate, Phaser.GameObjects.Text>();

  selector.add(createUiText(
    scene,
    left + labelWidth / 2,
    0,
    'frameRateSetting',
    'qualityLabel',
    scale,
  ));

  frameRates.forEach((frameRate, index) => {
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
    background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, optionWidth, optionHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    background.on(Phaser.Input.Events.POINTER_UP, () => {
      if (frameRate === getFrameRate()) {
        return;
      }

      setFrameRate(frameRate);
      updateSelection();
    });

    const label = createUiText(
      scene,
      optionX,
      0,
      frameRate === 30 ? 'frameRate30' : 'frameRate60',
      'frameRateOption',
      scale,
    );

    backgrounds.set(frameRate, background);
    labels.set(frameRate, label);
    selector.add([background, label]);
  });

  function updateSelection(): void {
    const selectedFrameRate = getFrameRate();
    frameRates.forEach((frameRate) => {
      const selected = frameRate === selectedFrameRate;
      backgrounds.get(frameRate)?.setFillStyle(selected ? palette.accent : palette.track);
      labels.get(frameRate)?.setColor(toCssColor(
        selected ? palette.textPrimary : palette.textSecondary,
      ));
    });
  }

  updateSelection();
  return selector;
}
