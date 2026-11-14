export interface EngineTorquePoint {
  rpm: number;
  torqueNm: number;
}

export type Drivetrain = 'front-wheel' | 'rear-wheel' | 'all-wheel';

export interface TransmissionGear {
  ratio: number;
}

/** Point of the "tire warmup → grip multiplier" curve. Warmup is 0..100. */
export interface TireGripPoint {
  warmup: number;
  gripMultiplier: number;
}

export interface TireProfile {
  name: string;
  /** Static friction coefficient of a tire at multiplier 1.0. */
  baseGripCoefficient: number;
  /** Sliding (spinning) friction as a fraction of static friction. */
  kineticGripRatio: number;
  /** How the warmup level changes grip. Must be sorted by warmup. */
  warmupGripCurve: readonly TireGripPoint[];
  /** Warmup points gained per second for every 1 km/h of wheel slip. */
  warmupPerSlipKphPerSecond: number;
  /** Slip speed above which heating stops growing (km/h). */
  maxHeatingSlipKph: number;
  /** Fraction of the current warmup lost per second when the tire is not slipping. */
  coolingRatePerSecond: number;
}

export interface CarEngineProfile {
  id: string;
  name: string;
  engineCode: string;
  displacementCc: number;
  cylinderCount: number;
  valveCount: number;
  fuelType: 'gasoline';
  aspiration: 'naturally-aspirated';
  fuelInjection: 'multi-point';
  drivetrain: Drivetrain;
  idleRpm: number;
  /** The rev limiter cuts fuel at this rpm. */
  redlineRpm: number;
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  /** Rotating inertia of the engine, flywheel and clutch (kg·m²). */
  engineInertiaKgM2: number;
  /** Engine braking torque at idle and the extra per 1000 rpm (Nm). */
  engineBrakeTorqueNm: number;
  engineBrakeTorquePer1000RpmNm: number;
  /** Max torque the clutch can pass when fully engaged. */
  clutchMaxTorqueNm: number;
  /** Rpm at which the launch clutch is fully engaged (centrifugal-style launch). */
  clutchFullEngageRpm: number;
  /** Time the clutch is open during a gear change. */
  shiftTimeSeconds: number;
  massKg: number;
  drivenAxleWeightRatio: number;
  wheelRadiusMeters: number;
  drivetrainEfficiency: number;
  /** Rotating inertia of the driven wheels expressed as an equivalent mass (kg). */
  drivenWheelEquivalentMassKg: number;
  finalDriveRatio: number;
  gears: readonly TransmissionGear[];
  /** Drag coefficient × frontal area (m²). */
  dragAreaM2: number;
  rollingResistanceCoefficient: number;
  /** Deceleration produced by full braking (m/s²). */
  brakeDecelerationMps2: number;
  tires: TireProfile;
  torqueCurve: readonly EngineTorquePoint[];
}

export const STREET_TIRE: TireProfile = {
  name: 'Street 185/60 R14',
  baseGripCoefficient: 0.85,
  kineticGripRatio: 0.82,
  warmupGripCurve: [
    { warmup: 0, gripMultiplier: 0.8 },
    { warmup: 30, gripMultiplier: 0.88 },
    { warmup: 55, gripMultiplier: 1.0 },
    { warmup: 70, gripMultiplier: 1.15 },
    { warmup: 80, gripMultiplier: 1.15 },
    { warmup: 90, gripMultiplier: 1.0 },
    { warmup: 100, gripMultiplier: 0.82 },
  ],
  warmupPerSlipKphPerSecond: 0.55,
  maxHeatingSlipKph: 40,
  coolingRatePerSecond: 0.035,
};

export const STARTER_COUPE_PROFILE = {
  id: 'daewoo-lanos-15-a15sms',
  name: 'Daewoo Lanos 1.5 8V',
  engineCode: 'A15SMS',
  displacementCc: 1_498,
  cylinderCount: 4,
  valveCount: 8,
  fuelType: 'gasoline',
  aspiration: 'naturally-aspirated',
  fuelInjection: 'multi-point',
  drivetrain: 'front-wheel',
  idleRpm: 900,
  redlineRpm: 6_000,
  peakPowerHp: 85,
  peakPowerRpm: 5_800,
  peakTorqueNm: 130,
  peakTorqueRpm: 3_400,
  engineInertiaKgM2: 0.16,
  engineBrakeTorqueNm: 12,
  engineBrakeTorquePer1000RpmNm: 5,
  clutchMaxTorqueNm: 260,
  clutchFullEngageRpm: 3_500,
  shiftTimeSeconds: 0.25,
  massKg: 1_130,
  drivenAxleWeightRatio: 0.62,
  wheelRadiusMeters: 0.285,
  drivetrainEfficiency: 0.88,
  drivenWheelEquivalentMassKg: 30,
  finalDriveRatio: 3.722,
  gears: [
    { ratio: 3.545 },
    { ratio: 1.952 },
    { ratio: 1.276 },
    { ratio: 0.971 },
    { ratio: 0.763 },
  ],
  dragAreaM2: 0.66,
  rollingResistanceCoefficient: 0.013,
  brakeDecelerationMps2: 8,
  tires: STREET_TIRE,
  torqueCurve: [
    { rpm: 900, torqueNm: 80 },
    { rpm: 1_500, torqueNm: 93 },
    { rpm: 2_000, torqueNm: 105 },
    { rpm: 2_500, torqueNm: 116 },
    { rpm: 3_000, torqueNm: 125 },
    { rpm: 3_400, torqueNm: 130 },
    { rpm: 4_000, torqueNm: 128 },
    { rpm: 4_500, torqueNm: 123 },
    { rpm: 5_000, torqueNm: 116 },
    { rpm: 5_500, torqueNm: 108 },
    { rpm: 5_800, torqueNm: 104.5 },
    { rpm: 6_000, torqueNm: 98 },
  ],
} satisfies CarEngineProfile;
