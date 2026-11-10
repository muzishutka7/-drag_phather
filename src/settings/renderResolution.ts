export const renderResolutions = ['low', 'medium', 'high'] as const;
export type RenderResolution = (typeof renderResolutions)[number];

const STORAGE_KEY = 'drag-racing.render-resolution';
const DEFAULT_RESOLUTION: RenderResolution = 'medium';
const RESOLUTION_SCALE: Record<RenderResolution, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1,
};

let inMemoryResolution: RenderResolution | undefined;

function isRenderResolution(value: string | null): value is RenderResolution {
  return renderResolutions.some((resolution) => resolution === value);
}

export function getRenderResolution(): RenderResolution {
  if (inMemoryResolution) {
    return inMemoryResolution;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_RESOLUTION;
  }

  try {
    const savedResolution = window.localStorage.getItem(STORAGE_KEY);
    return isRenderResolution(savedResolution) ? savedResolution : DEFAULT_RESOLUTION;
  } catch (error) {
    console.warn('Could not read the render resolution preference.', error);
    return DEFAULT_RESOLUTION;
  }
}

export function setRenderResolution(resolution: RenderResolution): void {
  inMemoryResolution = resolution;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, resolution);
  } catch (error) {
    console.warn('Could not save the render resolution preference.', error);
  }
}

export function getRenderResolutionScale(resolution = getRenderResolution()): number {
  return RESOLUTION_SCALE[resolution];
}
