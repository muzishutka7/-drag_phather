import Phaser from 'phaser';
import { getGraphicsQuality } from '../settings/graphicsQuality';

/**
 * Garage-style backdrop: the background picture is slightly darkened and
 * softly blurred, so the car and the panels in front of it stand out.
 */
export const GARAGE_BACKDROP_DIM = 0.36;
/** Time the dim + blur take to settle in after entering the garage. */
export const GARAGE_BACKDROP_FADE_MS = 1000;
/** Blur spread in screen pixels (independent of texture size and zoom). */
const GARAGE_BACKDROP_BLUR_PX = 0.55;
const BLUR_STEPS = 4;

/**
 * Blurs a full-screen background image; amount 0..1 scales the blur (for
 * fading it in). Call again after the image is rescaled or gets a new
 * texture. Skipped on low graphics quality (a full-screen blur costs a few
 * passes every frame) and without WebGL.
 */
export function applyBackdropBlur(image: Phaser.GameObjects.Image, amount = 1): Phaser.FX.Blur | undefined {
  const fx = image.preFX;
  if (!fx) {
    return undefined;
  }
  fx.clear();
  if (getGraphicsQuality() === 'low' || image.scale <= 0) {
    return undefined;
  }
  const spread = getBlurSpread(image);
  fx.padding = Math.ceil(spread * BLUR_STEPS);
  return fx.addBlur(1, spread * amount, spread * amount, 1, 0xffffff, BLUR_STEPS);
}

/** Changes the blur made by applyBackdropBlur without rebuilding it. */
export function setBackdropBlurAmount(
  image: Phaser.GameObjects.Image,
  blur: Phaser.FX.Blur | undefined,
  amount: number,
): void {
  if (!blur) {
    return;
  }
  const spread = getBlurSpread(image) * amount;
  blur.x = spread;
  blur.y = spread;
}

/** The blur runs on the texture before scaling: screen px → texels. */
function getBlurSpread(image: Phaser.GameObjects.Image): number {
  return GARAGE_BACKDROP_BLUR_PX / image.scale;
}
