// Synthesizes the soundtrack (48 kHz stereo WAV) from the shared cue sheet — no samples, no deps.
// Instruments shared with the other films in this repo; the arrangement below is specific to this promo.
const fs = require('fs');
const path = require('path');
const C = require('./timeline.js');

const SR = 48000, N = Math.ceil(C.duration * SR);
const L = new Float32Array(N), R = new Float32Array(N), SEND = new Float32Array(N);
const TAU = Math.PI * 2;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const add = (i, v, pan = 0, send = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += v * Math.cos((pan + 1) * Math.PI / 4) * 1.414;
  R[i] += v * Math.sin((pan + 1) * Math.PI / 4) * 1.414;
  SEND[i] += v * send;
};
const S = t => Math.round(t * SR);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// --- instruments ---
function boom(t0, amp = 1, f0 = 140, f1 = 38) {           // cinematic impact: pitch-dropping sub + noise crack
  let ph = 0, lp = 0;
  for (let n = 0; n < SR * 2.2; n++) {
    const t = n / SR, f = f1 + (f0 - f1) * Math.exp(-t * 14);
    ph += TAU * f / SR;
    const env = (1 - Math.exp(-t * 400)) * Math.exp(-t * 2.4);
    const sub = Math.tanh(Math.sin(ph) * 1.8) * env;
    lp += (rnd() - lp) * 0.08;
    const crack = lp * Math.exp(-t * 18) * 1.6;
    add(S(t0) + n, (sub * 0.9 + crack) * amp, 0, 0.25);
  }
}
function whoosh(t0, dur = 0.5, amp = 0.5, panFrom = -0.8, panTo = 0.8) {
  let a = 0, b = 0;
  for (let n = 0; n < SR * dur; n++) {
    const p = n / (SR * dur), env = Math.sin(Math.PI * Math.pow(p, 1.6));
    const k = 0.01 + 0.25 * env;                       // sweep the lowpass with the swell
    a += (rnd() - a) * k; b += (a - b) * k;
    add(S(t0) + n, b * env * amp * 3, panFrom + (panTo - panFrom) * p, 0.5);
  }
}
function riser(t0, t1, amp = 0.4) {
  let a = 0, ph = 0;
  for (let n = 0; n < S(t1 - t0); n++) {
    const p = n / S(t1 - t0), k = 0.01 + 0.5 * p * p;
    a += (rnd() - a) * k;
    ph += TAU * (110 + 900 * p * p) / SR;
    const saw = ((ph / TAU) % 1) * 2 - 1;
    const env = Math.pow(p, 2.2);
    add(S(t0) + n, (a * 1.4 + saw * 0.25) * env * amp, Math.sin(p * 20) * 0.4, 0.4);
  }
}
function pad(t0, t1, notes, amp = 0.12, atk = 0.6, rel = 0.8, cutoff = 0.06) {
  const len = S(t1 - t0 + rel);
  notes.forEach((m, vi) => {
    for (const det of [-0.08, 0.07]) {
      const f = mtof(m + det); let ph = (rnd() + 1) * Math.PI, lp = 0, lp2 = 0;
      for (let n = 0; n < len; n++) {
        const t = n / SR, d = t1 - t0;
        const env = Math.min(1, t / atk) * (t > d ? Math.max(0, 1 - (t - d) / rel) : 1);
        ph += TAU * f / SR;
        const saw = ((ph / TAU) % 1) * 2 - 1;
        lp += (saw - lp) * cutoff; lp2 += (lp - lp2) * cutoff;
        add(S(t0) + n, lp2 * env * amp, (vi % 2 ? 0.35 : -0.35) * (det > 0 ? 1 : -1), 0.6);
      }
    }
  });
}
function pluck(t0, m, amp = 0.18, pan = 0) {
  const f = mtof(m); let ph = 0;
  for (let n = 0; n < SR * 0.9; n++) {
    const t = n / SR; ph += TAU * f / SR;
    const env = Math.exp(-t * 6) * (1 - Math.exp(-t * 900));
    add(S(t0) + n, (Math.sin(ph) + 0.3 * Math.sin(2 * ph) * Math.exp(-t * 12) + 0.15 * Math.sin(3 * ph) * Math.exp(-t * 20)) * env * amp, pan, 0.5);
  }
}
function bassNote(t0, dur, m, amp = 0.35, bright = 0.08) {
  const f = mtof(m); let ph = 0, lp = 0;
  for (let n = 0; n < SR * dur; n++) {
    const t = n / SR; ph += TAU * f / SR;
    const saw = ((ph / TAU) % 1) * 2 - 1;
    lp += (saw - lp) * (bright * Math.exp(-t * 8) + 0.02);
    const env = Math.min(1, t * 300) * Math.exp(-t * 5);
    add(S(t0) + n, (lp + Math.sin(ph) * 0.6) * env * amp, 0, 0.05);
  }
}
function heartbeat(t0, amp = 0.8) {
  for (const [dt, a] of [[0, 1], [0.18, 0.7]]) {
    let ph = 0;
    for (let n = 0; n < SR * 0.35; n++) {
      const t = n / SR; ph += TAU * (70 - 25 * t / 0.35) / SR;
      add(S(t0 + dt) + n, Math.sin(ph) * Math.exp(-t * 14) * (1 - Math.exp(-t * 500)) * a * amp, 0, 0.1);
    }
  }
}
function slam(t0, amp = 0.8) {                         // card hit: short boom + bright snap
  boom(t0, amp * 0.6, 180, 55);
  let hp = 0, prev = 0;
  for (let n = 0; n < SR * 0.25; n++) {
    const t = n / SR, x = rnd(); hp = 0.9 * (hp + x - prev); prev = x;
    add(S(t0) + n, hp * Math.exp(-t * 30) * amp * 0.5, rnd() * 0.3, 0.6);
  }
}
function sparkle(t0, m, amp = 0.06) {
  const f = mtof(m); let ph = 0;
  for (let n = 0; n < SR * 1.5; n++) { const t = n / SR; ph += TAU * f / SR; add(S(t0) + n, Math.sin(ph) * Math.exp(-t * 3) * (1 - Math.exp(-t * 200)) * amp, Math.sin(m) * 0.7, 0.9); }
}
function drone(t0, t1, m, amp, open0, open1) {
  const f = mtof(m); let ph1 = 0, ph2 = 0, lp = 0;
  const len = S(t1 - t0);
  for (let n = 0; n < len; n++) {
    const p = n / len, t = n / SR;
    ph1 += TAU * f / SR; ph2 += TAU * f * 1.004 / SR;
    const saw = (((ph1 / TAU) % 1) + ((ph2 / TAU) % 1)) - 1;
    lp += (saw - lp) * (open0 + (open1 - open0) * p);
    const env = Math.min(1, t / 0.8) * Math.min(1, (len - n) / (SR * 0.15));
    add(S(t0) + n, (lp * 0.7 + Math.sin(ph1 / 2) * 0.5) * env * amp, 0, 0.3);
  }
}


