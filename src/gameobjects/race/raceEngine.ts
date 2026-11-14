import {
  STARTER_COUPE_PROFILE,
  type CarEngineProfile,
} from '../cars/carProfiles';

export type DrivenAxle = 'front' | 'rear';

const WARMUP_MIN_VALUE = 0;
const WARMUP_MAX_SLIP_SPEED_KPH = 20;
const LIMITER_AVERAGE_TORQUE_FACTOR = 0.35;
const MAX_WHEEL_SLIP_SPEED_KPH = 60;
const GRAVITY_METERS_PER_SECOND_SQUARED = 9.81;
const LIMITER_CYCLE_RADIANS_PER_SECOND = Math.PI * 8;
const MAX_DELTA_SECONDS = 0.1;
const WARMUP_MAX_RISE_PER_SECOND = 100;
const WARMUP_FALL_PER_SECOND = 40;
const WARMUP_RATE_RAMP_SECONDS = 1;
const TORQUE_NM_PER_HP_RPM = 7_127;

export class RaceEngine {
  readonly profile: CarEngineProfile;
  rpm: number;
  gear = 0;
  speedKph = 0;
  wheelSpinSpeedKph = 0;
  tireWarmup = WARMUP_MIN_VALUE;
  private limiterPhase = 0;
  private limiterActive = false;
  private throttleWasPressed = false;
  private throttleRampSeconds = 0;
  private releaseRampSeconds = 0;

  constructor(profile: CarEngineProfile = STARTER_COUPE_PROFILE) {
    this.profile = profile;
    this.rpm = profile.idleRpm;
  }

  get torqueNm(): number {
    return getTorqueAtRpm(this.profile, this.rpm);
  }

  get powerHp(): number {
    return getPowerHpAtRpm(this.profile, this.rpm);
  }

  shiftUp(): void {
    if (this.gear >= this.profile.gears.length) {
      return;
    }

    this.gear += 1;
    this.updateRpmFromSpeed();
    this.limiterActive = false;
  }

  shiftDown(): void {
    if (this.gear <= 0) {
      return;
    }

    if (this.gear === 1) {
      this.gear = 0;
      this.limiterActive = false;
      return;
    }

    const lowerGear = this.profile.gears[this.gear - 2];
    if (this.speedKph > lowerGear.maxSpeedKph) {
      return;
    }

    this.gear -= 1;
    this.updateRpmFromSpeed();
    this.limiterActive = false;
  }

  reset(): void {
    this.rpm = this.profile.idleRpm;
    this.gear = 0;
    this.speedKph = 0;
    this.wheelSpinSpeedKph = 0;
    this.tireWarmup = WARMUP_MIN_VALUE;
    this.limiterPhase = 0;
    this.limiterActive = false;
    this.throttleWasPressed = false;
    this.throttleRampSeconds = 0;
    this.releaseRampSeconds = 0;
  }

  update(deltaMs: number, throttlePressed: boolean, brakePressed = false): void {
    const deltaSeconds = Math.min(deltaMs / 1000, MAX_DELTA_SECONDS);

    if (throttlePressed && !brakePressed) {
      if (!this.throttleWasPressed) {
        this.throttleRampSeconds = 0;
        this.releaseRampSeconds = 0;
      }
      this.throttleWasPressed = true;
      this.throttleRampSeconds = Math.min(
        WARMUP_RATE_RAMP_SECONDS,
        this.throttleRampSeconds + deltaSeconds,
      );

      if (this.gear === 0) {
        this.recoverWheelSpin(deltaSeconds);
        this.speedKph = Math.max(
          0,
          this.speedKph - this.profile.coastDecelerationKphPerSecond * deltaSeconds,
        );
        if (this.limiterActive) {
          this.limiterPhase = (
            this.limiterPhase + LIMITER_CYCLE_RADIANS_PER_SECOND * deltaSeconds
          ) % (Math.PI * 2);
          const limiterRange = this.profile.redlineRpm - this.profile.limiterStartRpm;
          this.rpm = this.profile.limiterStartRpm
            + (limiterRange * (1 + Math.sin(this.limiterPhase))) / 2;
        } else {
          const torqueRatio = this.torqueNm / this.profile.peakTorqueNm;
          this.rpm = Math.min(
            this.profile.redlineRpm,
            this.rpm
              + this.profile.neutralRpmRisePerSecond * torqueRatio * deltaSeconds,
          );
          if (this.rpm >= this.profile.redlineRpm) {
            this.limiterActive = true;
            this.limiterPhase = Math.PI / 2;
            this.rpm = this.profile.redlineRpm;
          }
        }
      } else if (this.limiterActive) {
        const gear = this.profile.gears[this.gear - 1];
        this.updateWheelSpin(deltaSeconds, gear.ratio, LIMITER_AVERAGE_TORQUE_FACTOR);
        this.limiterPhase = (
          this.limiterPhase + LIMITER_CYCLE_RADIANS_PER_SECOND * deltaSeconds
        ) % (Math.PI * 2);
        const limiterRange = this.profile.redlineRpm - this.profile.limiterStartRpm;
        this.rpm = this.profile.limiterStartRpm
          + (limiterRange * (1 + Math.sin(this.limiterPhase))) / 2;
      } else {
        const gear = this.profile.gears[this.gear - 1];
        const torqueRatio = this.torqueNm / this.profile.peakTorqueNm;
        this.updateWheelSpin(deltaSeconds, gear.ratio);
        this.speedKph = Math.min(
          gear.maxSpeedKph,
          this.speedKph + gear.accelerationKphPerSecond * torqueRatio * deltaSeconds,
        );
        this.updateRpmFromSpeed();
        if (this.speedKph >= gear.maxSpeedKph) {
          this.limiterActive = true;
          this.limiterPhase = Math.PI / 2;
          this.rpm = this.profile.redlineRpm;
        }
      }

      if (this.gear > 0 && this.wheelSpinSpeedKph > 0) {
        this.releaseRampSeconds = 0;
        const warmupProgress = this.wheelSpinSpeedKph / WARMUP_MAX_SLIP_SPEED_KPH;
        const progressiveWarmup = Phaser.Math.Clamp(warmupProgress, 0, 1) ** 2;
        this.tireWarmup = Math.min(
          100,
          this.tireWarmup + WARMUP_MAX_RISE_PER_SECOND * progressiveWarmup * deltaSeconds,
        );
      } else {
        const releaseTimeBeforeUpdate = this.releaseRampSeconds;
        this.releaseRampSeconds = Math.min(
          WARMUP_RATE_RAMP_SECONDS,
          this.releaseRampSeconds + deltaSeconds,
        );
        this.coolTires(releaseTimeBeforeUpdate, deltaSeconds);
      }
      return;
    }

    if (this.throttleWasPressed) {
      this.releaseRampSeconds = 0;
      this.throttleWasPressed = false;
    }

    const releaseTimeBeforeUpdate = this.releaseRampSeconds;
    this.releaseRampSeconds = Math.min(
      WARMUP_RATE_RAMP_SECONDS,
      this.releaseRampSeconds + deltaSeconds,
    );

    this.limiterActive = false;
    this.recoverWheelSpin(deltaSeconds);
    this.speedKph = Math.max(
      0,
      this.speedKph - (brakePressed
        ? this.profile.brakeDecelerationKphPerSecond
        : this.profile.coastDecelerationKphPerSecond) * deltaSeconds,
    );
    if (this.gear === 0) {
      this.rpm = Math.max(
        this.profile.idleRpm,
        this.rpm - this.profile.neutralRpmFallPerSecond * deltaSeconds,
      );
    } else {
      this.updateRpmFromSpeed();
    }
    this.coolTires(releaseTimeBeforeUpdate, deltaSeconds);
  }

