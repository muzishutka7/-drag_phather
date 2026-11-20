import Phaser from 'phaser';
import {
  getGraphicsQuality,
  type GraphicsQuality,
} from '../settings/graphicsQuality';

/**
 * Car artwork parts. Every part is a separate image so it can be swapped by
 * an upgrade (paint, rims, tires, brakes, suspension).
 * Bodies are split from the side-view PNGs in assets-source/vehicles/; wheels,
 * brakes and suspension are SVGs drawn in millimetres. See scripts/vehicle-art/.
 */
export const vehiclePartNames = [
  'lanos-body-paint',
  'lanos-body-details',
  'tavria-body-paint',
  'tavria-body-details',
  'tire-175-70-r13',
  'rim-stock-13',
  'brake-disc-stock-236',
  'brake-drum-stock',
  'caliper-stock-front',
  'shock-front-stock',
  'shock-rear-stock',
  'wheel-light-stock',
] as const;

export type VehiclePartName = (typeof vehiclePartNames)[number];

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
  return `${import.meta.env.BASE_URL}vehicles/${quality}/${name}.webp`;
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
