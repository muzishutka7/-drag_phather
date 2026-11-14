export interface EngineTorquePoint {
  rpm: number;
  torqueNm: number;
}

export type Drivetrain = 'front-wheel' | 'rear-wheel' | 'all-wheel';

export interface TransmissionGear {
  ratio: number;
  maxSpeedKph: number;
  accelerationKphPerSecond: number;
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
  redlineRpm: number;
  limiterStartRpm: number;
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  neutralRpmRisePerSecond: number;
  neutralRpmFallPerSecond: number;
  massKg: number;
  drivenAxleWeightRatio: number;
  tireGripCoefficient: number;
  wheelRadiusMeters: number;
  drivetrainEfficiency: number;
  effectiveDrivenWheelMassKg: number;
  finalDriveRatio: number;
  gears: readonly TransmissionGear[];
  coastDecelerationKphPerSecond: number;
  brakeDecelerationKphPerSecond: number;
  torqueCurve: readonly EngineTorquePoint[];
}

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
  idleRpm: 1_000,
  redlineRpm: 6_000,
  limiterStartRpm: 5_850,
  peakPowerHp: 85,
  peakPowerRpm: 5_800,
  peakTorqueNm: 130,
  peakTorqueRpm: 3_400,
  neutralRpmRisePerSecond: 4_000,
  neutralRpmFallPerSecond: 3_000,
  massKg: 1_050,
  drivenAxleWeightRatio: 0.62,
  tireGripCoefficient: 0.75,
  wheelRadiusMeters: 0.285,
  drivetrainEfficiency: 0.88,
  effectiveDrivenWheelMassKg: 75,
  finalDriveRatio: 3.722,
  gears: [
    { ratio: 3.545, maxSpeedKph: 39, accelerationKphPerSecond: 10 },
    { ratio: 1.952, maxSpeedKph: 71, accelerationKphPerSecond: 8.5 },
    { ratio: 1.276, maxSpeedKph: 108, accelerationKphPerSecond: 7 },
    { ratio: 0.971, maxSpeedKph: 142, accelerationKphPerSecond: 5.5 },
    { ratio: 0.763, maxSpeedKph: 172, accelerationKphPerSecond: 4 },
  ],
  coastDecelerationKphPerSecond: 12,
  brakeDecelerationKphPerSecond: 55,
  torqueCurve: [
    { rpm: 1_000, torqueNm: 82 },
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