// --- extra instruments ---
function click(t0, amp = 0.12, f = 2600, pan = 0) {          // keyboard / UI tick
  let ph = 0;
  for (let n = 0; n < SR * 0.03; n++) { const t = n / SR; ph += TAU * f / SR; add(S(t0) + n, (Math.sin(ph) * 0.6 + rnd() * 0.4) * Math.exp(-t * 260) * amp, pan, 0.15); }
}
function hat(t0, amp = 0.05, pan = 0) {
  let hp = 0, prev = 0;
  for (let n = 0; n < SR * 0.06; n++) { const t = n / SR, x = rnd(); hp = 0.6 * (hp + x - prev); prev = x; add(S(t0) + n, hp * Math.exp(-t * 70) * amp, pan, 0.1); }
}
function kick(t0, amp = 0.5) {
  let ph = 0;
  for (let n = 0; n < SR * 0.4; n++) { const t = n / SR; ph += TAU * (48 + 110 * Math.exp(-t * 30)) / SR; add(S(t0) + n, Math.sin(ph) * Math.exp(-t * 9) * (1 - Math.exp(-t * 800)) * amp, 0, 0.02); }
}

function clap(t0, amp = 0.35) {
  for (const d of [0, 0.011, 0.022]) {
    let a = 0, b = 0;
    for (let n = 0; n < SR * (d === 0.022 ? 0.18 : 0.012); n++) {
      const t = n / SR; a += (rnd() - a) * 0.5; b += (a - b) * 0.5;      // crude band-pass
      add(S(t0 + d) + n, (a - b) * Math.exp(-t * (d === 0.022 ? 22 : 200)) * amp * 3, 0, 0.35);
    }
  }
}
function lead(t0, dur, m, amp = 0.08) {
  const f = mtof(m); let ph = 0;
  for (let n = 0; n < SR * (dur + 0.25); n++) {
    const t = n / SR, vib = 1 + 0.006 * Math.sin(TAU * 5.5 * t) * Math.min(1, t * 4);
    ph += TAU * f * vib / SR;
    const env = Math.min(1, t * 40) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.25)) * (0.85 + 0.15 * Math.exp(-t * 6));
    add(S(t0) + n, (Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.08 * Math.sin(3 * ph)) * env * amp, 0.1, 0.55);
  }
}

