"""Brag-Soundtrack Staffel 1: 20 s, 150 BPM (Schlag 0,4 s), a-Moll.
Musik und Effekte als ein Stück, alles auf dem Schlag-Raster ab Bild 0.
Ausgabe: WAV 48 kHz Stereo 16 bit.
"""
import sys
import wave
import numpy as np

SR = 48000
BEAT = 0.4
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(2026)

# Busse: Musik (wird gepumpt), Drums, Effekte
MUS = np.zeros((2, N))
DRM = np.zeros((2, N))
FX = np.zeros((2, N))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(bus, sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    lg = np.cos((pan + 1) * np.pi / 4) * gain * 1.414
    rg = np.sin((pan + 1) * np.pi / 4) * gain * 1.414
    bus[0, i : i + len(sig)] += sig * lg
    bus[1, i : i + len(sig)] += sig * rg


def tt(length):
    return np.arange(int(length * SR)) / SR


def smooth(x, cutoff):
    """Tiefpass-Näherung: dreifacher gleitender Mittelwert."""
    k = max(1, int(SR / cutoff / 2))
    ker = np.ones(k) / k
    for _ in range(3):
        x = np.convolve(x, ker, mode="same")
    return x


def highpass(x, cutoff):
    return x - smooth(x, cutoff)


def fade(sig, a=0.003, r=0.01):
    n = len(sig)
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na > 0:
        e[:na] = np.linspace(0, 1, na)
    if nr > 0:
        e[-nr:] *= np.linspace(1, 0, nr)
    return sig * e


# ---------- Klangbausteine ----------
def boom(length=1.6, f0=45, drop=1.2, decay=2.2):
    t = tt(length)
    f = f0 * (1 + drop * np.exp(-t * 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * decay) + 0.25 * np.sin(2 * ph) * np.exp(-t * 4)
    return fade(s, 0.001, 0.05)


def crack(length=0.35, cutoff=3500):
    t = tt(length)
    x = smooth(rng.standard_normal(len(t)), cutoff)
    return fade(x * np.exp(-t * 14), 0.001, 0.03)


def kick(gain=1.0):
    t = tt(0.38)
    f = 48 + 110 * np.exp(-t * 35)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    click = smooth(rng.standard_normal(len(t)), 3000) * np.exp(-t * 200) * 0.3
    return fade((s + click) * gain, 0.0005, 0.02)


def heartbeat():
    t = tt(0.3)
    f = 52 + 40 * np.exp(-t * 30)
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14), 0.001, 0.02)


def clap():
    t = tt(0.22)
    x = rng.standard_normal(len(t))
    x = highpass(smooth(x, 5000), 900)
    env = np.exp(-t * 28)
    # drei kurze Anschläge wie bei einer echten Klatsche
    for d in (0.0, 0.008, 0.017):
        env += 0.6 * np.exp(-np.maximum(0, t - d) * 220) * (t >= d)
    return fade(x * env * 0.6, 0.0005, 0.03)


def snare(gain=1.0):
    t = tt(0.16)
    x = highpass(smooth(rng.standard_normal(len(t)), 6000), 700)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    return fade((x * np.exp(-t * 24) + tone) * gain, 0.0005, 0.02)


def hat(gain=1.0):
    t = tt(0.05)
    x = highpass(rng.standard_normal(len(t)), 7000)
    return fade(x * np.exp(-t * 90) * gain, 0.0005, 0.005)


def tick():
    t = tt(0.03)
    return fade(np.sin(2 * np.pi * 3520 * t) * np.exp(-t * 160), 0.0005, 0.005)


def pluck(m, length=0.5, bright=1.0):
    t = tt(length)
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.5 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 12)
    s += 0.25 * bright * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 18)
    return fade(s * np.exp(-t * 7), 0.002, 0.03)


def bell(m, length=1.6):
    t = tt(length)
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + 0.3 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 5)
    return fade(s, 0.002, 0.1)


