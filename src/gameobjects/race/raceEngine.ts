import {
  STARTER_COUPE_PROFILE,
  type CarEngineProfile,
  type TireProfile,
} from '../cars/carProfiles';

export type DrivenAxle = 'front' | 'rear';

export interface EngineInput {
  throttle: boolean;
  brake: boolean;
  /**
   * The car is held in place (staging / burnout box): the body cannot move,
   * but the driven wheels can still spin. Brake input is ignored while held.
   */
  holdVehicle: boolean;
}

const GRAVITY = 9.81;
const AIR_DENSITY = 1.2;
const RPM_TO_RAD = (Math.PI * 2) / 60;
const RAD_TO_RPM = 1 / RPM_TO_RAD;
const MPS_TO_KPH = 3.6;
const TORQUE_NM_PER_HP_RPM = 7_127;
/** Physics runs at a fixed step so results do not depend on the frame rate. */
const FIXED_STEP_SECONDS = 1 / 240;
const MAX_FRAME_SECONDS = 0.1;
/** Slip below this (m/s) is treated as rolling without slip. */
const SLIP_EPSILON_MPS = 0.05;
const CLUTCH_SYNC_EPSILON_RAD = 2;

/**
 * Longitudinal drag car model.
 *
 * Engine → clutch → gearbox → driven wheels → tire friction → car body.
 * Wheel spin appears naturally when the force at the contact patch would exceed
 * what the tire can transmit (grip × load × warmup multiplier).
 */
export class RaceEngine {
  readonly profile: CarEngineProfile;
  gear = 0;
  /** Vehicle speed, m/s. */
  velocityMps = 0;
  /** Surface speed of the driven wheels, m/s. */
  wheelSurfaceSpeedMps = 0;
  distanceMeters = 0;
  /** 0..100 */
  tireWarmup = 0;
  /** When set, the warmup no longer changes and grip uses this value. */
  lockedGripMultiplier: number | undefined;
  limiterActive = false;
  /** True while the engine is producing power (throttle on, not cut by the limiter). */
  firing = false;

  private engineSpeedRad: number;
  private clutchLocked = false;
  private shiftTimerSeconds = 0;
  private accumulatorSeconds = 0;

  constructor(profile: CarEngineProfile = STARTER_COUPE_PROFILE) {
    this.profile = profile;
    this.engineSpeedRad = profile.idleRpm * RPM_TO_RAD;
  }

  get rpm(): number {
    return this.engineSpeedRad * RAD_TO_RPM;
  }

  get speedKph(): number {
    return this.velocityMps * MPS_TO_KPH;
  }

  get wheelSpinSpeedKph(): number {
    return Math.max(0, this.wheelSurfaceSpeedMps - this.velocityMps) * MPS_TO_KPH;
  }

  get torqueNm(): number {
    return getTorqueAtRpm(this.profile, this.rpm);
  }

  get powerHp(): number {
    return getPowerHpAtRpm(this.profile, this.rpm);
  }

  get isShifting(): boolean {
    return this.shiftTimerSeconds > 0;
  }

  /** Grip multiplier that the tires give right now. */
  get gripMultiplier(): number {
    return this.lockedGripMultiplier ?? getGripMultiplier(this.profile.tires, this.tireWarmup);
  }

  shiftUp(): void {
    if (this.gear >= this.profile.gears.length) {
      return;
    }

    this.gear += 1;
    this.startShift();
  }

  shiftDown(): void {
    if (this.gear <= 0) {
      return;
    }

    this.gear -= 1;
    this.startShift();
  }

  lockTireWarmup(): number {
    this.lockedGripMultiplier = getGripMultiplier(this.profile.tires, this.tireWarmup);
    return this.lockedGripMultiplier;
  }

  reset(): void {
    this.gear = 0;
    this.velocityMps = 0;
    this.wheelSurfaceSpeedMps = 0;
    this.distanceMeters = 0;
    this.tireWarmup = 0;
    this.lockedGripMultiplier = undefined;
    this.limiterActive = false;
    this.firing = false;
    this.engineSpeedRad = this.profile.idleRpm * RPM_TO_RAD;
    this.clutchLocked = false;
    this.shiftTimerSeconds = 0;
    this.accumulatorSeconds = 0;
  }

  update(deltaMs: number, input: EngineInput): void {
    this.accumulatorSeconds += Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
    while (this.accumulatorSeconds >= FIXED_STEP_SECONDS) {
      this.step(FIXED_STEP_SECONDS, input);
      this.accumulatorSeconds -= FIXED_STEP_SECONDS;
    }
  }

  private startShift(): void {
    this.clutchLocked = false;
    this.shiftTimerSeconds = this.profile.shiftTimeSeconds;
  }

