import Phaser from 'phaser';
import { t } from '../i18n';
import { frameRates, getFrameRate, setFrameRate } from '../settings/frameRate';
import { createSegmentedSetting } from './createSegmentedSetting';

/** Frame rate cap; takes effect after a restart (see the note under the settings). */
export function createFrameRateSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  scale: number,
): Phaser.GameObjects.Container {
  return createSegmentedSetting(scene, x, y, scale, {
    width,
    label: t('frameRateSetting'),
    options: frameRates.map((frameRate) => ({ value: frameRate, text: String(frameRate) })),
    get: getFrameRate,
    set: setFrameRate,
  }).container;
}
