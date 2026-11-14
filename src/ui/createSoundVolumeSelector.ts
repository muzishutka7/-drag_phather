import Phaser from 'phaser';
import { palette, toCssColor } from '../config/palette';
import {
  soundVolumes,
  getSoundVolume,
  setSoundVolume,
  type SoundVolume,
} from '../settings/soundVolume';
import { createUiText } from './createUiText';

const volumeLabels: Record<SoundVolume, 'soundOff' | 'soundHalf' | 'soundFull'> = {
  off: 'soundOff',
  half: 'soundHalf',
  full: 'soundFull',
};

export function createSoundVolumeSelector(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
): Phaser.GameObjects.Container {
  const selector = scene.add.container(x, y);
  const labelWidth = 104 * scale;
  const optionWidth = 62 * scale;
  const optionHeight = 28 * scale;
  const gap = 5 * scale;
  const left = -(labelWidth + gap + optionWidth * soundVolumes.length
    + gap * (soundVolumes.length - 1)) / 2;
  const backgrounds = new Map<SoundVolume, Phaser.GameObjects.Rectangle>();
  const labels = new Map<SoundVolume, Phaser.GameObjects.Text>();

  selector.add(createUiText(
    scene,
    left + labelWidth / 2,
    0,
    'soundSetting',
    'qualityLabel',
    scale,
  ));

  soundVolumes.forEach((volume, index) => {
    const optionX = left + labelWidth + gap + optionWidth / 2
      + index * (optionWidth + gap);
    const background = scene.add.rectangle(
      optionX,
      0,
      optionWidth,
      optionHeight,
      palette.track,
    );
    background.setStrokeStyle(scale, palette.trackBorder);
    background.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, optionWidth, optionHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    background.on(Phaser.Input.Events.POINTER_UP, () => {
      if (volume === getSoundVolume()) {
        return;
      }

      setSoundVolume(volume);
      updateSelection();
    });

    const label = createUiText(
      scene,
      optionX,
      0,
      volumeLabels[volume],
      'frameRateOption',
      scale,
    );

    backgrounds.set(volume, background);
    labels.set(volume, label);
    selector.add([background, label]);
  });

  function updateSelection(): void {
    const selectedSoundVolume = getSoundVolume();
    soundVolumes.forEach((volume) => {
      const selected = volume === selectedSoundVolume;
      backgrounds.get(volume)?.setFillStyle(selected ? palette.accent : palette.track);
      labels.get(volume)?.setColor(toCssColor(
        selected ? palette.textPrimary : palette.textSecondary,
      ));
    });
  }

  updateSelection();
  return selector;
}
