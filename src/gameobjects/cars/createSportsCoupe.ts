import Phaser from 'phaser';
import { palette } from '../../config/palette';
import { drawWheel, fillPolygon } from './carDrawing';
import type { CarOptions } from './carDrawing';

export function createSportsCoupe({
  scene,
  x,
  y,
  color,
  scale,
}: CarOptions): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setPosition(x, y).setScale(scale).setName('sports-coupe');

  drawWheel(graphics, -70, 19, 20);
  drawWheel(graphics, 72, 19, 20);

  fillPolygon(graphics, [
    new Phaser.Geom.Point(-125, 12),
    new Phaser.Geom.Point(-119, -7),
    new Phaser.Geom.Point(-108, -12),
    new Phaser.Geom.Point(-95, -30),
    new Phaser.Geom.Point(-68, -43),
    new Phaser.Geom.Point(2, -43),
    new Phaser.Geom.Point(24, -37),
    new Phaser.Geom.Point(57, -12),
    new Phaser.Geom.Point(103, -12),
    new Phaser.Geom.Point(117, -5),
    new Phaser.Geom.Point(125, 10),
    new Phaser.Geom.Point(125, 20),
    new Phaser.Geom.Point(-125, 20),
  ], color);

  fillPolygon(graphics, [
    new Phaser.Geom.Point(-84, -27),
    new Phaser.Geom.Point(-64, -38),
    new Phaser.Geom.Point(-24, -38),
    new Phaser.Geom.Point(-24, -15),
    new Phaser.Geom.Point(-99, -15),
  ], palette.carWindow);
  fillPolygon(graphics, [
    new Phaser.Geom.Point(-16, -38),
    new Phaser.Geom.Point(1, -37),
    new Phaser.Geom.Point(32, -15),
    new Phaser.Geom.Point(-16, -15),
  ], palette.carWindow);

  graphics.fillStyle(palette.carTrim);
  graphics.fillRect(-8, -37, 5, 23);
  graphics.fillRect(-30, 0, 15, 4);
  graphics.fillRect(25, 0, 15, 4);

  graphics.fillStyle(palette.carDetail);
  graphics.fillRect(92, -4, 17, 7);

  return graphics;
}
