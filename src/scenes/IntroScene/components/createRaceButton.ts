import Phaser from 'phaser';
import { palette } from '../../../config/palette';
import { createUiText } from '../../../ui/createUiText';

export function createRaceButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const button = scene.add.container(x, y);
  const background = scene.add.rectangle(0, 0, width, height, palette.accent, 1);
  background.setStrokeStyle(2 * scale, palette.buttonBorder, 1);
  button.add(background);
  button.add(createUiText(scene, 0, 0, 'raceButton', 'button', scale));

  button.setSize(width, height);
  button.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains,
  );
  button.on(Phaser.Input.Events.POINTER_OVER, () => {
    background.setFillStyle(palette.buttonBorder);
  });
  button.on(Phaser.Input.Events.POINTER_OUT, () => {
    background.setFillStyle(palette.accent);
    button.setScale(1);
  });
  button.on(Phaser.Input.Events.POINTER_DOWN, () => {
    button.setScale(0.97);
  });
  button.on(Phaser.Input.Events.POINTER_UP, () => {
    button.setScale(1);
    onClick();
  });

  return button;
}
