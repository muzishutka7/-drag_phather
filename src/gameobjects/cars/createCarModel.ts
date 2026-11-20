import Phaser from 'phaser';
import {
  VEHICLE_PIXELS_PER_MM,
  getVehiclePartKey,
  type VehiclePartName,
} from '../../assets/vehicleAssets';
import type { GraphicsQuality } from '../../settings/graphicsQuality';
import type { AxleVisual, CarVisualProfile } from './carVisuals';

export type CarAxle = 'front' | 'rear';

export interface CarModel {
  /**
   * Container in millimetres: origin on the ground under the middle of the
   * car, +x towards the front. Scale it to pixels-per-millimetre.
   */
  container: Phaser.GameObjects.Container;
  lengthMm: number;
  /** Rotation of the wheel (tire, rim, brake disc) in radians. */
  setWheelRotation: (axle: CarAxle, rotation: number) => void;
  setPaintColor: (color: number) => void;
}

/**
 * Builds the car from separate images, back to front:
 * suspension → body paint (tinted) → body details → per axle: brake →
 * caliper → tire → rim → static light overlay.
 */
export function createCarModel(
  scene: Phaser.Scene,
  visual: CarVisualProfile,
  quality: GraphicsQuality,
): CarModel {
  const pixelsPerMm = VEHICLE_PIXELS_PER_MM[quality];
  const container = scene.add.container(0, 0).setName('car-model');
  const originX = visual.lengthMm / 2;
  const originY = visual.groundYMm;

  const image = (
    part: VehiclePartName,
    x: number,
    y: number,
    origin: [number, number],
    scale = 1,
  ) => {
    const key = getVehiclePartKey(part, quality);
    if (!scene.textures.exists(key)) {
      console.error(`Vehicle part is not loaded: ${key}`);
    }
    return scene.add.image(x - originX, y - originY, key)
      .setOrigin(origin[0], origin[1])
      .setScale(scale / pixelsPerMm)
      .setName(part);
  };
  const axles: Array<[CarAxle, AxleVisual]> = [['rear', visual.rearAxle], ['front', visual.frontAxle]];
  const atAxle = (part: VehiclePartName, axle: AxleVisual) => (
    image(part, axle.x, axle.y, [0.5, 0.5], axle.wheelScale)
  );

  // Soft contact shadow on the ground.
  const shadow = scene.add.ellipse(0, -10, visual.lengthMm * 0.98, 140, 0x000000, 0.3)
    .setName('ground-shadow');
  container.add(shadow);

  // Suspension sits behind the body: it shows only in the wheel wells.
  axles.forEach(([, axle]) => container.add(atAxle(axle.suspension, axle)));

  const paint = image(visual.bodyPaint, visual.bodyImageOriginMm.x, visual.bodyImageOriginMm.y, [0, 0])
    .setTint(visual.paintColor);
  const details = image(visual.bodyDetails, visual.bodyImageOriginMm.x, visual.bodyImageOriginMm.y, [0, 0]);
  container.add([paint, details]);

  const rotating: Record<CarAxle, Phaser.GameObjects.Image[]> = { front: [], rear: [] };
  axles.forEach(([name, axle]) => {
    const brake = atAxle(axle.brake, axle);
    const caliper = axle.caliper ? atAxle(axle.caliper, axle) : undefined;
    const tire = atAxle(axle.tire, axle);
    const rim = atAxle(axle.rim, axle);
    const light = atAxle(axle.light, axle);
    container.add([brake, ...(caliper ? [caliper] : []), tire, rim, light]);
    rotating[name].push(brake, tire, rim);
  });

  return {
    container,
    lengthMm: visual.lengthMm,
    setWheelRotation: (axle, rotation) => {
      rotating[axle].forEach((part) => part.setRotation(rotation));
    },
    setPaintColor: (color) => {
      paint.setTint(color);
    },
  };
}
