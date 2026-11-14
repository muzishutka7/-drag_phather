import type { RaceEngine } from './raceEngine';

export const RACE_DISTANCES = [402, 804] as const;
export type RaceDistance = (typeof RACE_DISTANCES)[number];

/**
 * choose-distance → burnout (waits for the first pedal touch, then counts 10 → 0)
 * → staging (start lights) → racing → finished
 */
export type RacePhase = 'choose-distance' | 'burnout' | 'staging' | 'racing' | 'finished';

export interface DriverInput {
  throttle: boolean;
  brake: boolean;
}

export interface RaceResult {
  distanceMeters: RaceDistance;
  reactionSeconds: number;
  elapsedSeconds: number;
  trapSpeedKph: number;
  zeroToHundredSeconds: number | undefined;
  gripMultiplier: number;
  tireWarmup: number;
}

export const BURNOUT_COUNTDOWN_SECONDS = 10;
const PRE_STAGE_SECONDS = 1;
const AMBER_LIGHT_SECONDS = 0.5;
export const AMBER_LIGHT_COUNT = 3;
/** The timer starts once the car has rolled this far (like the stage beam). */
const ROLLOUT_METERS = 0.3;

export class RaceSession {
  phase: RacePhase = 'choose-distance';
  distanceMeters: RaceDistance = 402;
  /** Undefined until the driver first touches a pedal in the burnout phase. */
  countdownSeconds: number | undefined;
  /** Number of lit amber lights (0..3) while staging. */
  amberLights = 0;
  greenLight = false;
  /** Seconds since the green light. */
  sinceGreenSeconds = 0;
  /** Seconds since the car crossed the start line (rollout). */
  elapsedSeconds = 0;
  result: RaceResult | undefined;

  private stagingSeconds = 0;
  private reactionSeconds: number | undefined;
  private zeroToHundredSeconds: number | undefined;

  private readonly engine: RaceEngine;

  constructor(engine: RaceEngine) {
    this.engine = engine;
  }

  get remainingMeters(): number {
    return Math.max(0, this.distanceMeters - this.engine.distanceMeters);
  }

  selectDistance(distance: RaceDistance): void {
    this.restart();
    this.distanceMeters = distance;
    this.phase = 'burnout';
  }

  restart(): void {
    this.engine.reset();
    this.phase = 'choose-distance';
    this.countdownSeconds = undefined;
    this.amberLights = 0;
    this.greenLight = false;
    this.sinceGreenSeconds = 0;
    this.elapsedSeconds = 0;
    this.stagingSeconds = 0;
    this.reactionSeconds = undefined;
    this.zeroToHundredSeconds = undefined;
    this.result = undefined;
  }

  update(deltaMs: number, input: DriverInput): void {
    const deltaSeconds = Math.min(deltaMs / 1000, 0.1);

    switch (this.phase) {
      case 'choose-distance':
        this.engine.update(deltaMs, { throttle: false, brake: false, holdVehicle: true });
        return;
      case 'burnout':
        this.updateBurnout(deltaMs, deltaSeconds, input);
        return;
      case 'staging':
        this.updateStaging(deltaMs, deltaSeconds, input);
        return;
      case 'racing':
        this.updateRacing(deltaMs, deltaSeconds, input);
        return;
      case 'finished':
        this.engine.update(deltaMs, { throttle: false, brake: true, holdVehicle: false });
    }
  }

  private updateBurnout(deltaMs: number, deltaSeconds: number, input: DriverInput): void {
    if (this.countdownSeconds === undefined && (input.throttle || input.brake)) {
      this.countdownSeconds = BURNOUT_COUNTDOWN_SECONDS;
    }

    this.engine.update(deltaMs, { throttle: input.throttle, brake: input.brake, holdVehicle: true });

    if (this.countdownSeconds === undefined) {
      return;
    }

    this.countdownSeconds = Math.max(0, this.countdownSeconds - deltaSeconds);
    if (this.countdownSeconds === 0) {
      this.engine.lockTireWarmup();
      this.phase = 'staging';
      this.stagingSeconds = 0;
    }
  }

  private updateStaging(deltaMs: number, deltaSeconds: number, input: DriverInput): void {
    this.engine.update(deltaMs, { throttle: input.throttle, brake: input.brake, holdVehicle: true });
    this.stagingSeconds += deltaSeconds;
    const amberTime = this.stagingSeconds - PRE_STAGE_SECONDS;
    this.amberLights = Math.max(
      0,
      Math.min(AMBER_LIGHT_COUNT, Math.floor(amberTime / AMBER_LIGHT_SECONDS) + 1),
    );

    if (amberTime >= AMBER_LIGHT_SECONDS * AMBER_LIGHT_COUNT) {
      this.greenLight = true;
      this.amberLights = 0;
      this.phase = 'racing';
    }
  }

  private updateRacing(deltaMs: number, deltaSeconds: number, input: DriverInput): void {
    this.engine.update(deltaMs, { throttle: input.throttle, brake: input.brake, holdVehicle: false });
    this.sinceGreenSeconds += deltaSeconds;

    if (this.reactionSeconds === undefined) {
      if (this.engine.distanceMeters < ROLLOUT_METERS) {
        return;
      }
      this.reactionSeconds = this.sinceGreenSeconds;
    }

    this.elapsedSeconds = this.sinceGreenSeconds - this.reactionSeconds;
    if (this.zeroToHundredSeconds === undefined && this.engine.speedKph >= 100) {
      this.zeroToHundredSeconds = this.elapsedSeconds;
    }

    if (this.engine.distanceMeters >= this.distanceMeters) {
      this.phase = 'finished';
      this.result = {
        distanceMeters: this.distanceMeters,
        reactionSeconds: this.reactionSeconds,
        elapsedSeconds: this.elapsedSeconds,
        trapSpeedKph: this.engine.speedKph,
        zeroToHundredSeconds: this.zeroToHundredSeconds,
        gripMultiplier: this.engine.gripMultiplier,
        tireWarmup: this.engine.tireWarmup,
      };
    }
  }
}
