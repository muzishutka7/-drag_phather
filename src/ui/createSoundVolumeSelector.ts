import Phaser from 'phaser';
import { t, type MessageKey } from '../i18n';
import {
  getChannelVolume,
  setChannelVolume,
  soundVolumes,
  type SoundChannel,
  type SoundVolume,
} from '../settings/soundVolume';
import { createSegmentedSetting } from './createSegmentedSetting';

const volumeLabels: Record<SoundVolume, MessageKey> = {
  off: 'soundOff',
  low: 'soundLow',
  half: 'soundHalf',
  full: 'soundFull',
};

export function createSoundVolumeSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  scale: number,
  channel: SoundChannel,
  labelKey: MessageKey,
): Phaser.GameObjects.Container {
  return createSegmentedSetting(scene, x, y, scale, {
    width,
    label: t(labelKey),
    options: soundVolumes.map((volume) => ({ value: volume, text: t(volumeLabels[volume]) })),
    get: () => getChannelVolume(channel),
    set: (volume) => setChannelVolume(channel, volume),
  }).container;
}