  private step(dt: number, input: EngineInput): void {
    const p = this.profile;
    const idleRad = p.idleRpm * RPM_TO_RAD;
    const radius = p.wheelRadiusMeters;
    this.shiftTimerSeconds = Math.max(0, this.shiftTimerSeconds - dt);

    // --- Engine torque (fuel cut above the redline = real rev limiter) ---
    this.limiterActive = this.rpm >= p.redlineRpm
      || (this.limiterActive && this.rpm > p.redlineRpm - 150);
    const brakingTorque = p.engineBrakeTorqueNm
      + (p.engineBrakeTorquePer1000RpmNm * this.rpm) / 1000;
    this.firing = input.throttle && !this.limiterActive;
    const engineTorque = this.firing
      ? getTorqueAtRpm(p, this.rpm)
      : -brakingTorque;

    // --- Clutch / gearbox ---
    const inGear = this.gear > 0 && !this.isShifting;
    const totalRatio = inGear ? p.gears[this.gear - 1].ratio * p.finalDriveRatio : 0;
    const coupledEngineRad = (this.wheelSurfaceSpeedMps / radius) * totalRatio;

    let clutchTorque = 0;
    if (!inGear) {
      this.clutchLocked = false;
    } else if (this.clutchLocked && coupledEngineRad < idleRad) {
      // Too slow for this gear: the driver presses the clutch instead of stalling.
      this.clutchLocked = false;
    }

    if (inGear && !this.clutchLocked) {
      const engagement = clamp01(
        (this.rpm - p.idleRpm) / (p.clutchFullEngageRpm - p.idleRpm),
      );
      const capacity = p.clutchMaxTorqueNm * Math.max(engagement, 0.15);
      const direction = Math.sign(this.engineSpeedRad - coupledEngineRad);
      clutchTorque = capacity * direction;
      // The engine cannot be dragged below idle by the clutch.
      if (this.engineSpeedRad <= idleRad && engineTorque - clutchTorque < 0) {
        clutchTorque = Math.max(0, engineTorque);
      }
    }

    // --- Tire contact ---
    const tires = p.tires;
    const normalLoad = p.massKg * GRAVITY * p.drivenAxleWeightRatio;
    const staticTraction = tires.baseGripCoefficient * this.gripMultiplier * normalLoad;
    const kineticTraction = staticTraction * tires.kineticGripRatio;
    const resistance = this.getResistanceForce(input);
    const efficiency = p.drivetrainEfficiency;
    const wheelMass = p.drivenWheelEquivalentMassKg;

    let tireForce: number;
    let wheelAcceleration: number;
    let vehicleAcceleration: number;

    if (inGear && this.clutchLocked) {
      // Engine and wheels rotate together.
      const engineMassAtWheel = p.engineInertiaKgM2 * (totalRatio / radius) ** 2;
      const driveForce = (engineTorque * totalRatio * efficiency) / radius;
      const result = this.solveTire(
        driveForce,
        wheelMass + engineMassAtWheel,
        resistance,
        staticTraction,
        kineticTraction,
        input.holdVehicle,
      );
      tireForce = result.tireForce;
      wheelAcceleration = result.wheelAcceleration;
      vehicleAcceleration = result.vehicleAcceleration;
    } else {
      const driveForce = (clutchTorque * totalRatio * efficiency) / radius;
      const result = this.solveTire(
        driveForce,
        wheelMass,
        resistance,
        staticTraction,
        kineticTraction,
        input.holdVehicle,
      );
      tireForce = result.tireForce;
      wheelAcceleration = result.wheelAcceleration;
      vehicleAcceleration = result.vehicleAcceleration;

      const previousEngineRad = this.engineSpeedRad;
      this.engineSpeedRad += ((engineTorque - clutchTorque) / p.engineInertiaKgM2) * dt;
      if (inGear) {
        const nextCoupled = ((this.wheelSurfaceSpeedMps + wheelAcceleration * dt) / radius)
          * totalRatio;
        const crossed = Math.sign(previousEngineRad - coupledEngineRad)
          !== Math.sign(this.engineSpeedRad - nextCoupled);
        if ((crossed || Math.abs(this.engineSpeedRad - nextCoupled) < CLUTCH_SYNC_EPSILON_RAD)
          && nextCoupled >= idleRad) {
          this.clutchLocked = true;
        }
      }
    }

    // --- Integrate ---
    const slipBefore = this.wheelSurfaceSpeedMps - this.velocityMps;
    this.velocityMps = input.holdVehicle
      ? 0
      : Math.max(0, this.velocityMps + vehicleAcceleration * dt);
    this.wheelSurfaceSpeedMps = Math.max(0, this.wheelSurfaceSpeedMps + wheelAcceleration * dt);
    const slipAfter = this.wheelSurfaceSpeedMps - this.velocityMps;

    // The tire regained grip during this step (slip crossed zero): roll together.
    const slipCrossedZero = Math.abs(slipBefore) >= SLIP_EPSILON_MPS
      && Math.sign(slipBefore) !== Math.sign(slipAfter);
    if (slipCrossedZero
      || (Math.abs(slipAfter) < SLIP_EPSILON_MPS && Math.abs(tireForce) < staticTraction)) {
      this.wheelSurfaceSpeedMps = this.velocityMps;
    }

    if (inGear && this.clutchLocked) {
      this.engineSpeedRad = (this.wheelSurfaceSpeedMps / radius) * totalRatio;
    }
    this.engineSpeedRad = Math.max(idleRad, this.engineSpeedRad);

    this.distanceMeters += this.velocityMps * dt;
    this.updateTireWarmup(dt, tires);
  }

