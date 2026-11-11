// Synthesizes the soundtrack (48 kHz stereo WAV) from the shared cue sheet — no samples, no deps.
// Instruments shared with ../climate-change-teaser/audio.cjs; arrangement below is specific to this film.
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

// --- arrangement (F major / D minor) ---
const r = (() => { let s = 99; return () => ((s = (s * 48271) % 2147483647) / 2147483647); })();
// 0–6.6: the cloud + counter
whoosh(0.0, 0.9, 0.6, -0.9, 0.9);
boom(0.12, 0.45, 90, 38);
pad(0.0, 6.6, [53, 57, 60, 64], 0.06, 1.2, 0.5, 0.025);
for (let i = 0; i < 16; i++) pluck(0.3 + r() * 2.8, [84, 88, 91, 96][i % 4], 0.035, r() * 1.6 - 0.8);
boom(3.0, 0.5, 100, 40);
for (let i = 0; i < 12; i++) bassNote(3.0 + i * 0.5, 0.45, 38, 0.2, 0.04);
{ // counter tick-roll, decelerating with the number
  let t = C.counter[0];
  for (let i = 0; t < C.counter[1]; i++) { click(t, 0.09, 2200 + i * 25, (i % 2 ? 0.3 : -0.3)); t += 0.025 + 0.25 * Math.pow((t - C.counter[0]) / (C.counter[1] - C.counter[0]), 2.2); }
}
[4.3, 4.42, 4.54].forEach((t, i) => sparkle(t, [81, 84, 89][i], 0.06));
// 6.6–9.4: search pill
whoosh(6.55, 0.5, 0.35, 0.6, -0.6);
sparkle(6.7, 93, 0.05);
pad(6.6, 9.4, [50, 57, 60, 64, 69], 0.045, 0.4, 0.2, 0.03);
{ const n = C.query.length, [a, b] = [C.search.typeStart, C.search.typeEnd];
  for (let i = 0; i < n; i++) click(a + (b - a) * (i / n) + (r() - 0.5) * 0.015, 0.1 + r() * 0.04, 1800 + r() * 1400, (r() - 0.5) * 0.4); }
click(C.search.send, 0.2, 1500); pluck(C.search.send, 88, 0.1);
riser(8.75, 9.38, 0.35);
// 9.4–12.4: burst into light trails
boom(9.4, 1.0, 150, 36);
pad(9.4, 12.4, [41, 53, 60, 64, 67, 72], 0.07, 0.3, 0.3, 0.05);
{ const pat = [65, 69, 72, 76, 79, 76, 72, 69];
  for (let i = 0; i < 40; i++) pluck(9.45 + i * 0.0625, pat[i % 8] + (i >= 16 ? 12 : 0) * (i % 2), 0.06 + 0.02 * (i / 40), i % 2 ? 0.5 : -0.5); }
riser(11.6, 12.38, 0.3);
// 12.4–16.85: light UI — gentle groove
boom(12.4, 0.55, 120, 45); sparkle(12.42, 96, 0.06);
const CH = [[12.4, 34, [62, 65, 69, 72]], [13.25, 36, [64, 67, 72, 76]], [14.05, 38, [62, 65, 69, 72]], [14.85, 36, [64, 67, 72, 74]], [15.6, 34, [62, 65, 70, 74]], [16.2, 36, [64, 67, 72, 76]]];
CH.forEach(([t0, b, notes], i) => {
  const t1 = i + 1 < CH.length ? CH[i + 1][0] : 16.85;
  pad(t0, t1, notes.map(n => n - 12), 0.035, 0.08, 0.15, 0.04);
  for (let t = t0; t < t1 - 0.01; t += 0.25) bassNote(t, 0.22, b, 0.17, 0.06);
  let k = 0; for (let t = t0; t < t1 - 0.01; t += 0.25, k++) pluck(t, notes[k % 4] + 12, 0.035, k % 2 ? 0.45 : -0.45);
});
for (let t = 12.4; t < 16.85; t += 0.5) kick(t, 0.42);
for (let t = 12.65; t < 16.85; t += 0.5) hat(t, 0.06, 0.3);
for (let t = 12.4; t < 16.85; t += 0.125) hat(t, 0.015, -0.3);
C.blocks.forEach((t0, bi) => {
  const q = C.pillQueries[bi];
  for (let i = 0; i < q.length; i++) click(t0 + 0.15 + 0.7 * (i / q.length), 0.05, 2000 + r() * 1200, 0.1);
});
const [A, Bb, Cc] = C.blocks;
pluck(A + 0.25, 84, 0.1, 0.4); pluck(A + 0.5, 79, 0.08, -0.3);
for (let i = 0; i < 15; i++) pluck(Bb + 0.25 + i * 0.045, 62 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24][i], 0.05, -0.6 + i * 0.08);
for (let i = 0; i < 6; i++) { pluck(Cc + 0.1 + i * 0.07, [72, 76, 79, 84, 88, 91][i], 0.08, (i % 3 - 1) * 0.5); click(Cc + 0.1 + i * 0.07, 0.05, 1200); }
whoosh(Bb - 0.15, 0.5, 0.2, 0, 0); whoosh(Cc - 0.15, 0.5, 0.2, 0, 0);
// 16.85–20: finale
whoosh(16.8, 0.5, 0.4, 0.8, -0.8);
drone(17.0, 17.7, 26, 0.12, 0.002, 0.02);
riser(17.15, 17.62, 0.25);
boom(C.finale.reveal, 1.0, 140, 34);
pad(C.finale.reveal, 20.0, [41, 48, 57, 60, 65, 69, 72], 0.075, 0.25, 1.2, 0.05);
[0, 0.12, 0.24, 0.36].forEach((d, i) => pluck(C.finale.tagline + d, [77, 81, 84, 89][i], 0.07, i % 2 ? 0.4 : -0.4));
sparkle(C.finale.end + 0.4, 96, 0.05); sparkle(C.finale.end + 0.5, 101, 0.035);

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
