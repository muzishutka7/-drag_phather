import Phaser from 'phaser';
import { getSoundVolumeGain } from '../settings/soundVolume';

/**
 * All race sounds are synthesized with the Web Audio API at runtime,
 * so there are no audio files to load or license.
 *
 * Engine model: a 4-cylinder 4-stroke fires twice per crank revolution,
 * so the base tone is rpm / 60 * 2 Hz (900 rpm → 30 Hz, 6000 rpm → 200 Hz).
 * Throttle load makes the sound louder, brighter and more distorted.
 */

export interface EngineSoundState {
  rpm: number;
  idleRpm: number;
  redlineRpm: number;
  /** Engine is producing power (throttle on and not cut by the limiter). */
  firing: boolean;
  wheelSpinKph: number;
  speedKph: number;
}

const MASTER_VOLUME = 0.55;
/** Engine level relative to the tires and signals. */
const ENGINE_VOLUME = 0.8;
const SMOOTHING_SECONDS = 0.025;
const CYLINDERS = 4;

let sharedContext: AudioContext | undefined;
let sharedNoise: AudioBuffer | undefined;

function getContext(scene: Phaser.Scene): AudioContext | undefined {
  const manager = scene.sound;
  if (manager instanceof Phaser.Sound.WebAudioSoundManager) {
    return manager.context;
  }

  if (!sharedContext && typeof window !== 'undefined' && 'AudioContext' in window) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (sharedNoise && sharedNoise.sampleRate === context.sampleRate) {
    return sharedNoise;
  }

  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  sharedNoise = buffer;
  return buffer;
}

function createDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

