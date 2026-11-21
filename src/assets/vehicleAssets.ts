import Phaser from 'phaser';
import {
  getGraphicsQuality,
  type GraphicsQuality,
} from '../settings/graphicsQuality';

/**
 * Car artwork. Every part is a separate image so it can be swapped by an
 * upgrade (paint, rims, tires, brakes, suspension).
 *
 * Files live in public/vehicles/:
 *   cars/<car>/<quality>/body-paint.webp, body-details.webp
 *   parts/<group>/<quality>/<part>.webp   (wheels, brakes, suspension)
 * Sources: assets-source/vehicles/ (same layout), see scripts/vehicle-art/.
 */
export const VEHICLE_PART_PATHS = {
  'lanos-body-paint': 'cars/lanos/body-paint',
  'lanos-body-details': 'cars/lanos/body-details',
  'tavria-body-paint': 'cars/tavria/body-paint',
  'tavria-body-details': 'cars/tavria/body-details',
  'moskvich-412-body-paint': 'cars/moskvich-412/body-paint',
  'moskvich-412-body-details': 'cars/moskvich-412/body-details',
  'tire-175-70-r13': 'parts/wheels/tire-175-70-r13',
  'rim-stock-13': 'parts/wheels/rim-stock-13',
  'wheel-light-stock': 'parts/wheels/wheel-light-stock',
  'brake-disc-stock-236': 'parts/brakes/brake-disc-stock-236',
  'brake-drum-stock': 'parts/brakes/brake-drum-stock',
  'caliper-stock-front': 'parts/brakes/caliper-stock-front',
  'shock-front-stock': 'parts/suspension/shock-front-stock',
  'shock-rear-stock': 'parts/suspension/shock-rear-stock',
} as const;

export type VehiclePartName = keyof typeof VEHICLE_PART_PATHS;
export const vehiclePartNames = Object.keys(VEHICLE_PART_PATHS) as VehiclePartName[];

/** Pixels per millimetre the images were rendered at, per quality. */
export const VEHICLE_PIXELS_PER_MM: Record<GraphicsQuality, number> = {
  low: 0.16,
  medium: 0.27,
  high: 0.4,
};

export function getVehiclePartKey(name: VehiclePartName, quality: GraphicsQuality): string {
  return `vehicle-${name}-${quality}`;
}

export function getVehiclePartUrl(name: VehiclePartName, quality: GraphicsQuality): string {
  const path = VEHICLE_PART_PATHS[name];
  const slash = path.lastIndexOf('/');
  return `${import.meta.env.BASE_URL}vehicles/${path.slice(0, slash)}/${quality}/${path.slice(slash + 1)}.webp`;
}

export function preloadVehicleAssets(
  scene: Phaser.Scene,
  parts: readonly VehiclePartName[] = vehiclePartNames,
  quality: GraphicsQuality = getGraphicsQuality(),
): GraphicsQuality {
  parts.forEach((name) => {
    const key = getVehiclePartKey(name, quality);
    if (!scene.textures.exists(key)) {
      scene.load.image(key, getVehiclePartUrl(name, quality));
    }
  });
  return quality;
}
