import Phaser from 'phaser';
import { getSoundVolumeGain } from '../settings/soundVolume';
import { ENGINE_SOUND_KEYS } from './engineSoundBank';

/** Same loudness as the idle in the race (master 0.55 × engine 0.8). */
const GARAGE_ENGINE_VOLUME = 0.44;
const STOP_FADE_MS = 150;

let current: Phaser.Sound.BaseSound | undefined;

/**
 * The car in the garage starts, idles for a while and switches off: the
 * whole start-stop recording, once. Starting again (another car) cuts the
 * previous one short.
 */
export function playEngineStartStop(scene: Phaser.Scene): void {
  stopEngineStartStop();
  if (!scene.cache.audio.exists(ENGINE_SOUND_KEYS.startStop)) {
    return;
  }
  const sound = scene.sound.add(ENGINE_SOUND_KEYS.startStop, {
    volume: GARAGE_ENGINE_VOLUME * getSoundVolumeGain(),
  });
  sound.once(Phaser.Sound.Events.COMPLETE, () => {
    sound.destroy();
    if (current === sound) {
      current = undefined;
    }
  });
  sound.play();
  current = sound;
}

/** Fades the garage engine out (works even while its scene is shutting down). */
export function stopEngineStartStop(fadeMs = STOP_FADE_MS): void {
  const sound = current;
  current = undefined;
  if (!sound) {
    return;
  }
  if (sound instanceof Phaser.Sound.WebAudioSound) {
    const gain = sound.volumeNode.gain;
    const now = (sound.manager as Phaser.Sound.WebAudioSoundManager).context.currentTime;
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
  }
  window.setTimeout(() => {
    sound.stop();
    sound.destroy();
  }, fadeMs);
}
