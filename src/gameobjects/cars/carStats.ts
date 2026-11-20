import { RaceEngine, getGripMultiplier, getTorqueAtRpm } from '../race/raceEngine';
import type { CarEngineProfile } from './carProfiles';

/** Numbers shown on the garage stats panel. */
export interface CarStats {
  /** Effective peak power after engine wear, hp. */
  powerHp: number;
  /** Effective peak torque after engine wear, Nm. */
  torqueNm: number;
  massKg: number;
  powerToWeightHpPerTon: number;
  dragAreaM2: number;
  /** Tire friction at the best warmup (base grip × best multiplier). */
  gripCoefficient: number;
  topSpeedKph: number;
  zeroToHundredSeconds: number | undefined;
  quarterMileSeconds: number | undefined;
}

const SIM_STEP_MS = 1000 / 120;
const SIM_MAX_SECONDS = 40;
const QUARTER_MILE_METERS = 402;
const ROLLOUT_METERS = 0.3;
const LAUNCH_RPM_SHARE = 0.65;
const SHIFT_RPM_MARGIN = 100;

const cache = new Map<string, CarStats>();

/**
 * Computes the stats of a car. 0–100 and 402 m are estimated by running the
 * real race physics with a clean launch, perfect tire warmup and shifts at
 * the redline, so any upgrade that changes the physics shows up here.
 */
export function getCarStats(profile: CarEngineProfile, engineHealth = 100): CarStats {
  const key = `${JSON.stringify(profile)}|${engineHealth.toFixed(1)}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const engine = new RaceEngine(profile);
  engine.engineHealth = engineHealth;
  const powerFactor = engine.powerFactor;
  const bestGrip = Math.max(...profile.tires.warmupGripCurve.map((point) => point.gripMultiplier));
  const optimalWarmup = profile.tires.warmupGripCurve
    .find((point) => point.gripMultiplier === bestGrip)?.warmup ?? 75;
  const run = simulateRun(profile, engineHealth, optimalWarmup);

  const stats: CarStats = {
    powerHp: profile.peakPowerHp * powerFactor,
    torqueNm: profile.peakTorqueNm * powerFactor,
    massKg: profile.massKg,
    powerToWeightHpPerTon: (profile.peakPowerHp * powerFactor) / (profile.massKg / 1000),
    dragAreaM2: profile.dragAreaM2,
    gripCoefficient: profile.tires.baseGripCoefficient
      * getGripMultiplier(profile.tires, optimalWarmup),
    topSpeedKph: getTopSpeedKph(profile, powerFactor),
    zeroToHundredSeconds: run.zeroToHundredSeconds,
    quarterMileSeconds: run.quarterMileSeconds,
  };
  cache.set(key, stats);
  return stats;
}

function simulateRun(
  profile: CarEngineProfile,
  engineHealth: number,
  warmup: number,
): { zeroToHundredSeconds?: number; quarterMileSeconds?: number } {
  const engine = new RaceEngine(profile);
  engine.engineHealth = engineHealth;
  engine.tireWarmup = warmup;
  engine.lockTireWarmup();

  // Rev in neutral, then drop the clutch in 1st.
  const launchRpm = profile.redlineRpm * LAUNCH_RPM_SHARE;
  for (let guard = 0; engine.rpm < launchRpm && guard < 1000; guard += 1) {
    engine.update(SIM_STEP_MS, { throttle: true, brake: false, holdVehicle: true });
  }
  engine.shiftUp();

  let time = 0;
  let startTime: number | undefined;
  let zeroToHundredSeconds: number | undefined;
  let quarterMileSeconds: number | undefined;
  while (time < SIM_MAX_SECONDS && quarterMileSeconds === undefined) {
    engine.update(SIM_STEP_MS, { throttle: true, brake: false, holdVehicle: false });
    time += SIM_STEP_MS / 1000;

    const gearTop = engine.gearMaxSpeedKph;
    if (gearTop !== undefined && !engine.isShifting
      && engine.gear < profile.gears.length
      && engine.speedKph >= gearTop * (1 - SHIFT_RPM_MARGIN / profile.redlineRpm)) {
      engine.shiftUp();
    }

    if (startTime === undefined && engine.distanceMeters >= ROLLOUT_METERS) {
      startTime = time;
    }
    if (startTime !== undefined && zeroToHundredSeconds === undefined && engine.speedKph >= 100) {
      zeroToHundredSeconds = time - startTime;
    }
    // (the loop ends as soon as the 402 m time is known)
    if (startTime !== undefined && engine.distanceMeters >= QUARTER_MILE_METERS) {
      quarterMileSeconds = time - startTime;
    }
  }

  return { zeroToHundredSeconds, quarterMileSeconds };
}

/**
 * Highest speed where the engine (in any gear, up to the redline) still
 * produces more force than rolling resistance and air drag.
 */
function getTopSpeedKph(profile: CarEngineProfile, powerFactor: number): number {
  let best = 0;
  profile.gears.forEach(({ ratio }) => {
    const totalRatio = ratio * profile.finalDriveRatio;
    for (let speedKph = 1; speedKph < 600; speedKph += 0.5) {
      const speed = speedKph / 3.6;
      const rpm = (speed / profile.wheelRadiusMeters) * totalRatio * (60 / (Math.PI * 2));
      if (rpm > profile.redlineRpm) {
        break;
      }
      const driveForce = (getTorqueAtRpm(profile, rpm) * powerFactor * totalRatio
        * profile.drivetrainEfficiency) / profile.wheelRadiusMeters;
      const resistance = profile.rollingResistanceCoefficient * profile.massKg * 9.81
        + 0.5 * 1.2 * profile.dragAreaM2 * speed ** 2;
      if (driveForce >= resistance) {
        best = Math.max(best, speedKph);
      }
    }
  });
  return best;
}
