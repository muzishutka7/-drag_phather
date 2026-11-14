import Phaser from 'phaser';
import {
  getGraphicsQuality,
  type GraphicsQuality,
} from '../settings/graphicsQuality';

export const raceAssetNames = [
  'dashboard-gauges',
  'gauge-needle',
] as const;

export type RaceAssetName = (typeof raceAssetNames)[number];
export type RaceAssetKeys = Record<RaceAssetName, string>;

export function getRaceAssetKey(name: RaceAssetName, quality: GraphicsQuality): string {
  return `race-${name}-${quality}`;
}

export function getRaceAssetUrl(name: RaceAssetName, quality: GraphicsQuality): string {
  return `${import.meta.env.BASE_URL}race-assets/${quality}/${name}.webp`;
}

export function getRaceAssetKeys(quality: GraphicsQuality): RaceAssetKeys {
  return Object.fromEntries(
    raceAssetNames.map((name) => [name, getRaceAssetKey(name, quality)]),
  ) as RaceAssetKeys;
}

export function preloadRaceAssets(
  scene: Phaser.Scene,
  quality: GraphicsQuality = getGraphicsQuality(),
): RaceAssetKeys {
  const keys = getRaceAssetKeys(quality);

  raceAssetNames.forEach((name) => {
    if (!scene.textures.exists(keys[name])) {
      scene.load.image(keys[name], getRaceAssetUrl(name, quality));
    }
  });

  return keys;
}
