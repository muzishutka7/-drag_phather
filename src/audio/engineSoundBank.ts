/**
 * Recorded petrol 4-cylinder used for every car for now (one shared set;
 * later each car can get its own bank with the same layout).
 *
 * Source recordings: assets-source/audio/. The game files in
 * public/audio/engine/ are cut from them (mono, OGG + M4A):
 * - start-stop:   starter, ~13 s of idle and the engine switching off (garage);
 * - idle-loop:    seamless idle loop;
 * - rpm-loops:    steady loops at several rpm, cut from a recorded free rev
 *                 (~2000 → 4850 → idle), throttle-on and throttle-off sets;
 * The rev limiter is built from the top rpm loops at runtime (SampledEngineSound).
 *
 * Rpm in these tables is measured from the recordings: a 4-cylinder fires
 * twice per crank turn, so the strongest tone is rpm / 30 Hz.
 */
export const ENGINE_SOUND_KEYS = {
  startStop: 'engine-start-stop',
  idleLoop: 'engine-idle-loop',
  rpmLoops: 'engine-rpm-loops',
} as const;

export type EngineSoundKey = (typeof ENGINE_SOUND_KEYS)[keyof typeof ENGINE_SOUND_KEYS];

export function getEngineSoundUrls(key: EngineSoundKey): string[] {
  const base = `${import.meta.env.BASE_URL}audio/engine/${key}`;
  // OGG where supported, AAC (Safari/iOS) otherwise.
  return [`${base}.ogg`, `${base}.m4a`];
}

/** Idle rpm of the recording. */
export const RECORDED_IDLE_RPM = 1200;

/** start-stop: the starter is done and the engine idles from here (s). */
export const START_STOP_START_SECONDS = 1.9;

/**
 * The idle loop file carries 0.1 s of padding on both sides (absorbs encoder
 * delay); loop between these points.
 */
export const IDLE_LOOP = { start: 0.1, end: 6.1 };

export interface EngineRpmLoop {
  /** 'on' = throttle open (rising revs), 'off' = throttle closed (falling revs). */
  layer: 'on' | 'off';
  /** Steady rpm of the loop. */
  rpm: number;
  /** Loop points in the rpm-loops file (s). */
  start: number;
  end: number;
  /** Level that puts the loop on a smooth loudness curve (idle loop = 1). */
  gain: number;
}

/**
 * rpm-loops: short seamless loops cut from the recorded rev, each one
 * re-timed so its pitch is perfectly steady (the recording sweeps the revs;
 * a loop of a sweeping slice would warble). Played continuously and
 * crossfaded by rpm, they give a smooth engine without any grain flutter.
 */
export const ENGINE_RPM_LOOPS: readonly EngineRpmLoop[] = [
  { layer: 'on', rpm: 2386, start: 0.08, end: 0.4723, gain: 1.67 },
  { layer: 'on', rpm: 2981, start: 0.6823, end: 0.8566, gain: 1.23 },
  { layer: 'on', rpm: 3612, start: 1.0666, end: 1.4163, gain: 0.98 },
  { layer: 'on', rpm: 4288, start: 1.6263, end: 1.9747, gain: 0.92 },
  { layer: 'on', rpm: 4844, start: 2.1847, end: 2.6846, gain: 0.91 },
  { layer: 'off', rpm: 4161, start: 2.8946, end: 3.1048, gain: 0.63 },
  { layer: 'off', rpm: 3153, start: 3.3148, end: 3.4899, gain: 0.73 },
  { layer: 'off', rpm: 2318, start: 3.6999, end: 4.084, gain: 1.2 },
  { layer: 'off', rpm: 1524, start: 4.294, end: 4.6443, gain: 1.35 },
  // No loop at idle: the idle loop covers it (two idles together would cancel out).
];

/** Linear interpolation in a table sorted by its first column. */
export function interpolate(table: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (x <= table[0][0]) {
    return table[0][1];
  }
  for (let index = 1; index < table.length; index += 1) {
    const [x1, y1] = table[index];
    if (x <= x1) {
      const [x0, y0] = table[index - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}
