import Phaser from 'phaser';

/**
 * Garage-style backdrop: the background picture is slightly darkened and
 * softly blurred, so the car and the panels in front of it stand out.
 */
export const GARAGE_BACKDROP_DIM = 0.36;
/** Time the dim + blur take to settle in after entering the garage. */
export const GARAGE_BACKDROP_FADE_MS = 1000;
/**
 * The blur is baked once into a small copy of the picture (this many times
 * smaller) that is drawn stretched over the sharp one: GPU filtering makes it
 * soft. Works with every renderer and quality and costs nothing per frame
 * (a real-time blur shader did not run on some phones).
 */
export const BACKDROP_BLUR_DOWNSCALE = 3;

export function getBlurredTextureKey(key: string): string {
  return `${key}-blurred`;
}

/** Creates (once) the blurred copy of a loaded texture; returns its key. */
export function ensureBlurredTexture(scene: Phaser.Scene, key: string): string | undefined {
  const blurredKey = getBlurredTextureKey(key);
  if (scene.textures.exists(blurredKey)) {
    return blurredKey;
  }
  if (!scene.textures.exists(key)) {
    return undefined;
  }
  const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  // Two halving-ish steps give a smoother result than one big jump.
  const step = (input: CanvasImageSource, width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext('2d');
    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(input, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  };
  const middle = step(source, source.width / Math.sqrt(BACKDROP_BLUR_DOWNSCALE), source.height / Math.sqrt(BACKDROP_BLUR_DOWNSCALE));
  const small = step(middle, source.width / BACKDROP_BLUR_DOWNSCALE, source.height / BACKDROP_BLUR_DOWNSCALE);
  scene.textures.addCanvas(blurredKey, small);
  return blurredKey;
}

export function removeBlurredTexture(scene: Phaser.Scene, key: string): void {
  const blurredKey = getBlurredTextureKey(key);
  if (scene.textures.exists(blurredKey)) {
    scene.textures.remove(blurredKey);
  }
}