  /**
   * Splits the drive force between the wheel and the car body.
   * Returns the force transmitted by the tire and both accelerations.
   */
  private solveTire(
    driveForce: number,
    wheelSideMass: number,
    resistance: number,
    staticTraction: number,
    kineticTraction: number,
    holdVehicle: boolean,
  ): { tireForce: number; wheelAcceleration: number; vehicleAcceleration: number } {
    const slip = this.wheelSurfaceSpeedMps - this.velocityMps;
    const bodyMass = this.profile.massKg;

    if (Math.abs(slip) < SLIP_EPSILON_MPS && !holdVehicle) {
      // Try rolling without slip: wheel and body accelerate together.
      const commonAcceleration = (driveForce - resistance) / (bodyMass + wheelSideMass);
      const requiredTireForce = driveForce - wheelSideMass * commonAcceleration;
      if (Math.abs(requiredTireForce) <= staticTraction) {
        return {
          tireForce: requiredTireForce,
          wheelAcceleration: commonAcceleration,
          vehicleAcceleration: commonAcceleration,
        };
      }
    }

    if (Math.abs(slip) < SLIP_EPSILON_MPS && holdVehicle && Math.abs(driveForce) <= staticTraction) {
      // Held car and the tire still grips: nothing moves.
      return { tireForce: driveForce, wheelAcceleration: 0, vehicleAcceleration: 0 };
    }

    // Wheel slips: the tire transmits kinetic friction against the slip direction.
    const slipDirection = slip !== 0 ? Math.sign(slip) : Math.sign(driveForce);
    const tireForce = kineticTraction * slipDirection;
    return {
      tireForce,
      wheelAcceleration: (driveForce - tireForce) / wheelSideMass,
      vehicleAcceleration: (tireForce - resistance) / bodyMass,
    };
  }

  private getResistanceForce(input: EngineInput): number {
    const p = this.profile;
    if (this.velocityMps <= 0) {
      return 0;
    }

    const rolling = p.rollingResistanceCoefficient * p.massKg * GRAVITY;
    const aero = 0.5 * AIR_DENSITY * p.dragAreaM2 * this.velocityMps ** 2;
    const brake = input.brake && !input.holdVehicle ? p.brakeDecelerationMps2 * p.massKg : 0;
    return rolling + aero + brake;
  }

  private updateTireWarmup(dt: number, tires: TireProfile): void {
    if (this.lockedGripMultiplier !== undefined) {
      return;
    }

    const slipKph = Math.min(this.wheelSpinSpeedKph, tires.maxHeatingSlipKph);
    if (slipKph > 0.5) {
      this.tireWarmup = Math.min(
        100,
        this.tireWarmup + tires.warmupPerSlipKphPerSecond * slipKph * dt,
      );
    } else {
      this.tireWarmup = Math.max(
        0,
        this.tireWarmup - this.tireWarmup * tires.coolingRatePerSecond * dt,
      );
    }
  }
}

export function getGripMultiplier(tires: TireProfile, warmup: number): number {
  const curve = tires.warmupGripCurve;
  if (warmup <= curve[0].warmup) {
    return curve[0].gripMultiplier;
  }

  for (let index = 1; index < curve.length; index += 1) {
    const upper = curve[index];
    if (warmup <= upper.warmup) {
      const lower = curve[index - 1];
      const progress = (warmup - lower.warmup) / (upper.warmup - lower.warmup);
      return interpolate(lower.gripMultiplier, upper.gripMultiplier, progress);
    }
  }

  return curve[curve.length - 1].gripMultiplier;
}

export function getTopSpeedKph(profile: CarEngineProfile): number {
  const topGear = profile.gears[profile.gears.length - 1];
  const wheelRad = (profile.redlineRpm * RPM_TO_RAD) / (topGear.ratio * profile.finalDriveRatio);
  return wheelRad * profile.wheelRadiusMeters * MPS_TO_KPH;
}

export function getTorqueAtRpm(profile: CarEngineProfile, rpm: number): number {
  const curve = profile.torqueCurve;
  const boundedRpm = Math.max(curve[0].rpm, Math.min(curve[curve.length - 1].rpm, rpm));

  for (let index = 1; index < curve.length; index += 1) {
    const upperPoint = curve[index];
    if (boundedRpm <= upperPoint.rpm) {
      const lowerPoint = curve[index - 1];
      const progress = (boundedRpm - lowerPoint.rpm) / (upperPoint.rpm - lowerPoint.rpm);
      return interpolate(lowerPoint.torqueNm, upperPoint.torqueNm, progress);
    }
  }

  return curve[curve.length - 1].torqueNm;
}

export function getPowerHpAtRpm(profile: CarEngineProfile, rpm: number): number {
  const boundedRpm = Math.max(profile.idleRpm, Math.min(profile.redlineRpm, rpm));
  return (getTorqueAtRpm(profile, boundedRpm) * boundedRpm) / TORQUE_NM_PER_HP_RPM;
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp01(progress);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
