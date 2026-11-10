export const graphicsQualities = ['low', 'medium', 'high'] as const;
export type GraphicsQuality = (typeof graphicsQualities)[number];

const STORAGE_KEY = 'drag-racing.graphics-quality';
const DEFAULT_QUALITY: GraphicsQuality = 'medium';
let inMemoryQuality: GraphicsQuality | undefined;

function isGraphicsQuality(value: string | null): value is GraphicsQuality {
  return graphicsQualities.some((quality) => quality === value);
}

export function getGraphicsQuality(): GraphicsQuality {
  if (inMemoryQuality) {
    return inMemoryQuality;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_QUALITY;
  }

  try {
    const savedQuality = window.localStorage.getItem(STORAGE_KEY);
    return isGraphicsQuality(savedQuality) ? savedQuality : DEFAULT_QUALITY;
  } catch (error) {
    console.warn('Could not read the graphics quality preference.', error);
    return DEFAULT_QUALITY;
  }
}

export function setGraphicsQuality(quality: GraphicsQuality): void {
  inMemoryQuality = quality;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, quality);
  } catch (error) {
    console.warn('Could not save the graphics quality preference.', error);
  }
}
