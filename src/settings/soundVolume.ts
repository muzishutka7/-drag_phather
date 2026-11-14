export const soundVolumes = ['off', 'half', 'full'] as const;
export type SoundVolume = (typeof soundVolumes)[number];

const STORAGE_KEY = 'drag-racing.sound-volume';
const DEFAULT_VOLUME: SoundVolume = 'full';
const VOLUME_GAIN: Record<SoundVolume, number> = {
  off: 0,
  half: 0.5,
  full: 1,
};
let inMemoryVolume: SoundVolume | undefined;

function isSoundVolume(value: string | null): value is SoundVolume {
  return soundVolumes.some((volume) => volume === value);
}

export function getSoundVolume(): SoundVolume {
  if (inMemoryVolume) {
    return inMemoryVolume;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_VOLUME;
  }

  try {
    const savedVolume = window.localStorage.getItem(STORAGE_KEY);
    inMemoryVolume = isSoundVolume(savedVolume) ? savedVolume : DEFAULT_VOLUME;
    return inMemoryVolume;
  } catch (error) {
    console.warn('Could not read the sound volume preference.', error);
    return DEFAULT_VOLUME;
  }
}

export function setSoundVolume(volume: SoundVolume): void {
  inMemoryVolume = volume;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, volume);
  } catch (error) {
    console.warn('Could not save the sound volume preference.', error);
  }
}

export function getSoundVolumeGain(volume = getSoundVolume()): number {
  return VOLUME_GAIN[volume];
}
