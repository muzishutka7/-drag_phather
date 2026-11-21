import Phaser from 'phaser';
import { palette } from '../../../config/palette';
import { t } from '../../../i18n';
import { createUiText } from '../../../ui/createUiText';

/** Squeeze + spring back when loading completes; both together stay under 500 ms. */
const READY_SQUEEZE_SCALE = 0.9;
const READY_SQUEEZE_MS = 110;
const READY_RELEASE_MS = 260;

export interface RaceButton {
  container: Phaser.GameObjects.Container;
  /** Loading progress 0..1: the button fills from left to right. */
  setProgress: (progress: number) => void;
  /** Loading finished: shows the label and makes the button clickable. */
  setReady: (animate: boolean) => void;
}

/**
 * The intro's main button. While the game assets load it is an outlined
 * progress bar with the percentage in place of the label.
 */
export function createRaceButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  state: { progress: number; ready: boolean },
  onClick: () => void,
): RaceButton {
  const button = scene.add.container(x, y);
  const track = scene.add.rectangle(0, 0, width, height, palette.background, 0.45);
  const fill = scene.add.rectangle(-width / 2, 0, width, height, palette.accent, 1).setOrigin(0, 0.5);
  const outline = scene.add.rectangle(0, 0, width, height)
    .setStrokeStyle(2 * scale, palette.buttonBorder, 1);
  const label = createUiText(scene, 0, 0, 'raceButton', 'button', scale);
  button.add([track, fill, outline, label]);
  button.setSize(width, height);

  let ready = false;

  const setProgress = (progress: number): void => {
    if (ready) {
      return;
    }
    const value = Phaser.Math.Clamp(progress, 0, 1);
    fill.setScale(value, 1);
    label.setText(`${Math.floor(value * 100)}%`);
  };

  const setReady = (animate: boolean): void => {
    if (ready) {
      return;
    }
    ready = true;
    fill.setScale(1, 1);
    label.setText(t('raceButton'));
    button.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    if (!animate) {
      return;
    }
    scene.tweens.add({
      targets: button,
      scale: READY_SQUEEZE_SCALE,
      duration: READY_SQUEEZE_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: button,
          scale: 1,
          duration: READY_RELEASE_MS,
          ease: 'Back.easeOut',
        });
      },
    });
  };

  button.on(Phaser.Input.Events.POINTER_OVER, () => {
    fill.setFillStyle(palette.buttonBorder);
  });
  button.on(Phaser.Input.Events.POINTER_OUT, () => {
    fill.setFillStyle(palette.accent);
    button.setScale(1);
  });
  button.on(Phaser.Input.Events.POINTER_DOWN, () => {
    button.setScale(0.97);
  });
  button.on(Phaser.Input.Events.POINTER_UP, () => {
    button.setScale(1);
    onClick();
  });

  if (state.ready) {
    setReady(false);
  } else {
    setProgress(state.progress);
  }

  return { container: button, setProgress, setReady };
}
