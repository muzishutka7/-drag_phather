import Phaser from 'phaser';
import {
  ENGINE_RPM_LOOPS,
  IDLE_LOOP,
  RECORDED_IDLE_RPM,
  START_STOP_START_SECONDS,
  type EngineRpmLoop,
} from './engineSoundBank';

export interface EngineSampleBuffers {
  startStop: AudioBuffer;
  idleLoop: AudioBuffer;
  rpmLoops: AudioBuffer;
}

export interface SampledEngineState {
  rpm: number;
  idleRpm: number;
  redlineRpm: number;
  /** Throttle open and the engine producing power. */
  firing: boolean;
  /** Bouncing off the rev limiter. */
  limiter: boolean;
}

/** Game redline sounds like this rpm of the recording (a little above its top, pitched up). */
const REDLINE_SOUND_RPM = 5600;
/** Pitch shift limits of a loop (beyond them it starts to sound artificial). */
const MIN_RATE = 0.6;
const MAX_RATE = 1.5;

const IDLE_LEVEL = 1;
/**
 * Rev limiter, made from the loops themselves: the ignition is cut and
 * restored many times a second, so the top throttle-on loop is chopped
 * (and the revs dip a little on every cut) while the top throttle-off loop
 * fills the gaps.
 */
const LIMITER_LEVEL = 1;
/** Cuts per second (randomised a little so it does not sound mechanical). */
const LIMITER_RATE_HZ = 13;
const LIMITER_RATE_JITTER_HZ = 2.5;
/** Throttle-on loop level: 1 − depth in a cut, 1 at full burn. */
const LIMITER_CHOP_DEPTH = 0.8;
/** Revs fall this much during a cut (share of the rpm). */
const LIMITER_RPM_DIP = 0.025;
/** Hardness of the on/off edges (higher = more square). */
const LIMITER_EDGE = 4;
/** Idle loop below this sound-rpm, rpm loops above the next one, blended between. */
const IDLE_FULL_RPM = 1300;
const IDLE_GONE_RPM = 1700;
/** Starter recording → idle loop hand-over (equal-power crossfade). */
const HANDOVER_SECONDS = 0.4;

/** Part of the gap between two neighbouring loops where they crossfade. */
const CROSSFADE_FROM = 0.3;
const CROSSFADE_TO = 0.7;
/** Smoothing time constants (s). Rpm follows fast; the throttle blend a bit slower. */
const RPM_SMOOTHING = 0.02;
const LEVEL_SMOOTHING = 0.05;
const LOAD_ATTACK = 0.35;
const LOAD_RELEASE = 0.12;

/** Quarter sine/cosine: two such fades keep the total power constant. */
function createEqualPowerCurve(points: number, rising: boolean, scale = 1): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  for (let index = 0; index < points; index += 1) {
    const phase = (index / (points - 1)) * (Math.PI / 2);
    curve[index] = (rising ? Math.sin(phase) : Math.cos(phase)) * scale;
  }
  return curve;
}

interface LoopVoice {
  loop: EngineRpmLoop;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Engine sound made of real recordings, the way racing games usually do it:
 * a set of steady loops recorded at different rpm plays continuously; the
 * two loops nearest to the current rpm are crossfaded (equal power) and
 * pitched to the exact rpm. A throttle-on set and a throttle-off set are
 * blended by the throttle. Near idle a separate idle loop takes over, and a
 * rev limiter chops the top loops (see LIMITER_RATE_HZ).
 */
export class SampledEngineSound {
  private readonly context: AudioContext;
  private readonly buffers: EngineSampleBuffers;
  private readonly output: GainNode;
  private readonly idleGain: GainNode;
  private readonly limiterGain: GainNode;
  private readonly limiterOn: AudioBufferSourceNode;
  private readonly limiterOff: AudioBufferSourceNode;
  private readonly limiterOnRate: number;
  private readonly limiterOffRate: number;
  private readonly limiterLfo: OscillatorNode;
  private readonly idleSource: AudioBufferSourceNode;
  private readonly voices: LoopVoice[] = [];
  private starter?: AudioBufferSourceNode;
  /** No rpm-driven sound until the starter has finished. */
  private runningFrom = 0;
  private load = 0;
  /** Smoothed limiter blend: the limiter state flickers as the revs bounce. */
  private limiterBlend = 0;

