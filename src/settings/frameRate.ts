export const frameRates = [30, 60, 120] as const;
export type FrameRate = (typeof frameRates)[number];

const STORAGE_KEY = 'drag-racing.frame-rate';
const DEFAULT_FRAME_RATE: FrameRate = 60;
const FRAME_RATE_BY_VALUE: Record<`${FrameRate}`, FrameRate> = {
  30: 30,
  60: 60,
  120: 120,
};
let inMemoryFrameRate: FrameRate | undefined;

function isFrameRate(value: string | null): value is `${FrameRate}` {
  return value === '30' || value === '60' || value === '120';
}

export function getFrameRate(): FrameRate {
  if (inMemoryFrameRate) {
    return inMemoryFrameRate;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_FRAME_RATE;
  }

  try {
    const savedFrameRate = window.localStorage.getItem(STORAGE_KEY);
    if (isFrameRate(savedFrameRate)) {
      return FRAME_RATE_BY_VALUE[savedFrameRate];
    }

    return DEFAULT_FRAME_RATE;
  } catch (error) {
    console.warn('Could not read the frame rate preference.', error);
    return DEFAULT_FRAME_RATE;
  }
}

export function setFrameRate(frameRate: FrameRate): void {
  inMemoryFrameRate = frameRate;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, String(frameRate));
  } catch (error) {
    console.warn('Could not save the frame rate preference.', error);
  }
}
