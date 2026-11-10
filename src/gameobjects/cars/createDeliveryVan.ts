import Phaser from 'phaser';
import { palette } from '../../config/palette';
import { drawWheel, fillPolygon } from './carDrawing';
import type { CarOptions } from './carDrawing';

export function createDeliveryVan({
  scene,
  x,
  y,
  color,
  scale,
}: CarOptions): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setPosition(x, y).setScale(scale).setName('delivery-van');

  drawWheel(graphics, -66, 20, 20);
  drawWheel(graphics, 75, 20, 20);

  fillPolygon(graphics, [
    new Phaser.Geom.Point(-117, -31),
    new Phaser.Geom.Point(35, -31),
    new Phaser.Geom.Point(54, -25),
    new Phaser.Geom.Point(76, 0),
    new Phaser.Geom.Point(111, 6),
    new Phaser.Geom.Point(123, 14),
    new Phaser.Geom.Point(123, 21),
    new Phaser.Geom.Point(-117, 21),
  ], color);

  fillPolygon(graphics, [
    new Phaser.Geom.Point(-98, -22),
    new Phaser.Geom.Point(-30, -22),
    new Phaser.Geom.Point(-30, -2),
    new Phaser.Geom.Point(-98, -2),
  ], palette.carTrim);
  fillPolygon(graphics, [
    new Phaser.Geom.Point(-22, -22),
    new Phaser.Geom.Point(30, -22),
    new Phaser.Geom.Point(30, -2),
    new Phaser.Geom.Point(-22, -2),
  ], palette.carTrim);
  fillPolygon(graphics, [
    new Phaser.Geom.Point(40, -21),
    new Phaser.Geom.Point(51, -17),
    new Phaser.Geom.Point(66, -1),
    new Phaser.Geom.Point(40, -1),
  ], palette.carTrim);

  graphics.fillStyle(palette.carTrim);
  graphics.fillRect(-13, 1, 15, 4);
  graphics.fillStyle(palette.vanDetail);
  graphics.fillRect(20, 1, 18, 7);
  graphics.fillStyle(palette.headlight);
  graphics.fillRoundedRect(118, 11, 6, 9, 3);

  return graphics;
}