  private coolTires(previousReleaseTime: number, deltaSeconds: number): void {
    const rampDuration = Math.min(
      deltaSeconds,
      Math.max(0, WARMUP_RATE_RAMP_SECONDS - previousReleaseTime),
    );
    const rampEnd = previousReleaseTime + rampDuration;
    const rampedCoolingSeconds = ((previousReleaseTime + rampEnd) / 2) * rampDuration;
    const fullRateCoolingSeconds = deltaSeconds - rampDuration;
    const effectiveCoolingSeconds = rampedCoolingSeconds + fullRateCoolingSeconds;
    if (effectiveCoolingSeconds <= 0) {
      return;
    }

    this.tireWarmup = Math.max(
      WARMUP_MIN_VALUE,
      this.tireWarmup - WARMUP_FALL_PER_SECOND * effectiveCoolingSeconds,
    );
  }

  private updateWheelSpin(
    deltaSeconds: number,
    gearRatio: number,
    torqueFactor = 1,
  ): void {
    const wheelTorqueNm = this.torqueNm
      * gearRatio
      * this.profile.finalDriveRatio
      * this.profile.drivetrainEfficiency
      * torqueFactor;
    const driveForceNewtons = wheelTorqueNm / this.profile.wheelRadiusMeters;
    const drivenAxleLoadNewtons = this.profile.massKg
      * GRAVITY_METERS_PER_SECOND_SQUARED
      * this.profile.drivenAxleWeightRatio;
    const tractionLimitNewtons = this.profile.tireGripCoefficient * drivenAxleLoadNewtons;
    const excessForceNewtons = driveForceNewtons - tractionLimitNewtons;

    if (excessForceNewtons <= 0) {
      this.recoverWheelSpin(deltaSeconds);
      return;
    }

    const slipAccelerationMetersPerSecondSquared = excessForceNewtons
      / this.profile.effectiveDrivenWheelMassKg;
    const slipAccelerationKphPerSecond = slipAccelerationMetersPerSecondSquared * 3.6;
    this.wheelSpinSpeedKph = Math.min(
      MAX_WHEEL_SLIP_SPEED_KPH,
      this.wheelSpinSpeedKph + slipAccelerationKphPerSecond * deltaSeconds,
    );
  }

  private recoverWheelSpin(deltaSeconds: number): void {
    const drivenAxleLoadNewtons = this.profile.massKg
      * GRAVITY_METERS_PER_SECOND_SQUARED
      * this.profile.drivenAxleWeightRatio;
    const tractionLimitNewtons = this.profile.tireGripCoefficient * drivenAxleLoadNewtons;
    const recoveryKphPerSecond = (
      tractionLimitNewtons / this.profile.effectiveDrivenWheelMassKg
    ) * 3.6;
    this.wheelSpinSpeedKph = Math.max(
      0,
      this.wheelSpinSpeedKph - recoveryKphPerSecond * deltaSeconds,
    );
  }

  private updateRpmFromSpeed(): void {
    if (this.gear === 0) {
      return;
    }

    const gear = this.profile.gears[this.gear - 1];
    this.rpm = Math.max(
      this.profile.idleRpm,
      Math.min(this.profile.redlineRpm, (this.speedKph / gear.maxSpeedKph) * this.profile.redlineRpm),
    );
  }
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
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return from + (to - from) * clampedProgress;
}
