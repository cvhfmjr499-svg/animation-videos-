// Synthesizes the soundtrack (48 kHz stereo WAV) from the shared cue sheet — no samples, no deps.
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

// --- arrangement (A minor → resolves to C major / hopeful at the end) ---
// Scene 1–3: drone builds; warm tension
drone(0, 9.0, 33, 0.22, 0.004, 0.03);                       // A1
pad(0.2, 3.0, [57, 64, 69, 72], 0.05, 1.0, 0.6, 0.03);        // Am — calm, sunlight
[0.4, 0.9, 1.4, 1.9, 2.4].forEach((t, i) => sparkle(t, [81, 84, 88, 86, 84][i], 0.05));
pad(3.0, 6.0, [57, 64, 65, 72], 0.06, 0.5, 0.5, 0.04);        // Am(b6) — unease
for (let i = 0; i < 24; i++) bassNote(3.0 + i * 0.125, 0.12, 33 + (i % 8 === 6 ? 3 : 0), 0.16, 0.05);  // 8th pulse, CO2 rising
pad(6.0, 9.0, [56, 62, 65, 71], 0.08, 0.3, 0.3, 0.06);        // dim — the trap
for (let i = 0; i < 24; i++) bassNote(6.0 + i * 0.125, 0.12, 33, 0.22, 0.09 + i * 0.006);         // driving 16ths-ish, brightening
[7.5, 8.0, 8.5].forEach(t => heartbeat(t, 0.9));
// Scene 4: consequences — hits + low ostinato
for (let i = 0; i < 12; i++) bassNote(9.0 + i * 0.25, 0.24, [29, 29, 31, 32][Math.floor(i / 3)], 0.26, 0.1);
pad(9.0, 12.0, [53, 60, 64, 69], 0.06, 0.2, 0.3, 0.05);       // F → tension
C.cards.forEach(t => slam(t, 0.75));
// Scene 5: resolution
pad(12.0, 13.3, [48, 55, 60, 64, 67], 0.07, 0.05, 0.4, 0.06); // C major
pad(13.3, 15.0, [48, 55, 62, 64, 67, 71], 0.08, 0.6, 0.6, 0.05); // Cmaj9 — hope
[12.25, 12.5, 12.75, 13.0, 13.3, 13.55, 13.8, 14.05, 14.3].forEach((t, i) => pluck(t, [72, 76, 79, 83, 84, 79, 76, 83, 88][i], 0.12, i % 2 ? 0.4 : -0.4));
sparkle(13.95, 96, 0.05); sparkle(14.05, 91, 0.04);

// Hits & transitions
C.softHits.forEach(t => boom(t, 0.4, 90, 40));
C.impacts.forEach(t => boom(t, 1.0));
C.whooshes.forEach((t, i) => whoosh(t - 0.05, 0.55, 0.45, i % 2 ? 0.8 : -0.8, i % 2 ? -0.8 : 0.8));
C.risers.forEach(([a, b]) => riser(a, b, 0.32));

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