def blip(m, length=0.07):
    t = tt(length)
    f = midi(m)
    sq = np.sign(np.sin(2 * np.pi * f * t))
    return fade(smooth(sq, 5000) * np.exp(-t * 30), 0.001, 0.01)


def saw_stack(notes, length, cutoff=1800, detune=0.11):
    t = tt(length)
    s = np.zeros(len(t))
    for m in notes:
        for d in (-detune, 0, detune):
            f = midi(m) * 2 ** (d / 12)
            ph = (f * t + 0.37 * d) % 1.0
            s += 2 * ph - 1
    s /= len(notes) * 3
    return smooth(s, cutoff)


def pad(notes, length, cutoff, att=0.4, rel=0.6):
    s = saw_stack(notes, length, cutoff)
    t = tt(length)
    e = np.clip(t / att, 0, 1) * np.clip((length - t) / rel, 0, 1)
    return s * e


def sub_note(m, length):
    t = tt(length)
    s = np.sin(2 * np.pi * midi(m) * t)
    return fade(s, 0.005, 0.03)


def bass8(m, length):
    t = tt(length)
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.15 * np.sin(2 * np.pi * 3 * f * t)
    return fade(s * (0.65 + 0.35 * np.exp(-t * 12)), 0.003, 0.03)


def riser(length, f0=200, f1=1800, noise_amt=0.8):
    t = tt(length)
    p = t / length
    f = f0 * (f1 / f0) ** (p ** 1.6)
    ph = np.cumsum(f) / SR
    saw = 2 * (ph % 1.0) - 1
    nz = rng.standard_normal(len(t))
    lo = smooth(nz, 500)
    hi = smooth(nz, 6000)
    nz = lo * (1 - p) + hi * p
    s = 0.45 * smooth(saw, 4000) + noise_amt * nz
    return s * (p ** 2.2)


def whoosh_down(length=0.14):
    t = tt(length)
    p = t / length
    nz = rng.standard_normal(len(t))
    s = smooth(nz, 6000) * (1 - p) + smooth(nz, 800) * p
    return fade(s * np.exp(-p * 3), 0.001, 0.02)


def whump():
    t = tt(0.55)
    f = 130 * np.exp(-t * 7) + 38
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    return fade(s, 0.001, 0.05)


def rev_swell(length=0.4, cutoff=2500):
    t = tt(length)
    x = smooth(rng.standard_normal(len(t)), cutoff)
    return x * (t / length) ** 3



# ---------- Arrangement ----------
AM, FM, CM, GM, EM = [57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62], [52, 55, 59]
def stab(notes, gain, at):
    s = saw_stack(notes, 0.45, 2400) * np.exp(-tt(0.45) * 6)
    add(MUS, s, at, gain)

# 1) HOOK: drei aufsteigende Einschläge auf 0,0 / 0,8 / 1,6
for at, ch, f0 in ((0.0, AM, 44), (0.8, CM, 49), (1.6, EM, 55)):
    add(FX, boom(1.0, f0, 1.2, 3.2), at, 0.7)
    add(FX, crack(0.3, 3000), at, 0.3)
    stab([n + 12 for n in ch], 0.32, at)
for at in (0.4, 1.2, 2.0):
    add(FX, tick(), at, 0.04)
add(FX, riser(0.6, 400, 2600, 0.6), 1.8, 0.16)

# Groove-Helfer
def drums(a, b, every=0.4, claps=True):
    t = a
    k = 0
    while t < b - 1e-6:
        add(DRM, kick(), t, 0.55 if every == 0.4 else 0.5)
        t += every
    t = a
    k = 0
    while t < b - 1e-6:
        add(DRM, hat(), t + 0.2, 0.06, pan=0.25)
        if claps and k % 2 == 1:
            add(DRM, clap(), t, 0.32)
        t += 0.4
        k += 1

