import Phaser from 'phaser';
import { palette } from '../../../config/palette';

export function createPartsStoreButton(
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
  button.add(createPartsIcon(scene, scale));
  button.setSize(size, size);
  button.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, size, size),
    Phaser.Geom.Rectangle.Contains,
  );
  button.on(Phaser.Input.Events.POINTER_OVER, () => {
    button.setAlpha(0.82);
  });
  button.on(Phaser.Input.Events.POINTER_OUT, () => {
    button.setAlpha(1).setScale(1);
  });
  button.on(Phaser.Input.Events.POINTER_DOWN, () => {
    button.setScale(0.96);
  });
  button.on(Phaser.Input.Events.POINTER_UP, () => {
    button.setScale(1);
    onClick();
  });

  return button;
}

function createPartsIcon(scene: Phaser.Scene, scale: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const boxWidth = 13 * scale;
  const boxHeight = 17 * scale;

  graphics.lineStyle(2 * scale, palette.textPrimary, 1);
  graphics.strokeRoundedRect(-15 * scale, -9 * scale, boxWidth, boxHeight, 2 * scale);
  graphics.strokeRoundedRect(2 * scale, -9 * scale, boxWidth, boxHeight, 2 * scale);
  graphics.strokeRoundedRect(-6.5 * scale, 2 * scale, boxWidth, boxHeight, 2 * scale);
  graphics.lineBetween(-12 * scale, -4 * scale, -5 * scale, -4 * scale);
  graphics.lineBetween(5 * scale, -4 * scale, 12 * scale, -4 * scale);
  graphics.lineBetween(-3.5 * scale, 7 * scale, 3.5 * scale, 7 * scale);
  graphics.fillStyle(palette.accent);
  graphics.fillCircle(-8.5 * scale, scale, 2 * scale);
  graphics.fillCircle(8.5 * scale, scale, 2 * scale);
  graphics.fillCircle(0, 12 * scale, 2 * scale);

  return graphics;
}
