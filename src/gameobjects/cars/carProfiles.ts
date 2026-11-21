export interface EngineTorquePoint {
  rpm: number;
  torqueNm: number;
}

export type Drivetrain = 'front-wheel' | 'rear-wheel' | 'all-wheel';

/**
 * Gear speed limits are not configured by hand: they follow from the ratio,
 * final drive, wheel radius and redline (see getGearMaxSpeedKph in raceEngine).
 */
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

export interface EngineWearProfile {
  /** Health lost per second while bouncing on the rev limiter (%). */
  limiterWearPerSecond: number;
  /**
   * Health lost per second when the engine is forced past the redline
   * (e.g. a too-early downshift), at 1000 rpm over. Grows with the square
   * of the over-rev: 2000 rpm over wears 4× faster.
   */
  overRevWearPerSecondAt1000Rpm: number;
  /** Share of power left when health reaches 0 %. */
  minPowerFactor: number;
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
  fuelInjection: 'multi-point' | 'carburetor';
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
  engineWear: EngineWearProfile;
  torqueCurve: readonly EngineTorquePoint[];
}

export const STREET_TIRE: TireProfile = {
  name: 'Street 175/70 R13',
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
  // Factory data: 86 PS (85 hp) @ 5800 rpm, 130 Nm @ 3400 rpm,
  // 0–100 km/h 12.5 s, top speed 172 km/h, curb weight 1035 kg, tyres 175/70 R13.
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
  // Curb weight 1035 kg + 75 kg driver.
  massKg: 1_110,
  drivenAxleWeightRatio: 0.62,
  // 175/70 R13: 288 mm unloaded, ~285 mm rolling radius.
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
  // Cd ≈ 0.34 × frontal area ≈ 2.04 m² (1678 mm wide, 1432 mm high).
  dragAreaM2: 0.69,
  rollingResistanceCoefficient: 0.013,
  brakeDecelerationMps2: 8,
  tires: STREET_TIRE,
  engineWear: {
    limiterWearPerSecond: 0.05,
    overRevWearPerSecondAt1000Rpm: 4,
    minPowerFactor: 0.6,
  },
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

/**
 * Moskvich 412 (AZLK, 1967–1969 front with vertical headlights), UZAM-412 engine.
 * Factory data: 1478 cc, 75 hp @ 5800 rpm, 108 Nm @ 3800 rpm, curb weight 1045 kg,
 * 4-speed manual, rear-wheel drive, top speed 140 km/h, 0–100 km/h 19 s,
 * 4115 × 1550 × 1480 mm, wheelbase 2400 mm.
 * Gearbox 3.49 / 2.04 / 1.33 / 1.00, final drive 4.22.
 * Runs on the same stock 13" wheels and street tires as the Lanos.
 */
export const MOSKVICH_412_PROFILE = {
  id: 'moskvich-412-uzam-412',
  name: 'Moskvich 412',
  engineCode: 'UZAM-412',
  displacementCc: 1_478,
  cylinderCount: 4,
  valveCount: 8,
  fuelType: 'gasoline',
  aspiration: 'naturally-aspirated',
  fuelInjection: 'carburetor',
  drivetrain: 'rear-wheel',
  idleRpm: 850,
  // The aluminium OHC UZAM likes to rev: a bit more headroom over peak power.
  redlineRpm: 6_200,
  peakPowerHp: 75,
  peakPowerRpm: 5_800,
  peakTorqueNm: 108,
  peakTorqueRpm: 3_800,
  // Older, heavier flywheel: revs climb and fall slower than on the Lanos.
  engineInertiaKgM2: 0.19,
  engineBrakeTorqueNm: 12,
  engineBrakeTorquePer1000RpmNm: 5,
  clutchMaxTorqueNm: 220,
  clutchFullEngageRpm: 3_300,
  // Long-travel lever of a 1960s gearbox.
  shiftTimeSeconds: 0.32,
  // Curb weight 1045 kg + 75 kg driver.
  massKg: 1_120,
  // Static rear axle load is ~48 %; under hard acceleration weight moves to the
  // driven rear wheels, which a rear-drive car profits from (the model has no
  // dynamic weight transfer, so it is folded into this ratio).
  drivenAxleWeightRatio: 0.54,
  // Same 175/70 R13 wheels as the Lanos.
  wheelRadiusMeters: 0.285,
  // Rear-wheel drive: longer driveline (propeller shaft, hypoid axle) and
  // 1960s bearings and oils lose more than a modern FWD transaxle.
  drivetrainEfficiency: 0.83,
  drivenWheelEquivalentMassKg: 30,
  finalDriveRatio: 4.22,
  gears: [
    { ratio: 3.49 },
    { ratio: 2.04 },
    { ratio: 1.33 },
    { ratio: 1.0 },
  ],
  // Boxy 1960s saloon: Cd ≈ 0.53 × frontal area ≈ 1.98 m² (1550 mm wide, 1480 mm high).
  dragAreaM2: 1.05,
  rollingResistanceCoefficient: 0.014,
  // Drum brakes all round.
  brakeDecelerationMps2: 6.8,
  tires: STREET_TIRE,
  engineWear: {
    limiterWearPerSecond: 0.06,
    overRevWearPerSecondAt1000Rpm: 4.5,
    minPowerFactor: 0.6,
  },
  torqueCurve: [
    { rpm: 850, torqueNm: 60 },
    { rpm: 1_500, torqueNm: 71 },
    { rpm: 2_000, torqueNm: 81 },
    { rpm: 2_500, torqueNm: 90 },
    { rpm: 3_000, torqueNm: 98 },
    { rpm: 3_500, torqueNm: 106.5 },
    { rpm: 3_800, torqueNm: 108 },
    { rpm: 4_300, torqueNm: 106.5 },
    { rpm: 4_800, torqueNm: 103 },
    { rpm: 5_300, torqueNm: 98 },
    { rpm: 5_800, torqueNm: 92 },
    { rpm: 6_200, torqueNm: 85 },
  ],
} satisfies CarEngineProfile;

/**
 * ZAZ-1102 Tavria, MeMZ-245 engine, 5-speed gearbox.
 * Factory data: 1091 cc, 53 hp @ 5500 rpm, 79 Nm @ 3000 rpm, curb weight 710 kg,
 * front-wheel drive, top speed 148 km/h, 0–100 km/h 16 s, 155/70 R13 tyres,
 * 3708 × 1554 × 1410 mm, wheelbase 2320 mm.
 * Gearbox 3.454 / 2.056 / 1.333 / 0.969 / 0.828, final drive 3.875.
 */
export const TAVRIA_PROFILE = {
  id: 'zaz-1102-tavria-memz-245',
  name: 'ZAZ Tavria 1.1',
  engineCode: 'MeMZ-245',
  displacementCc: 1_091,
  cylinderCount: 4,
  valveCount: 8,
  fuelType: 'gasoline',
  aspiration: 'naturally-aspirated',
  fuelInjection: 'carburetor',
  drivetrain: 'front-wheel',
  idleRpm: 900,
  redlineRpm: 6_200,
  peakPowerHp: 53,
  peakPowerRpm: 5_500,
  peakTorqueNm: 79,
  peakTorqueRpm: 3_000,
  // Small, light engine: revs pick up quickly.
  engineInertiaKgM2: 0.11,
  engineBrakeTorqueNm: 9,
  engineBrakeTorquePer1000RpmNm: 4,
  clutchMaxTorqueNm: 170,
  clutchFullEngageRpm: 3_300,
  shiftTimeSeconds: 0.27,
  // Curb weight 710 kg + 75 kg driver.
  massKg: 785,
  // Engine and gearbox over the front wheels.
  drivenAxleWeightRatio: 0.6,
  // 155/70 R13: 276 mm unloaded, ~272 mm rolling radius.
  wheelRadiusMeters: 0.272,
  drivetrainEfficiency: 0.88,
  drivenWheelEquivalentMassKg: 26,
  finalDriveRatio: 3.875,
  gears: [
    { ratio: 3.454 },
    { ratio: 2.056 },
    { ratio: 1.333 },
    { ratio: 0.969 },
    { ratio: 0.828 },
  ],
  // Cd ≈ 0.41 × frontal area ≈ 1.80 m² (1554 mm wide, 1410 mm high).
  dragAreaM2: 0.74,
  rollingResistanceCoefficient: 0.013,
  // Front discs, rear drums, very light car.
  brakeDecelerationMps2: 7.5,
  tires: { ...STREET_TIRE, name: 'Street 155/70 R13' },
  engineWear: {
    limiterWearPerSecond: 0.06,
    overRevWearPerSecondAt1000Rpm: 4.5,
    minPowerFactor: 0.6,
  },
  torqueCurve: [
    { rpm: 900, torqueNm: 52 },
    { rpm: 1_500, torqueNm: 62 },
    { rpm: 2_000, torqueNm: 70 },
    { rpm: 2_500, torqueNm: 76 },
    { rpm: 3_000, torqueNm: 79 },
    { rpm: 3_500, torqueNm: 78.5 },
    { rpm: 4_000, torqueNm: 77 },
    { rpm: 4_500, torqueNm: 74.5 },
    { rpm: 5_000, torqueNm: 71.5 },
    { rpm: 5_500, torqueNm: 68.6 },
    { rpm: 6_000, torqueNm: 63 },
    { rpm: 6_200, torqueNm: 60 },
  ],
} satisfies CarEngineProfile;
