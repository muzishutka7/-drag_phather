import Phaser from 'phaser';
import { palette } from '../../config/palette';

export interface CarOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  color: number;
  scale: number;
  drawWheels?: boolean;
}

export function fillPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: Phaser.Geom.Point[],
  color: number,
): void {
  graphics.fillStyle(color);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }

  graphics.closePath();
  graphics.fillPath();
}

export function drawWheel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
): void {
  graphics.fillStyle(palette.wheel);
  graphics.fillCircle(x, y, radius);
  graphics.fillStyle(palette.wheelHub);
  graphics.fillCircle(x, y, radius * 0.65);
  graphics.fillStyle(palette.wheelCenter);
  graphics.fillCircle(x, y, radius * 0.32);

  graphics.fillStyle(0xf3f5f7, 0.95);
  graphics.fillCircle(x + radius * 0.1, y - radius * 0.82, radius * 0.09);
  graphics.fillCircle(x + radius * 0.78, y + radius * 0.28, radius * 0.09);
  graphics.fillCircle(x - radius * 0.52, y + radius * 0.62, radius * 0.09);
}