export class RaceAudio {
  private readonly context: AudioContext | undefined;
  private readonly master?: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];

  // Engine
  private engineOscillators: Array<{ osc: OscillatorNode; multiplier: number }> = [];
  private cleanGain?: GainNode;
  private dirtyGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private engineGain?: GainNode;
  private intakeFilter?: BiquadFilterNode;
  private intakeGain?: GainNode;

  // Tires and wind
  private squealFilterLow?: BiquadFilterNode;
  private squealFilterHigh?: BiquadFilterNode;
  private squealGain?: GainNode;
  private squealTone?: OscillatorNode;
  private squealToneGain?: GainNode;
  private smokeGain?: GainNode;
  private windGain?: GainNode;

  private smoothedLoad = 0;
  private readonly unlock = (): void => {
    if (this.context?.state === 'suspended') {
      void this.context.resume();
    }
  };

  constructor(scene: Phaser.Scene) {
    this.context = getContext(scene);
    if (!this.context) {
      return;
    }

    const context = this.context;
    this.master = this.track(context.createGain());
    this.master.gain.value = MASTER_VOLUME * getSoundVolumeGain();
    const compressor = this.track(context.createDynamicsCompressor());
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    this.master.connect(compressor).connect(context.destination);

    this.buildEngine(context);
    this.buildTires(context);
    this.buildWind(context);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.unlock);
    scene.input.keyboard?.on('keydown', this.unlock);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.unlock);
      scene.input.keyboard?.off('keydown', this.unlock);
    });
  }

  /** Call every frame. */
  update(state: EngineSoundState): void {
    const context = this.context;
    if (!context || !this.master) {
      return;
    }

    const now = context.currentTime;
    const set = (param: AudioParam, value: number, smoothing = SMOOTHING_SECONDS): void => {
      param.setTargetAtTime(value, now, smoothing);
    };

    set(this.master.gain, MASTER_VOLUME * getSoundVolumeGain(), 0.05);

    // --- Engine ---
    const firingHz = (Math.max(state.rpm, 300) / 60) * (CYLINDERS / 2);
    const rpmProgress = Phaser.Math.Clamp(
      (state.rpm - state.idleRpm) / (state.redlineRpm - state.idleRpm),
      0,
      1,
    );
    // Fast attack when the throttle opens, slightly slower release.
    const targetLoad = state.firing ? 1 : 0;
    this.smoothedLoad += (targetLoad - this.smoothedLoad) * (targetLoad > this.smoothedLoad ? 0.5 : 0.25);
    const load = this.smoothedLoad;

    this.engineOscillators.forEach(({ osc, multiplier }) => {
      set(osc.frequency, firingHz * multiplier, 0.012);
    });
    if (this.cleanGain && this.dirtyGain && this.engineFilter && this.engineGain) {
      set(this.cleanGain.gain, 1 - load * 0.7);
      set(this.dirtyGain.gain, 0.15 + load * 0.75);
      set(this.engineFilter.frequency, 260 + firingHz * 5 + load * (900 + rpmProgress * 1800));
      set(this.engineGain.gain, (0.22 + rpmProgress * 0.18 + load * 0.28) * ENGINE_VOLUME);
    }
    if (this.intakeFilter && this.intakeGain) {
      set(this.intakeFilter.frequency, 500 + firingHz * 9);
      set(this.intakeGain.gain, (0.02 + load * 0.12) * (0.3 + rpmProgress) * ENGINE_VOLUME);
    }

    // --- Tires ---
    const slip = Phaser.Math.Clamp((state.wheelSpinKph - 2) / 25, 0, 1);
    if (this.squealGain && this.squealFilterLow && this.squealFilterHigh) {
      set(this.squealGain.gain, slip * 0.55, 0.04);
      set(this.squealFilterLow.frequency, 1150 + state.wheelSpinKph * 6, 0.05);
      set(this.squealFilterHigh.frequency, 2300 + state.wheelSpinKph * 10, 0.05);
    }
    if (this.squealTone && this.squealToneGain) {
      set(this.squealTone.frequency, 980 + state.wheelSpinKph * 4, 0.05);
      set(this.squealToneGain.gain, slip * 0.05, 0.04);
    }
    if (this.smokeGain) {
      set(this.smokeGain.gain, slip * 0.25, 0.08);
    }

    // --- Wind ---
    if (this.windGain) {
      const windProgress = Phaser.Math.Clamp(state.speedKph / 180, 0, 1);
      set(this.windGain.gain, windProgress * windProgress * 0.22, 0.1);
    }
  }

  /** Short countdown tick. The last seconds are higher pitched. */
  playCountdownTick(secondsLeft: number): void {
    const urgent = secondsLeft <= 3;
    this.beep(urgent ? 1320 : 880, urgent ? 0.14 : 0.08, 'square', urgent ? 0.22 : 0.14);
  }

  playGripLocked(): void {
    this.beep(660, 0.09, 'triangle', 0.25);
    this.beep(990, 0.16, 'triangle', 0.25, 0.1);
  }

  playAmberLight(): void {
    this.beep(740, 0.16, 'square', 0.18);
  }

  playGreenLight(): void {
    this.beep(1480, 0.55, 'square', 0.22);
  }

  playGearShift(): void {
    const context = this.context;
    if (!context || !this.master) {
      return;
    }

    // Mechanical clunk: a short low-passed noise burst plus a tiny thump.
    const now = context.currentTime;
    const noise = context.createBufferSource();
    noise.buffer = getNoiseBuffer(context);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(now, Math.random());
    noise.stop(now + 0.1);
    this.beep(90, 0.06, 'sine', 0.3);
  }

  playFinish(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const last = index === notes.length - 1;
      this.beep(frequency, last ? 0.6 : 0.13, 'triangle', 0.3, index * 0.12);
    });
  }

  destroy(): void {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    });
    this.nodes.forEach((node) => node.disconnect());
    this.sources.length = 0;
    this.nodes.length = 0;
  }

  private beep(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    const context = this.context;
    if (!context || !this.master) {
      return;
    }

    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.setValueAtTime(volume, start + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private buildEngine(context: AudioContext): void {
    if (!this.master) {
      return;
    }

    // Rich harmonic wave for the firing pulses.
    const harmonics = 40;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    for (let n = 1; n < harmonics; n += 1) {
      imag[n] = (n % 2 === 1 ? 1 : 0.55) / n ** 0.85;
    }
    const pulseWave = context.createPeriodicWave(real, imag);

    const mix = this.track(context.createGain());
    // [frequency multiplier of the firing rate, gain]
    // 0.5 = crank order (gives the uneven 8-valve "burble"), 1 = firing, 2 = upper harmonic.
    const voices: Array<[number, number, OscillatorType | 'pulse']> = [
      [0.5, 0.35, 'sawtooth'],
      [1, 0.7, 'pulse'],
      [2, 0.14, 'triangle'],
      [1.003, 0.25, 'pulse'],
    ];
    // Slow random-ish wobble = rough idle.
    const wobble = this.track(context.createOscillator());
    wobble.frequency.value = 6.5;
    const wobbleDepth = this.track(context.createGain());
    wobbleDepth.gain.value = 18;
    wobble.connect(wobbleDepth);
    this.startSource(wobble);

    voices.forEach(([multiplier, level, type]) => {
      const osc = this.track(context.createOscillator());
      if (type === 'pulse') {
        osc.setPeriodicWave(pulseWave);
      } else {
        osc.type = type;
      }
      osc.frequency.value = 30 * multiplier;
      wobbleDepth.connect(osc.detune);
      const gain = this.track(context.createGain());
      gain.gain.value = level;
      osc.connect(gain).connect(mix);
      this.startSource(osc);
      this.engineOscillators.push({ osc, multiplier });
    });

    this.cleanGain = this.track(context.createGain());
    this.dirtyGain = this.track(context.createGain());
    const shaper = this.track(context.createWaveShaper());
    shaper.curve = createDistortionCurve(6);
    shaper.oversample = '2x';
    this.engineFilter = this.track(context.createBiquadFilter());
    this.engineFilter.type = 'lowpass';
    this.engineFilter.Q.value = 2.5;
    this.engineGain = this.track(context.createGain());
    this.engineGain.gain.value = 0;

    mix.connect(this.cleanGain).connect(this.engineFilter);
    mix.connect(shaper).connect(this.dirtyGain).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);

    // Intake / exhaust hiss that follows the rpm.
    const intakeNoise = this.createNoiseSource(context);
    this.intakeFilter = this.track(context.createBiquadFilter());
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.Q.value = 1.2;
    this.intakeGain = this.track(context.createGain());
    this.intakeGain.gain.value = 0;
    intakeNoise.connect(this.intakeFilter).connect(this.intakeGain).connect(this.master);
  }

  private buildTires(context: AudioContext): void {
    if (!this.master) {
      return;
    }

    // Squeal: noise through two resonant band-pass filters.
    const squealNoise = this.createNoiseSource(context);
    this.squealFilterLow = this.track(context.createBiquadFilter());
    this.squealFilterLow.type = 'bandpass';
    this.squealFilterLow.Q.value = 9;
    this.squealFilterHigh = this.track(context.createBiquadFilter());
    this.squealFilterHigh.type = 'bandpass';
    this.squealFilterHigh.Q.value = 14;
    this.squealGain = this.track(context.createGain());
    this.squealGain.gain.value = 0;
    squealNoise.connect(this.squealFilterLow).connect(this.squealGain);
    squealNoise.connect(this.squealFilterHigh).connect(this.squealGain);
    this.squealGain.connect(this.master);

    // A wavering tone on top makes the squeal sound "rubbery".
    this.squealTone = this.track(context.createOscillator());
    this.squealTone.type = 'sine';
    const vibrato = this.track(context.createOscillator());
    vibrato.frequency.value = 11;
    const vibratoDepth = this.track(context.createGain());
    vibratoDepth.gain.value = 45;
    vibrato.connect(vibratoDepth).connect(this.squealTone.detune);
    this.squealToneGain = this.track(context.createGain());
    this.squealToneGain.gain.value = 0;
    this.squealTone.connect(this.squealToneGain).connect(this.master);
    this.startSource(vibrato);
    this.startSource(this.squealTone);

    // Low rumble of the burnout smoke / tread scrubbing.
    const smokeNoise = this.createNoiseSource(context);
    const smokeFilter = this.track(context.createBiquadFilter());
    smokeFilter.type = 'lowpass';
    smokeFilter.frequency.value = 380;
    this.smokeGain = this.track(context.createGain());
    this.smokeGain.gain.value = 0;
    smokeNoise.connect(smokeFilter).connect(this.smokeGain).connect(this.master);
  }

  private buildWind(context: AudioContext): void {
    if (!this.master) {
      return;
    }

    const windNoise = this.createNoiseSource(context);
    const windFilter = this.track(context.createBiquadFilter());
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 700;
    this.windGain = this.track(context.createGain());
    this.windGain.gain.value = 0;
    windNoise.connect(windFilter).connect(this.windGain).connect(this.master);
  }

  private createNoiseSource(context: AudioContext): AudioBufferSourceNode {
    const source = this.track(context.createBufferSource());
    source.buffer = getNoiseBuffer(context);
    source.loop = true;
    source.start(0, Math.random() * 2);
    this.sources.push(source);
    return source;
  }

  private startSource(source: AudioScheduledSourceNode): void {
    source.start();
    this.sources.push(source);
  }

  private track<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
}
