import Phaser from 'phaser';
import {
  getGraphicsQuality,
  type GraphicsQuality,
} from '../settings/graphicsQuality';

export const backgroundNames = [
  'sunset-drift',
  'sunny-garage',
  'parts-garage',
] as const;

export type BackgroundName = (typeof backgroundNames)[number];

export function getBackgroundKey(name: BackgroundName, quality: GraphicsQuality): string {
  return `background-${name}-${quality}`;
}

export function getBackgroundUrl(name: BackgroundName, quality: GraphicsQuality): string {
  return `${import.meta.env.BASE_URL}backgrounds/${quality}/${name}.webp`;
}

export function preloadBackground(
  scene: Phaser.Scene,
  name: BackgroundName,
  quality: GraphicsQuality = getGraphicsQuality(),
): string {
  const key = getBackgroundKey(name, quality);

  if (!scene.textures.exists(key)) {
    scene.load.image(key, getBackgroundUrl(name, quality));
  }

  return key;
}
