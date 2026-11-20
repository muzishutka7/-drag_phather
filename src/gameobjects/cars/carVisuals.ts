import type { VehiclePartName } from '../../assets/vehicleAssets';

/** Parts mounted on one axle. */
export interface AxleVisual {
  /** Axle centre in body millimetres (x from the rear bumper, y down from the roof). */
  x: number;
  y: number;
  /**
   * Size of the wheel parts relative to how they are drawn (a 333 mm tire).
   * Lets different cars share the same wheel, brake and suspension art.
   */
  wheelScale: number;
  /** Shock absorber / spring. Static, drawn behind the body (seen in the wheel well). */
  suspension: VehiclePartName;
  /** Brake disc or drum. Rotates with the wheel. */
  brake: VehiclePartName;
  /** Brake caliper. Static; drum brakes have none. */
  caliper?: VehiclePartName;
  /** Rotates. Shaded only radially so spinning never flickers. */
  tire: VehiclePartName;
  /** Rotates. See-through vent holes show the brake behind. */
  rim: VehiclePartName;
  /** Static light and contact shadow over the whole wheel (never rotates). */
  light: VehiclePartName;
}

export interface CarVisualProfile {
  lengthMm: number;
  /** y of the ground in body millimetres. */
  groundYMm: number;
  /** Top-left corner of the body images in body millimetres. */
  bodyImageOriginMm: { x: number; y: number };
  /** Greyscale paint layer, tinted with paintColor in the game. */
  bodyPaint: VehiclePartName;
  /** Glass, lights, trims, rubber, wheel wells. Not tinted. */
  bodyDetails: VehiclePartName;
  paintColor: number;
  rearAxle: AxleVisual;
  frontAxle: AxleVisual;
}

/** Wheel art is drawn for this tire radius (mm). */
const WHEEL_ART_TIRE_RADIUS_MM = 333;

const STOCK_REAR = {
  suspension: 'shock-rear-stock',
  brake: 'brake-drum-stock',
  tire: 'tire-175-70-r13',
  rim: 'rim-stock-13',
  light: 'wheel-light-stock',
} as const satisfies Partial<AxleVisual>;

const STOCK_FRONT = {
  suspension: 'shock-front-stock',
  brake: 'brake-disc-stock-236',
  caliper: 'caliper-stock-front',
  tire: 'tire-175-70-r13',
  rim: 'rim-stock-13',
  light: 'wheel-light-stock',
} as const satisfies Partial<AxleVisual>;

/**
 * Daewoo Lanos sedan. Positions are measured on the source picture by
 * scripts/vehicle-art/build-car-layers.py (see its meta.json output).
 */
export const LANOS_VISUAL: CarVisualProfile = {
  lengthMm: 4237,
  groundYMm: 1452,
  bodyImageOriginMm: { x: 0, y: 0 },
  bodyPaint: 'lanos-body-paint',
  bodyDetails: 'lanos-body-details',
  paintColor: 0x3cc864,
  rearAxle: { x: 890.6, y: 1119.7, wheelScale: 332.6 / WHEEL_ART_TIRE_RADIUS_MM, ...STOCK_REAR },
  frontAxle: { x: 3472.6, y: 1118.4, wheelScale: 332.6 / WHEEL_ART_TIRE_RADIUS_MM, ...STOCK_FRONT },
};

/** ZAZ Tavria hatchback (not used in the game yet). */
export const TAVRIA_VISUAL: CarVisualProfile = {
  lengthMm: 3708,
  groundYMm: 1412,
  bodyImageOriginMm: { x: 0, y: 0 },
  bodyPaint: 'tavria-body-paint',
  bodyDetails: 'tavria-body-details',
  paintColor: 0xd83a2c,
  rearAxle: { x: 737, y: 1131.8, wheelScale: 278 / WHEEL_ART_TIRE_RADIUS_MM, ...STOCK_REAR },
  frontAxle: { x: 3082.8, y: 1135.4, wheelScale: 278 / WHEEL_ART_TIRE_RADIUS_MM, ...STOCK_FRONT },
};

export function getCarVisualParts(visual: CarVisualProfile): VehiclePartName[] {
  const parts = new Set<VehiclePartName>([visual.bodyPaint, visual.bodyDetails]);
  [visual.rearAxle, visual.frontAxle].forEach((axle) => {
    [axle.suspension, axle.brake, axle.tire, axle.rim, axle.light].forEach((part) => parts.add(part));
    if (axle.caliper) {
      parts.add(axle.caliper);
    }
  });
  return [...parts];
}
