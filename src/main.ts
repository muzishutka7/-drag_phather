import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import './style.css';

const game = new Phaser.Game(gameConfig);
Object.assign(globalThis, { __PHASER_GAME__: game });

// Silence all game sound (engine loops keep running in Web Audio) while the
// app is in the background; the music player pauses itself the same way.
document.addEventListener('visibilitychange', () => {
  const sound = game.sound;
  if (!(sound instanceof Phaser.Sound.WebAudioSoundManager)) {
    return;
  }
  if (document.visibilityState === 'hidden') {
    void sound.context.suspend();
  } else {
    void sound.context.resume();
  }
});