// --- arrangement: F major, 120 BPM, Fmaj7 – Am7 – Dm7 – Bbmaj7 ---
const BEAT = 0.5, [G0, G1] = C.groove;
const CHORDS = [[41, [60, 64, 67, 69]], [45, [60, 64, 67, 69]], [38, [60, 62, 65, 69]], [34, [58, 62, 65, 69]]];
// 0–2: intro build
boom(0.03, 0.35, 80, 36);
pad(0.0, 2.0, [53, 57, 60, 64], 0.06, 0.8, 0.15, 0.03);
for (let t = 1.0; t < G0; t += 0.125) hat(t, 0.012 + 0.05 * ((t - 1.0) / 1.0), (t * 8) % 2 ? 0.35 : -0.35);
riser(0.9, 1.98, 0.32);
[0.5, 0.62, 0.74].forEach((t, i) => pluck(t, [84, 88, 91][i], 0.07, (i - 1) * 0.4));
// 2–8.5: groove
for (let t = G0; t < G1 - 0.01; t += BEAT) kick(t, 0.6);
for (let t = G0 + BEAT; t < G1 - 0.01; t += 2 * BEAT) clap(t, 0.32);
for (let t = G0 + 0.25; t < G1 - 0.01; t += BEAT) hat(t, 0.075, 0.35);
for (let t = G0; t < G1 - 0.01; t += 0.125) hat(t, 0.018, -0.35);
for (let k = 0; G0 + k < G1 - 0.01; k++) {
  const t0 = G0 + k, [b, notes] = CHORDS[k % 4], t1 = Math.min(G1, t0 + 1);
  pad(t0, t1, notes, 0.035, 0.02, 0.12, 0.07);                         // chord bed
  for (let t = t0 + 0.25; t < t1 - 0.01; t += BEAT) bassNote(t, 0.22, b, 0.32, 0.12);   // offbeat house bass
  if (C.lyricLines[0] - 0.3 > t0 || t0 >= 6.5) for (let i = 0, t = t0; t < t1 - 0.01; t += 0.125, i++) pluck(t, notes[i % 4] + 12, 0.03, i % 2 ? 0.45 : -0.45);
}
// lyric melody: one note per word, in time with the on-screen highlight
const MEL = [[72, 74, 77, 76], [77, 76, 74, 72, 74], [72, 74, 77, 79], [81, 79, 77, 77]];
C.lyrics.forEach((line, i) => {
  const t0 = C.lyricLines[i], t1 = i + 1 < C.lyricLines.length ? C.lyricLines[i + 1] : 6.5, ws = line.split(' ');
  ws.forEach((w, k) => { if (w === '–') return; const a = t0 + (k / ws.length) * (t1 - t0) * 0.9; lead(a, (t1 - t0) * 0.9 / ws.length * 0.85, MEL[i][k % MEL[i].length], 0.075); });
});
// devices: one pluck per device landing
C.devicesIn.forEach((t, i) => pluck(t, [79, 84, 88, 91][i], 0.09, -0.5 + i * 0.33));
// transitions
[[1.85, -0.8, 0.8], [3.75, 0.8, -0.8], [6.35, -0.8, 0.8], [8.3, 0.8, -0.8]].forEach(([t, a, b]) => whoosh(t, 0.45, 0.35, a, b));
boom(G0, 0.75, 130, 40); boom(4.0, 0.4, 110, 45); boom(6.5, 0.35, 110, 45);
// 8.5–10: end card
boom(G1, 1.0, 150, 34);
pad(G1, 10.0, [41, 53, 60, 64, 67, 69, 74], 0.08, 0.04, 1.0, 0.06);   // Fmaj9 (add 13)
[0, 0.07, 0.14, 0.21, 0.28].forEach((d, i) => pluck(8.55 + d, [77, 81, 84, 88, 93][i], 0.07, (i % 2 ? 0.4 : -0.4)));
sparkle(9.0, 89, 0.05); sparkle(9.28, 96, 0.05); sparkle(9.4, 100, 0.035);

