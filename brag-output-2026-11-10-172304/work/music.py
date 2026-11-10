"""Soundtrack AirPods-Film: 20 s, 120 BPM, a-Moll (Am F C G).
Musik und Effekte als ein Stück auf einem Schlag-Raster ab Bild 0.
Ausgabe: WAV 48 kHz Stereo, 16 bit.
"""
import sys
import wave
import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM  # 0,5 s
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    sig = sig[: N - i]
    lg = np.cos((pan + 1) * np.pi / 4) * gain
    rg = np.sin((pan + 1) * np.pi / 4) * gain
    L[i : i + len(sig)] += sig * lg
    R[i : i + len(sig)] += sig * rg


def env(n, a, d, s_level, r, total):
    """ADSR in Sekunden auf n Samples."""
    t = np.arange(n) / SR
    e = np.ones(n) * s_level
    e[t < a] = t[t < a] / max(a, 1e-4)
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s_level) * (t[m] - a) / max(d, 1e-4)
    rel = t >= total - r
    e[rel] *= np.clip((total - t[rel]) / max(r, 1e-4), 0, 1)
    return e


def lowpass(x, cutoff):
    """Einfacher Tiefpass 1. Ordnung, zweimal (12 dB/Oktave)."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y
    return x


def lp_fast(x, cutoff):
    # Vektorisiert über lfilter-freie Rekursion in Blöcken: hier reicht ein gleitender Mittelwert-Kaskade
    k = max(1, int(SR / cutoff / 2))
    ker = np.ones(k) / k
    for _ in range(3):
        x = np.convolve(x, ker, mode="same")
    return x


# ---------- Instrumente ----------
def kick(gain=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    click = lp_fast(rng.standard_normal(n), 2500) * np.exp(-t * 180) * 0.25
    return (s + click) * gain


def boom():
    """Tiefer Einschlag auf Bild 0 (A1 Sub mit langem Ausklang)."""
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    f = midi(33) * (1 + 0.8 * np.exp(-t * 14))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 1.6)
    s += 0.35 * np.sin(2 * ph) * np.exp(-t * 3.0)
    return s


def hat(gain=1.0):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - lp_fast(x, 6000)
    return x * np.exp(-t * 70) * gain


def bass_note(m, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return s * env(n, 0.005, 0.12, 0.6, 0.06, length)


def pad_chord(notes, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.12):
            f = midi(m) * 2 ** (det / 12)
            # weiche Sägezahn-Annäherung (wenige Obertöne)
            for k, a in ((1, 1.0), (2, 0.35), (3, 0.15)):
                s += a * np.sin(2 * np.pi * f * k * t + k * det * 3)
    s /= len(notes) * 3
    return lp_fast(s, 2200) * env(n, 0.35, 0.3, 0.8, 0.5, length)


def pluck(m, length=0.6):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 10) + 0.2 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 16)
    return s * np.exp(-t * 6.5) * env(n, 0.003, 0.0, 1.0, 0.05, length)


def whoosh(length=0.45):
    """Gefiltertes Rauschen, schwillt zum Schnitt hin an."""
    n = int(length * SR)
    t = np.arange(n) / SR
    x = lp_fast(rng.standard_normal(n), 1800)
    x = x - lp_fast(x, 300)
    shape = (t / length) ** 2.2
    shape[-int(0.02 * SR) :] *= np.linspace(1, 0, int(0.02 * SR))
    return x * shape


# ---------- Arrangement ----------
CHORDS = [
    ([57, 60, 64], 45),  # Am
    ([57, 60, 65], 41),  # F
    ([55, 60, 64], 48),  # C
    ([55, 59, 62], 43),  # G
]
CUTS = [2.5, 6.0, 11.0, 14.5, 17.0]
GROOVE_END = 18.0

add(boom(), 0.0, 0.8)
bars = int(np.ceil(DUR / (4 * BEAT)))
for b in range(bars):
    t0 = b * 4 * BEAT
    notes, root = CHORDS[b % 4]
    length = 4 * BEAT + 0.4
    if t0 >= GROOVE_END:
        notes, root = CHORDS[0]
        length = DUR - t0
    add(pad_chord(notes, length), t0, 0.16 if t0 < 2.5 else 0.12, pan=-0.15)
    add(pad_chord([n + 12 for n in notes], length), t0, 0.05, pan=0.2)

for i in range(int(DUR / BEAT)):
    t = i * BEAT
    if 2.5 <= t < GROOVE_END:
        add(kick(), t, 0.55)
        add(hat(), t + BEAT / 2, 0.05, pan=0.3)
        if i % 2 == 1:
            add(hat(), t + BEAT * 0.75, 0.03, pan=-0.3)
        notes, root = CHORDS[int(t // (4 * BEAT)) % 4]
        for k in range(2):
            add(bass_note(root, BEAT / 2 - 0.02), t + k * BEAT / 2, 0.22)
add(kick(), GROOVE_END, 0.5)
add(bass_note(45, 1.8), GROOVE_END, 0.24)

# leises Arpeggio in Szene 3 und 4
for i in range(int((14.5 - 6.0) / (BEAT / 2))):
    t = 6.0 + i * BEAT / 2
    notes, root = CHORDS[int(t // (4 * BEAT)) % 4]
    add(pluck(sorted(notes)[i % 3] + 12, 0.5), t, 0.05, pan=0.35 if i % 2 else -0.35)

# Szene 2: ein Ton pro Bauteil (Schläge 3,0 / 3,5 / 4,0 / 4,5)
for k, m in enumerate([69, 72, 76, 81]):
    add(pluck(m, 0.7), 3.0 + k * BEAT, 0.16, pan=-0.25 + k * 0.17)
# Szene 4: kleiner Abwärts-Ton beim Pausieren
PAUSE_TONES = [(76, 13.0), (69, 13.25)]
# Szene 5: Lade-Ton aufsteigend
for k, m in enumerate([69, 72, 76, 79, 81]):
    add(pluck(m, 0.6), 15.5 + k * BEAT / 2, 0.11, pan=-0.2 + k * 0.1)
# Schluss-Akkord
for m in (69, 72, 76, 81):
    add(pluck(m, 2.0), 17.0, 0.07)
    add(pluck(m, 2.0), GROOVE_END, 0.06)
for c in CUTS:
    add(whoosh(0.45), c - 0.45, 0.10)

# Gags: "Stille" (8,5–9,0) und "Pausiert" (13,0–13,5): alles außer den Effekt-Tönen schweigt
# -> Musikbus und Effekte getrennt mischen

# ---------- Mix ----------
mix = np.stack([L, R])
t = np.arange(N) / SR
g = np.ones(N)
def gap(a, b, level):
    r = 0.03
    m = (t > a - r) & (t < b + r)
    g[m] = np.minimum(g[m], level + (1 - level) * np.clip(np.maximum(a - t[m], t[m] - b) / r, 0, 1))
gap(8.5, 9.0, 0.12)
gap(13.05, 13.5, 0.0)
mix = mix * g
FX = np.zeros((2, N))
for m, at in PAUSE_TONES:
    s = pluck(m, 0.6)
    i = int(at * SR)
    FX[:, i:i + len(s)] += s * 0.10
mix = mix + FX
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
fade = int(0.8 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
pcm = (mix.T * 32767).astype(np.int16)

with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", sys.argv[1], DUR, "s")
