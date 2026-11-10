import Phaser from 'phaser';
import { palette } from '../../config/palette';

export interface CarOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  color: number;
  scale: number;
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
}