// --- reverb (Schroeder: 4 combs + 2 allpasses per side) on the send bus ---
function reverb(input, combs, aps, fb = 0.8, damp = 0.3) {
  const out = new Float32Array(N);
  for (const d of combs) {
    const buf = new Float32Array(d); let idx = 0, filt = 0;
    for (let n = 0; n < N; n++) { const y = buf[idx]; filt = y * (1 - damp) + filt * damp; buf[idx] = input[n] + filt * fb; out[n] += y / combs.length; idx = (idx + 1) % d; }
  }
  for (const d of aps) {
    const buf = new Float32Array(d); let idx = 0;
    for (let n = 0; n < N; n++) { const b = buf[idx], x = out[n]; const y = -x + b; buf[idx] = x + b * 0.5; out[n] = y; idx = (idx + 1) % d; }
  }
  return out;
}
const rvL = reverb(SEND, [1557, 1617, 1491, 1422].map(x => x * 2), [225, 556]);
const rvR = reverb(SEND, [1580, 1640, 1514, 1445].map(x => x * 2), [248, 579]);

// --- master: mix, DC/highpass, soft clip, fade, normalize ---
let hpL = 0, hpR = 0, pxL = 0, pxR = 0, peak = 0;
const outL = new Float32Array(N), outR = new Float32Array(N);
for (let n = 0; n < N; n++) {
  let l = L[n] + rvL[n] * 0.35, r = R[n] + rvR[n] * 0.35;
  hpL = 0.9985 * (hpL + l - pxL); pxL = l; hpR = 0.9985 * (hpR + r - pxR); pxR = r;
  const fade = Math.min(1, n / (SR * 0.05)) * Math.min(1, (N - n) / (SR * 0.6));
  outL[n] = Math.tanh(hpL * 1.1) * fade; outR[n] = Math.tanh(hpR * 1.1) * fade;
  peak = Math.max(peak, Math.abs(outL[n]), Math.abs(outR[n]));
}
const g = 0.89 / peak; // -1 dBFS
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outL[n] * g)) * 32767), 44 + n * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outR[n] * g)) * 32767), 46 + n * 4);
}
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'soundtrack.wav'), buf);
console.log('wrote out/soundtrack.wav');
