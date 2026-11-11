import Phaser from 'phaser';
import { palette } from '../../../config/palette';

export function createRaceFlagButton(
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
  button.add(createFlagIcon(scene, scale));
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

function createFlagIcon(scene: Phaser.Scene, scale: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const cellSize = 5 * scale;
  const columns = 5;
  const rows = 4;
  const left = -11 * scale;
  const top = -11 * scale;

  graphics.lineStyle(2 * scale, palette.textPrimary, 1);
  graphics.lineBetween(left, -14 * scale, left, 16 * scale);
  graphics.fillStyle(palette.textPrimary);
  graphics.fillCircle(left, 17 * scale, 2 * scale);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const waveOffset = Math.sin((column / (columns - 1)) * Math.PI) * row * 0.35 * scale;
      const isLightSquare = (row + column) % 2 === 0;
      graphics.fillStyle(isLightSquare ? palette.textPrimary : palette.trackBorder);
      graphics.fillRect(
        left + column * cellSize,
        top + row * cellSize + waveOffset,
        cellSize,
        cellSize,
      );
    }
  }

  return graphics;
}