  constructor(context: AudioContext, destination: AudioNode, buffers: EngineSampleBuffers) {
    this.context = context;
    this.buffers = buffers;
    this.output = context.createGain();
    this.output.connect(destination);

    this.idleGain = context.createGain();
    this.idleGain.gain.value = 0;
    this.idleGain.connect(this.output);
    this.idleSource = this.createLoop(buffers.idleLoop, IDLE_LOOP, this.idleGain);

    // --- Rev limiter: the top loops, chopped by a soft square wave ---
    this.limiterGain = context.createGain();
    this.limiterGain.gain.value = 0;
    this.limiterGain.connect(this.output);
    const topOn = ENGINE_RPM_LOOPS.filter((loop) => loop.layer === 'on')
      .reduce((top, loop) => (loop.rpm > top.rpm ? loop : top));
    const topOff = ENGINE_RPM_LOOPS.filter((loop) => loop.layer === 'off')
      .reduce((top, loop) => (loop.rpm > top.rpm ? loop : top));
    this.limiterOnRate = REDLINE_SOUND_RPM / topOn.rpm;
    this.limiterOffRate = REDLINE_SOUND_RPM / topOff.rpm;

    // LFO: sine → tanh-like shaper = rounded square, +1 burn / −1 cut.
    this.limiterLfo = context.createOscillator();
    this.limiterLfo.frequency.value = LIMITER_RATE_HZ;
    const shaper = context.createWaveShaper();
    const curve = new Float32Array(256);
    for (let index = 0; index < curve.length; index += 1) {
      const x = (index / (curve.length - 1)) * 2 - 1;
      // a little longer burn than cut
      curve[index] = Math.tanh((x + 0.15) * LIMITER_EDGE) / Math.tanh(LIMITER_EDGE);
    }
    shaper.curve = curve;
    this.limiterLfo.connect(shaper);

    const onGain = context.createGain();
    onGain.gain.value = topOn.gain * (1 - LIMITER_CHOP_DEPTH / 2);
    const onDepth = context.createGain();
    onDepth.gain.value = topOn.gain * (LIMITER_CHOP_DEPTH / 2);
    shaper.connect(onDepth).connect(onGain.gain);
    onGain.connect(this.limiterGain);
    this.limiterOn = this.createLoop(buffers.rpmLoops, topOn, onGain);
    this.limiterOn.playbackRate.value = this.limiterOnRate;
    // revs dip on every cut
    const onPitch = context.createGain();
    onPitch.gain.value = this.limiterOnRate * LIMITER_RPM_DIP / 2;
    shaper.connect(onPitch).connect(this.limiterOn.playbackRate);

    const offGain = context.createGain();
    offGain.gain.value = topOff.gain * 0.35;
    const offDepth = context.createGain();
    offDepth.gain.value = -topOff.gain * 0.35;
    shaper.connect(offDepth).connect(offGain.gain);
    offGain.connect(this.limiterGain);
    this.limiterOff = this.createLoop(buffers.rpmLoops, topOff, offGain);
    this.limiterOff.playbackRate.value = this.limiterOffRate * (1 - LIMITER_RPM_DIP);
    this.limiterLfo.start();

    ENGINE_RPM_LOOPS.forEach((loop) => {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(this.output);
      const source = this.createLoop(buffers.rpmLoops, loop, gain);
      this.voices.push({ loop, source, gain });
    });
  }

  /** Cranks the engine: starter sound, then it settles into idle. */
  start(): void {
    const now = this.context.currentTime;
    const handoverStart = now + START_STOP_START_SECONDS;

    const starterGain = this.context.createGain();
    starterGain.gain.value = IDLE_LEVEL;
    starterGain.gain.setValueCurveAtTime(
      createEqualPowerCurve(32, false, IDLE_LEVEL),
      handoverStart,
      HANDOVER_SECONDS,
    );
    starterGain.connect(this.output);
    const starter = this.context.createBufferSource();
    starter.buffer = this.buffers.startStop;
    starter.connect(starterGain);
    starter.start(now, 0, START_STOP_START_SECONDS + HANDOVER_SECONDS + 0.05);
    starter.onended = () => starterGain.disconnect();
    this.starter = starter;

    this.idleGain.gain.setValueCurveAtTime(
      createEqualPowerCurve(32, true, IDLE_LEVEL),
      handoverStart,
      HANDOVER_SECONDS,
    );
    this.runningFrom = handoverStart + HANDOVER_SECONDS;
  }

