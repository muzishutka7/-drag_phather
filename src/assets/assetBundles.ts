import { playableCars } from '../gameobjects/cars/carCatalog';
import { getCarVisualParts } from '../gameobjects/cars/carVisuals';
import type { GraphicsQuality } from '../settings/graphicsQuality';
import { ENGINE_SOUND_KEYS, getEngineSoundUrls } from '../audio/engineSoundBank';
import { getBackgroundKey, getBackgroundUrl, type BackgroundName } from './backgrounds';
import { getRaceAssetKey, getRaceAssetUrl, raceAssetNames } from './raceAssets';
import { getVehiclePartKey, getVehiclePartUrl, type VehiclePartName } from './vehicleAssets';

/** One file the game needs: an image (texture key) or a sound (audio cache key). */
export interface GameAsset {
  key: string;
  /** Several URLs = the same sound in different formats; the first playable one is used. */
  url: string | string[];
  type?: 'image' | 'audio';
}

/**
 * Everything a scene needs before it can be shown. A scene's bundle is loaded
 * before the scene starts (see startSceneWhenReady), so it never opens on a
 * dark screen. Right now the intro loads every bundle at once (the game is
 * small); later, big bundles can be loaded on the way to their scene instead.
 */
export const assetBundleNames = ['intro', 'garage', 'partsStore', 'race'] as const;
export type AssetBundleName = (typeof assetBundleNames)[number];

/** Scene key → its bundle. */
export const sceneAssetBundles: Record<string, AssetBundleName> = {
  IntroScene: 'intro',
  GarageScene: 'garage',
  PartsStoreScene: 'partsStore',
  RaceScene: 'race',
};

export function getBackgroundAsset(name: BackgroundName, quality: GraphicsQuality): GameAsset {
  return { key: getBackgroundKey(name, quality), url: getBackgroundUrl(name, quality) };
}

/** Engine recordings (one shared set for every car for now). */
function engineSoundAssets(): GameAsset[] {
  return Object.values(ENGINE_SOUND_KEYS).map((key) => ({
    key,
    url: getEngineSoundUrls(key),
    type: 'audio' as const,
  }));
}

function vehicleAssets(quality: GraphicsQuality): GameAsset[] {
  // Every playable car: the player can switch cars in the garage at any time.
  const parts = new Set<VehiclePartName>(playableCars.flatMap((car) => getCarVisualParts(car.visual)));
  return [...parts].map((name) => ({
    key: getVehiclePartKey(name, quality),
    url: getVehiclePartUrl(name, quality),
  }));
}

export function getBundleAssets(bundle: AssetBundleName, quality: GraphicsQuality): GameAsset[] {
  switch (bundle) {
    case 'intro':
      return [getBackgroundAsset('sunset-drift', quality)];
    case 'garage':
      return [getBackgroundAsset('sunny-garage', quality), ...vehicleAssets(quality), ...engineSoundAssets()];
    case 'partsStore':
      return [getBackgroundAsset('parts-garage', quality)];
    case 'race':
      return [
        getBackgroundAsset('race-panorama', quality),
        ...raceAssetNames.map((name) => ({
          key: getRaceAssetKey(name, quality),
          url: getRaceAssetUrl(name, quality),
        })),
        ...vehicleAssets(quality),
        ...engineSoundAssets(),
      ];
  }
}

/** All bundles without duplicates (vehicles are shared by the garage and the race). */
export function getAllAssets(quality: GraphicsQuality): GameAsset[] {
  const byKey = new Map<string, GameAsset>();
  assetBundleNames.forEach((bundle) => {
    getBundleAssets(bundle, quality).forEach((asset) => byKey.set(asset.key, asset));
  });
  return [...byKey.values()];
}
