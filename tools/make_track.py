"""
Builds an original lo-fi / chill instrumental loop (royalty-free, synthesized
from scratch with numpy) for the dots & boxes background music.

Nothing is sampled from any existing recording: every sound here is generated
from oscillators and noise. Circular (wrap-around) reverb + filtering keeps the
result a seamless loop.
"""
import numpy as np
import wave

SR = 44100
BPM = 78.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BARS = 32
DUR = BARS * BAR
N = int(round(DUR * SR))
rng = np.random.default_rng(7)

t_all = np.arange(N) / SR


def place(buf, sig, start_s, pan=0.0, gain=1.0):
    """Add a mono signal into a stereo buffer (wrapping around the end so the
    loop stays seamless)."""
    i0 = int(round(start_s * SR))
    idx = (i0 + np.arange(len(sig))) % N
    gl = gain * np.sqrt(0.5 * (1.0 - pan))
    gr = gain * np.sqrt(0.5 * (1.0 + pan))
    buf[0][idx] += sig * gl
    buf[1][idx] += sig * gr


def midi_f(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def rhodes(freq, dur, vel=1.0):
    """Soft electric-piano-ish tone: a few decaying partials."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for mult, amp, dec in ((1, 1.00, 1.30), (2, 0.38, 0.80), (3, 0.20, 0.55),
                           (4.02, 0.12, 0.35), (5.01, 0.07, 0.22), (6.02, 0.04, 0.15)):
        drift = 1.0 + 0.0015 * np.sin(2 * np.pi * 0.7 * t + freq * 0.01)
        sig += amp * np.sin(2 * np.pi * freq * mult * drift * t) * np.exp(-t / dec)
    # gentle tine click
    click = rng.normal(0, 1, n) * np.exp(-t / 0.012) * 0.06
    sig = sig + click
    atk = int(0.008 * SR)
    sig[:atk] *= np.linspace(0, 1, atk)
    tail = int(0.03 * SR)
    if n > tail:
        sig[-tail:] *= np.linspace(1, 0, tail)
    return sig * vel


def bass(freq, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.22 * np.sin(4 * np.pi * freq * t)
    sig *= np.exp(-t / 0.85)
    atk = int(0.012 * SR)
    sig[:atk] *= np.linspace(0, 1, atk)
    tail = int(0.04 * SR)
    if n > tail:
        sig[-tail:] *= np.linspace(1, 0, tail)
    return sig * vel


def kick(vel=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 92 * np.exp(-t / 0.055) + 42
    phase = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(phase) * np.exp(-t / 0.20)
    sig += rng.normal(0, 1, n) * np.exp(-t / 0.004) * 0.25
    return sig * vel


def snare(vel=1.0):
    n = int(0.30 * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    noise = np.diff(np.concatenate([[0.0], noise]))          # crude highpass
    noise *= np.exp(-t / 0.10)
    body = 0.35 * np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.07)
    return (noise * 0.55 + body) * vel


def hat(vel=1.0, open_=False):
    dur = 0.16 if open_ else 0.055
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    noise = np.diff(np.concatenate([[0.0], noise]))
    return noise * np.exp(-t / (dur * 0.45)) * vel


# ---- harmony: Am7 - Fmaj7 - Cmaj7 - G6, one bar each --------------------
CHORDS = [
    (45, [57, 60, 64, 67]),   # Am7
    (41, [53, 57, 60, 64]),   # Fmaj7
    (48, [60, 64, 67, 71]),   # Cmaj7
    (43, [55, 59, 62, 64]),   # G6
]

mix = np.zeros((2, N))

# ---- chords / rhodes ---------------------------------------------------
for bar in range(BARS):
    root, notes = CHORDS[bar % 4]
    bar_t = bar * BAR
    # laid-back chord on beat 1, softer echo on the "and" of 2
    for hit_t, vel, spread in ((0.0, 0.9, 0.0), (2.5 * BEAT, 0.45, 0.004)):
        for k, m in enumerate(notes):
            place(mix, rhodes(midi_f(m), BAR * 1.15, vel * (0.9 - 0.05 * k)),
                  bar_t + hit_t + spread * k, pan=-0.35 + 0.22 * k, gain=0.20)

# ---- bright pluck arpeggio (mid presence) -----------------------------
for bar in range(BARS):
    root, notes = CHORDS[bar % 4]
    bar_t = bar * BAR
    order = [notes[0] + 12, notes[2] + 12, notes[1] + 12, notes[3] + 12]
    for i in range(8):
        m = order[i % len(order)]
        vel = 0.55 if i % 4 == 0 else 0.34
        place(mix, rhodes(midi_f(m), 0.9, vel * 0.5),
              bar_t + i * BEAT / 2 + 0.03 * (i % 2), pan=0.25 - 0.1 * (i % 3), gain=0.115)

# ---- bass --------------------------------------------------------------
for bar in range(BARS):
    root, _ = CHORDS[bar % 4]
    bar_t = bar * BAR
    for hit_t, vel, ln in ((0.0, 1.0, 1.6 * BEAT), (2.5 * BEAT, 0.75, 1.2 * BEAT)):
        place(mix, bass(midi_f(root), ln * 1.6, vel), bar_t + hit_t, pan=0.0, gain=0.24)

# ---- drums (enter after 4 bars, tiny fills every 8th bar) --------------
for bar in range(BARS):
    bar_t = bar * BEAT * 4
    if bar < 4:
        continue
    for beat, vel in ((0.0, 1.0), (2.5, 0.85)):
        place(mix, kick(vel), bar_t + beat * BEAT, gain=0.62)
    if bar % 4 == 3:                       # little pickup kick
        place(mix, kick(0.5), bar_t + 3.5 * BEAT, gain=0.62)
    for beat in (1.0, 3.0):
        place(mix, snare(0.9), bar_t + beat * BEAT, pan=0.05, gain=0.42)
    for i in range(8):
        sw = 0.035 * (i % 2)               # slight swing on off-8ths
        vel = 0.55 if i % 2 == 0 else 0.32
        place(mix, hat(vel), bar_t + i * BEAT / 2 + sw, pan=0.30, gain=0.40)
    if bar % 8 == 7:
        place(mix, hat(0.4, open_=True), bar_t + 3.5 * BEAT, pan=0.3, gain=0.26)

# ---- vinyl crackle + air ----------------------------------------------
for ch in range(2):
    crackle = rng.normal(0, 1, N) * 0.010
    hits = rng.integers(0, N, 90)
    crackle[hits] += rng.normal(0, 1, 90) * 0.09
    mix[ch] += crackle

# ---- air: faint band-limited hiss so the top end isn't dead -----------
air = rng.normal(0, 1, N) * 0.006

# ---- circular (wrap-around) processing so the loop is seamless --------
freqs = np.fft.rfftfreq(N, 1 / SR)


def circular_filter(x, gain_curve):
    return np.fft.irfft(np.fft.rfft(x) * gain_curve, N)


# low-pass ~6.5 kHz for the lo-fi tape feel, high-pass below 38 Hz
lp = 1.0 / (1.0 + (freqs / 11000.0) ** 2)
hp = 1.0 - np.exp(-(freqs / 38.0) ** 2)
shelf = 1.0 + 2.6 * (freqs / (freqs + 900.0))
curve = lp * hp * shelf

# reverb impulse (decaying noise), applied circularly
ir_n = int(0.85 * SR)
ir_t = np.arange(ir_n) / SR
ir = rng.normal(0, 1, ir_n) * np.exp(-ir_t / 0.32)
ir[: int(0.012 * SR)] = 0.0
ir /= np.sqrt((ir ** 2).sum())

ir_pad = np.zeros(N)
ir_pad[:ir_n] = ir
IR = np.fft.rfft(ir_pad)

out = np.zeros((2, N))
for ch in range(2):
    air_band = 1.0 / (1.0 + (60.0 / np.maximum(freqs, 1.0)) ** 4)
    air_band *= 1.0 / (1.0 + (freqs / 7000.0) ** 4)
    mix[ch] += circular_filter(air, air_band)
    dry = circular_filter(mix[ch], curve)
    wet = np.fft.irfft(np.fft.rfft(dry) * IR, N)
    out[ch] = dry + 0.16 * wet

# gentle tape saturation + normalise
out = np.tanh(out * 2.0) / np.tanh(2.0)
peak = np.abs(out).max()
out = out / peak * 0.89

# short overall fades would break the loop, so only a 15 ms de-click guard
g = int(0.015 * SR)
fade = np.linspace(0, 1, g)
out[:, :g] *= fade
out[:, -g:] *= fade[::-1]

data = (out.T * 32767).astype(np.int16)
with wave.open('/scratch/work/lofi_loop.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())

rms = np.sqrt((out ** 2).mean())
print(f'length={DUR:.1f}s  peak={np.abs(out).max():.3f}  rms={rms:.3f}  '
      f'clipped_samples={(np.abs(out) > 0.999).sum()}')