  /** Call every frame. */
  update(state: SampledEngineState): void {
    const now = this.context.currentTime;
    if (now < this.runningFrom) {
      return;
    }

    const set = (param: AudioParam, value: number, smoothing: number): void => {
      param.setTargetAtTime(value, now, smoothing);
    };

    // Game rpm → rpm of the recording: idle sounds like the recorded idle,
    // redline a little above the top of the recordings.
    const span = Math.max(1, state.redlineRpm - state.idleRpm);
    const soundRpm = state.rpm <= state.idleRpm
      ? RECORDED_IDLE_RPM * Math.max(0.5, state.rpm / state.idleRpm)
      : RECORDED_IDLE_RPM + ((state.rpm - state.idleRpm) * (REDLINE_SOUND_RPM - RECORDED_IDLE_RPM)) / span;

    // Throttle blend: opens quickly, closes a little slower (no flutter on shifts).
    const targetLoad = state.firing || state.limiter ? 1 : 0;
    this.load += (targetLoad - this.load) * (targetLoad > this.load ? LOAD_ATTACK : LOAD_RELEASE);

    const idleWeight = 1 - Phaser.Math.SmoothStep(soundRpm, IDLE_FULL_RPM, IDLE_GONE_RPM);
    const targetLimiter = state.limiter ? 1 : 0;
    this.limiterBlend += (targetLimiter - this.limiterBlend) * (targetLimiter > this.limiterBlend ? 0.35 : 0.25);
    const limiterWeight = this.limiterBlend;
    const loopsWeight = (1 - idleWeight) * (1 - limiterWeight);

    set(this.idleSource.playbackRate, Phaser.Math.Clamp(soundRpm / RECORDED_IDLE_RPM, 0.7, 1.5), RPM_SMOOTHING);
    set(this.idleGain.gain, idleWeight * IDLE_LEVEL * (1 + this.load * 0.25), LEVEL_SMOOTHING);
    set(this.limiterGain.gain, limiterWeight * LIMITER_LEVEL, LEVEL_SMOOTHING);
    if (limiterWeight > 0.01) {
      set(
        this.limiterLfo.frequency,
        LIMITER_RATE_HZ + (Math.random() * 2 - 1) * LIMITER_RATE_JITTER_HZ,
        0.08,
      );
    }

    const onWeights = this.layerWeights('on', soundRpm);
    const offWeights = this.layerWeights('off', soundRpm);
    this.voices.forEach((voice, index) => {
      // A low throttle-off loop can also stand in for the throttle-on set.
      const layerWeight = Math.sqrt(this.load) * (onWeights.get(index) ?? 0)
        + Math.sqrt(1 - this.load) * (offWeights.get(index) ?? 0);
      set(voice.gain.gain, layerWeight * voice.loop.gain * loopsWeight, LEVEL_SMOOTHING);
      set(
        voice.source.playbackRate,
        Phaser.Math.Clamp(soundRpm / voice.loop.rpm, MIN_RATE, MAX_RATE),
        RPM_SMOOTHING,
      );
    });
  }

  destroy(): void {
    const stop = (source?: AudioBufferSourceNode): void => {
      try {
        source?.stop();
      } catch {
        // Already stopped.
      }
    };
    stop(this.starter);
    stop(this.idleSource);
    stop(this.limiterOn);
    stop(this.limiterOff);
    try {
      this.limiterLfo.stop();
    } catch {
      // Already stopped.
    }
    this.voices.forEach((voice) => stop(voice.source));
    this.output.disconnect();
  }

  /**
   * Equal-power weights of the two loops around the rpm. The throttle-on set
   * has no loops below ~2400 rpm, so it borrows the low throttle-off loops.
   */
  private layerWeights(layer: 'on' | 'off', rpm: number): Map<number, number> {
    const candidates = this.voices
      .map((voice, index) => ({ voice, index }))
      .filter(({ voice }) => voice.loop.layer === layer || (layer === 'on' && voice.loop.rpm < 2000))
      .sort((a, b) => a.voice.loop.rpm - b.voice.loop.rpm);
    const weights = new Map<number, number>();
    const first = candidates[0];
    const last = candidates[candidates.length - 1];
    if (rpm <= first.voice.loop.rpm) {
      weights.set(first.index, 1);
      return weights;
    }
    if (rpm >= last.voice.loop.rpm) {
      weights.set(last.index, 1);
      return weights;
    }
    for (let position = 1; position < candidates.length; position += 1) {
      const upper = candidates[position];
      if (rpm <= upper.voice.loop.rpm) {
        const lower = candidates[position - 1];
        // Crossfade only in the middle of the gap: two loops at similar levels
        // drift in phase and beat, so most of the range uses one loop, pitched.
        const t = Phaser.Math.SmoothStep(
          (rpm - lower.voice.loop.rpm) / (upper.voice.loop.rpm - lower.voice.loop.rpm),
          CROSSFADE_FROM,
          CROSSFADE_TO,
        );
        weights.set(lower.index, Math.cos((t * Math.PI) / 2));
        weights.set(upper.index, Math.sin((t * Math.PI) / 2));
        break;
      }
    }
    return weights;
  }

  private createLoop(
    buffer: AudioBuffer,
    loop: { start: number; end: number },
    destination: AudioNode,
  ): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = loop.start;
    source.loopEnd = Math.min(loop.end, buffer.duration);
    source.connect(destination);
    // Random start inside the loop, so loops of the same length never beat in sync.
    source.start(0, loop.start + Math.random() * (source.loopEnd - loop.start));
    return source;
  }
}
