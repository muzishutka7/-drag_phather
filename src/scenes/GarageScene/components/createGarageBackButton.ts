import Phaser from 'phaser';
import { palette } from '../../../config/palette';

export function createGarageBackButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const size = 48 * scale;
  const button = scene.add.container(x, y);
  button.add(
    scene.add.rectangle(0, 0, size, size, palette.track, 0.92)
      .setStrokeStyle(1.5 * scale, palette.trackBorder),
  );

  const icon = scene.add.graphics();
  icon.lineStyle(3 * scale, palette.textPrimary, 1);
  icon.lineBetween(11 * scale, 0, -11 * scale, 0);
  icon.lineBetween(-11 * scale, 0, -2 * scale, -9 * scale);
  icon.lineBetween(-11 * scale, 0, -2 * scale, 9 * scale);
  button.add(icon);

  button.setSize(size, size);
  button.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, size, size),
    Phaser.Geom.Rectangle.Contains,
  );
  button.on(Phaser.Input.Events.POINTER_OVER, () => button.setAlpha(0.82));
  button.on(Phaser.Input.Events.POINTER_OUT, () => button.setAlpha(1).setScale(1));
  button.on(Phaser.Input.Events.POINTER_DOWN, () => button.setScale(0.96));
  button.on(Phaser.Input.Events.POINTER_UP, () => {
    button.setScale(1);
    onClick();
  });

  return button;
}
