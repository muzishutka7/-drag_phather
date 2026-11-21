import { getChannelVolumeGain, onChannelVolumeChange } from '../settings/soundVolume';

/**
 * Background music: every track in turn, then from the start again.
 *
 * Played with an <audio> element, which streams the file: a few minutes of
 * music decoded into memory up front (as Web Audio does) would take tens of
 * megabytes, and the intro would have to wait for it.
 * Files: public/audio/music/ (loudness-matched, OGG + M4A), sources in
 * assets-source/audio/background/.
 */
const TRACKS = [
  'haarper-wtf-u-mean',
  'cowbell-cult-backward',
  'hex-blood-bleed-with-me',
] as const;

/** Music level at 100 % (leaves room for the engine). */
const MUSIC_LEVEL = 0.6;
const FADE_IN_MS = 1500;

let audio: HTMLAudioElement | undefined;
let trackIndex = 0;
let fadeTimer: number | undefined;
let fade = 1;

function getTrackUrl(name: string, element: HTMLAudioElement): string {
  const base = `${import.meta.env.BASE_URL}audio/music/${name}`;
  return element.canPlayType('audio/ogg; codecs="vorbis"') ? `${base}.ogg` : `${base}.m4a`;
}

/** The game is in the background (app minimised, tab hidden, screen off). */
function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/** Plays only when the music volume is not off and the game is visible. */
function applyVolume(): void {
  if (!audio) {
    return;
  }
  const gain = getChannelVolumeGain('music');
  audio.volume = Math.min(1, MUSIC_LEVEL * gain * fade);
  const shouldPlay = gain > 0 && !isHidden();
  if (!shouldPlay && !audio.paused) {
    audio.pause();
  } else if (shouldPlay && audio.paused) {
    void audio.play().catch(() => undefined);
  }
}

function playTrack(index: number): void {
  if (!audio) {
    return;
  }
  trackIndex = index % TRACKS.length;
  audio.src = getTrackUrl(TRACKS[trackIndex], audio);
  // Plays if allowed; blocked until the first tap on some browsers (retried below).
  applyVolume();
}

/** Starts the music once (later calls do nothing). */
export function startMusic(): void {
  if (audio || typeof window === 'undefined') {
    return;
  }
  audio = new Audio();
  audio.preload = 'auto';
  audio.addEventListener('ended', () => playTrack(trackIndex + 1));
  audio.addEventListener('error', () => {
    console.error(`Music track failed to load: ${audio?.src}`);
    window.setTimeout(() => playTrack(trackIndex + 1), 1000);
  });
  onChannelVolumeChange((channel) => {
    if (channel === 'music') {
      applyVolume();
    }
  });
  // If autoplay was blocked, start on the next tap or key.
  window.addEventListener('pointerdown', applyVolume);
  window.addEventListener('keydown', applyVolume);
  // Pause when the app goes to the background, resume when it comes back.
  document.addEventListener('visibilitychange', applyVolume);
  window.addEventListener('pagehide', applyVolume);

  // Soft fade-in of the first track.
  fade = 0;
  const started = performance.now();
  fadeTimer = window.setInterval(() => {
    fade = Math.min(1, (performance.now() - started) / FADE_IN_MS);
    applyVolume();
    if (fade >= 1 && fadeTimer !== undefined) {
      window.clearInterval(fadeTimer);
      fadeTimer = undefined;
    }
  }, 50);
  playTrack(0);
}