def bars(a, chords, bass_gain=0.26, arp=True):
    for i, ch in enumerate(chords):
        t0 = a + i * 1.6
        add(MUS, pad(ch, 1.7, 1900), t0, 0.13)
        root = min(ch) - 24
        for k in range(8):
            add(MUS, bass8(root, 0.18), t0 + k * 0.2, bass_gain)
        if arp:
            for k in range(16):
                add(MUS, pluck(sorted(ch)[k % 3] + 12 + (12 if k % 4 == 3 else 0), 0.2, 0.5), t0 + k * 0.1, 0.03, pan=(0.3 if k % 2 else -0.3))

# 2) REVEAL 2,4–5,6
drums(2.4, 5.6)
bars(2.4, [AM, FM])
# 3) RÖNTGEN 5,6–8,8
add(FX, boom(0.8, 52, 1.0, 4.0), 5.6, 0.35)
for m in (88, 93, 100):
    add(FX, bell(m, 1.1), 5.6, 0.04)
drums(5.6, 8.8)
bars(5.6, [CM, GM])
# 4) CODE 8,8–12,8: Halbzeit, leise Tipp-Ticks pro Zeile
add(FX, whoosh_down(0.25), 8.8, 0.1)
drums(8.8, 12.8, every=0.8, claps=False)
bars(8.8, [AM, FM], bass_gain=0.2, arp=False)
add(MUS, pad(AM, 0.85, 1900), 12.0, 0.1)
for i in range(13):
    add(FX, tick(), 8.9 + i * 0.2, 0.03, pan=-0.35)
add(FX, riser(0.4, 500, 3000, 0.7), 12.4, 0.16)
# 5) SOUND 12,8–16,0: Drop, bei 14,0 ein Schlag Stille, 14,4 weiter
add(FX, boom(1.2, 44, 1.3, 2.4), 12.8, 0.8)
add(FX, crack(0.35, 2800), 12.8, 0.3)
stab([69, 72, 76], 0.3, 12.8)
drums(12.8, 16.0)
bars(12.8, [CM, GM])
add(FX, boom(0.8, 50, 1.0, 4.0), 14.4, 0.5)
stab([67, 71, 74], 0.25, 14.4)
# 6) OUTRO 16,0–20,0
add(FX, boom(2.0, 42, 1.2, 1.6), 16.0, 0.85)
add(FX, crack(0.4, 2600), 16.0, 0.3)
drums(16.0, 18.4)
bars(16.0, [AM], bass_gain=0.24)
add(MUS, pad(FM, 0.85, 1900), 17.6, 0.12)
L = 2.0
t = tt(L)
bright = pad([57, 60, 64, 71], L, 3500, 0.02, 1.0)
dark = pad([57, 60, 64, 71], L, 600, 0.02, 1.0)
add(MUS, bright * (1 - np.clip(t / 1.6, 0, 1)) + dark * np.clip(t / 1.6, 0, 1), 18.0, 0.28)
add(DRM, kick(), 18.4, 0.5)
add(MUS, sub_note(33, 1.6) * np.exp(-tt(1.6) * 1.4), 18.4, 0.3)
for m, g in ((81, 0.06), (88, 0.045), (95, 0.03)):
    add(FX, bell(m, 1.6), 18.4, g)

# ---------- Mix ----------
time = np.arange(N) / SR
pump = np.ones(N)
for a, b, ev in ((2.4, 8.8, 0.4), (8.8, 12.8, 0.8), (12.8, 18.4, 0.4)):
    kt = a
    while kt < b - 1e-6:
        m = time >= kt
        pump[m] = np.minimum(pump[m], 1 - 0.45 * np.exp(-(time[m] - kt) / 0.09))
        kt += ev
MUS *= pump
mix = MUS + DRM * 0.9 + FX
# Gag: bei 14,0 s ein Schlag völlige Stille (wie „Ergebnis: Stille.“ im Bild)
g = np.ones(N)
r = int(0.004 * SR)
i0, i1 = int(14.0 * SR), int(14.4 * SR)
g[i0 - r:i0] = np.linspace(1, 0, r)
g[i0:i1] = 0
mix *= g
mix = np.tanh(mix * 1.45) / np.tanh(1.45)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
fo = int(0.6 * SR)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.4
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
print("ok", sys.argv[1])
