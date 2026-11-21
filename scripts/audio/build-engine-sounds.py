"""Cuts the engine recordings in assets-source/audio/ into the game files.

python scripts/audio/build-engine-sounds.py
Requires: numpy, scipy and ffmpeg on PATH. Writes public/audio/engine/*.ogg + *.m4a.

- engine-start-stop: starter, idle and switch-off, whole (garage);
- engine-idle-loop:  6 s of idle as a seamless loop;
- engine-rpm-loops:  steady loops at several rpm cut from the free rev
                     (~2000 → 4850 → 900 rpm), throttle-on and throttle-off sets.
                     Each slice is re-timed so its pitch is constant, then made
                     seamless; prints the loop table for engineSoundBank.ts;
The rev limiter is not a recording: the game chops the top rpm loops.
The idle loop carries 0.1 s of wrapped padding on both sides (absorbs encoder delay);
the game loops between 0.1 s and 0.1 s + body length (src/audio/engineSoundBank.ts).
The rpm is measured from the strongest tone (a 4-cylinder fires at rpm / 30 Hz).
"""
import os, subprocess, tempfile
import numpy as np
import scipy.io.wavfile as wavfile
import scipy.signal as signal

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'assets-source', 'audio')
OUT = os.path.join(ROOT, 'public', 'audio', 'engine')
SR = 44100
SOURCES = {
    'idle': 'старт бензинового 4 целіндра холості та вимкнення двигуна.m4a',
    'rev': 'full_power_engine_900_6000.m4a',
}


def load(name):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'x.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(SRC, name), '-ac', '1', '-ar', str(SR), wav], check=True)
        _, x = wavfile.read(wav)
    return x.astype(np.float32) / 32768


def fade(n):
    return 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n))


def seamless(x, start, end, crossfade, pad):
    a, b, n = int(start * SR), int(end * SR), int(crossfade * SR)
    body = x[a:b].copy()
    f = fade(n)
    body[:n] = body[:n] * f + x[b:b + n] * (1 - f)  # the end flows into the start
    p = int(pad * SR)
    return np.concatenate([body[-p:], body, body[:p]])


def save(name, x):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'x.wav')
        wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', os.path.join(OUT, name + '.ogg')], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '96k', os.path.join(OUT, name + '.m4a')], check=True)


idle, rev = load(SOURCES['idle']), load(SOURCES['rev'])

full = idle[:int(17.6 * SR)].copy()
full[:int(0.01 * SR)] *= fade(int(0.01 * SR))
full[-int(0.3 * SR):] *= fade(int(0.3 * SR))[::-1]
save('engine-start-stop', full)
save('engine-idle-loop', seamless(idle, 4.0, 10.0, 0.3, 0.1))
# --- rpm loops ---
def track_rpm(x):
    """Strongest line between 28 and 200 Hz, followed over time → rpm."""
    nper, hop = 8192, 441
    freqs = np.fft.rfftfreq(nper * 4, 1 / SR)
    times, rpm, f = [], [], None
    for centre in range(nper // 2, len(x) - nper // 2, hop):
        spectrum = np.abs(np.fft.rfft(x[centre - nper // 2:centre + nper // 2] * np.hanning(nper), nper * 4))
        band = (freqs > 28) & (freqs < 200) if f is None else (freqs > max(25, f * 0.9)) & (freqs < f * 1.1)
        i = int(np.argmax(np.where(band, spectrum, 0)))
        a, b, c = np.log(spectrum[i - 1:i + 2] + 1e-12)
        f = (i + 0.5 * (a - c) / (a - 2 * b + c)) * SR / (nper * 4)
        times.append(centre / SR)
        rpm.append(f * 30)
    return np.array(times), signal.savgol_filter(signal.medfilt(np.array(rpm), 7), 15, 2)


def dechirp(x, times, rpm, a, b, oversampled):
    """Re-times a slice so its pitch is constant (= its median rpm)."""
    t = np.arange(a, b, 1 / SR)
    r = np.interp(t, times, rpm)
    target = float(np.median(r))
    out_time = np.concatenate([[0], np.cumsum(r[:-1] / target / SR)])
    source_time = np.interp(np.arange(0, out_time[-1], 1 / SR), out_time, t)
    return np.interp(source_time * SR * 4, np.arange(len(oversampled)), oversampled), target


LOOPS = {
    'on': [(1.75, 2.30), (2.55, 2.80), (2.85, 3.35), (3.75, 4.25), (5.15, 5.85)],
    'off': [(6.25, 6.55), (6.80, 7.05), (7.55, 8.10), (8.55, 9.05)],
}
times, rpm = track_rpm(rev)
oversampled = signal.resample_poly(rev, 4, 1)
pieces, table, position, pad = [], [], 0.0, 0.08
for layer, slices in LOOPS.items():
    for a, b in slices:
        y, target = dechirp(rev, times, rpm, a, b, oversampled)
        n = int(max(0.06, min(0.2, len(y) / SR * 0.3)) * SR)
        body = y[:-n].copy()
        f = fade(n)
        body[:n] = body[:n] * np.sqrt(f) + y[-n:] * np.sqrt(1 - f)
        p = int(pad * SR)
        piece = np.concatenate([body[-p:], body, body[:p], np.zeros(int(0.05 * SR))])
        db = 20 * np.log10(np.sqrt((body ** 2).mean()))
        # loudness curve: idle loop level at 1200 rpm, +10 dB at 4844; throttle-off 3 dB lower
        goal = -29 + 10 * (target - 1200) / (4844 - 1200) - (3 if layer == 'off' and target > 1600 else 0)
        table.append((layer, round(target), round(position + pad, 4), round(position + pad + len(body) / SR, 4), round(10 ** ((goal - db) / 20), 2)))
        pieces.append(piece)
        position += len(piece) / SR
save('engine-rpm-loops', np.concatenate(pieces))
for layer, r, a, b, g in table:
    print(f"  {{ layer: '{layer}', rpm: {r}, start: {a}, end: {b}, gain: {g} }},")
print('done:', OUT)
