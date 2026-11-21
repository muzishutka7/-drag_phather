export const soundVolumes = ['off', 'low', 'half', 'full'] as const;
export type SoundVolume = (typeof soundVolumes)[number];

/** effects = engine, tires, signals; music = background music. */
export type SoundChannel = 'effects' | 'music';

const VOLUME_GAIN: Record<SoundVolume, number> = {
  off: 0,
  low: 0.3,
  half: 0.5,
  full: 1,
};

const CHANNELS: Record<SoundChannel, { storageKey: string; defaultVolume: SoundVolume }> = {
  // The effects key is the one the old single "sound" setting used.
  effects: { storageKey: 'drag-racing.sound-volume', defaultVolume: 'full' },
  music: { storageKey: 'drag-racing.music-volume', defaultVolume: 'low' },
};

const inMemory = new Map<SoundChannel, SoundVolume>();
const listeners = new Set<(channel: SoundChannel, volume: SoundVolume) => void>();

function isSoundVolume(value: string | null): value is SoundVolume {
  return soundVolumes.some((volume) => volume === value);
}

export function getChannelVolume(channel: SoundChannel): SoundVolume {
  const cached = inMemory.get(channel);
  if (cached) {
    return cached;
  }

  const { storageKey, defaultVolume } = CHANNELS[channel];
  let volume = defaultVolume;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(storageKey);
      volume = isSoundVolume(saved) ? saved : defaultVolume;
    } catch (error) {
      console.warn(`Could not read the ${channel} volume preference.`, error);
    }
  }
  inMemory.set(channel, volume);
  return volume;
}

export function setChannelVolume(channel: SoundChannel, volume: SoundVolume): void {
  inMemory.set(channel, volume);
  listeners.forEach((listener) => listener(channel, volume));

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CHANNELS[channel].storageKey, volume);
  } catch (error) {
    console.warn(`Could not save the ${channel} volume preference.`, error);
  }
}

export function getChannelVolumeGain(channel: SoundChannel): number {
  return VOLUME_GAIN[getChannelVolume(channel)];
}

/** Called after every volume change. Returns a function that unsubscribes. */
export function onChannelVolumeChange(
  listener: (channel: SoundChannel, volume: SoundVolume) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sound effects volume (engine, tires, signals). */
export function getSoundVolumeGain(): number {
  return getChannelVolumeGain('effects');
}
