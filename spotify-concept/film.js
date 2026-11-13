// Spotify "Live Rooms" — fan concept, 10 s (16:9). Deterministic canvas renderer:
// every frame is a pure function of t → window.__maTimeline.seek(t) (used by render.cjs).
// People, rooms, songs and covers are invented. The Spotify logo symbol is not reproduced.
(() => {
  const C = window.CUES, W = C.width, H = C.height, DUR = C.duration, BEAT = 60 / C.bpm;
  const cv = document.getElementById('c');
  const mainCtx = cv.getContext('2d');
  let ctx = mainCtx;
  const swapCtx = (c2, fn) => { const k = ctx; ctx = c2; try { fn(); } finally { ctx = k; } };

  // ---------- math ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, t) => clamp((t - a) / (b - a));
  const E = {
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: x => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const decay = (t, c, k) => (t < c ? 0 : Math.exp(-(t - c) * k));
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  // beat envelope: 1 on each beat, decaying — only while the groove plays
  const beatPulse = t => {
    const [a, b] = C.groove; if (t < a || t >= b) return 0;
    const ph = ((t - a) % BEAT) / BEAT; return Math.exp(-ph * 7);
  };

  // ---------- type ----------
  const SANS = (w, s) => `${w} ${s}px "Inter"`;
  const DISP = (w, s) => `${w} ${s}px "Inter Display"`;
  const SERIF = s => `italic 400 ${s}px "Instrument Serif", "Inter"`;
  const WHITE = [255, 255, 255];
  const PINK = [250, 35, 59], PINK2 = [255, 92, 118];

  function txt(str, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font || SANS(500, 32);
    ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.glow) { ctx.shadowColor = o.glowColor || 'rgba(255,255,255,0.5)'; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = typeof o.color === 'string' || o.color instanceof CanvasGradient ? o.color : rgba(o.color || WHITE);
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  const measure = (str, font, ls = 0) => { ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w; };
  // segments on one line, each rising out of a blur on its own beat
  function segLine(segs, x, y, t, o = {}) {
    const widths = segs.map(s => measure(s.s, s.font, s.ls || 0));
    const gap = o.gap ?? 0, total = widths.reduce((a, b) => a + b, 0) + gap * (segs.length - 1);
    let cx = o.align === 'center' ? x - total / 2 : x;
    segs.forEach((s, i) => {
      const p = inv(s.t0, s.t0 + (s.dur ?? 0.6), t);
      if (p > 0) {
        const e = E.outExpo(p);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2.5) * (s.alpha ?? 1);
        if (e < 0.98) ctx.filter = `blur(${(1 - e) * 16}px)`;
        txt(s.s, cx, y + (1 - e) * (s.dy ?? 50), { font: s.font, color: s.color || WHITE, ls: s.ls, glow: s.glow, glowColor: s.glowColor });
        ctx.restore();
      }
      cx += widths[i] + gap;
    });
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- invented album covers ----------
  const PALS = [
    ['#ff4e6a', '#ffb36b'], ['#7a3cff', '#ff4ed8'], ['#00c2ff', '#6a3cff'], ['#ffd34e', '#ff5a3c'],
    ['#1fd1a5', '#1a5cff'], ['#ff8a00', '#e52e71'], ['#f5f5f5', '#9aa0b4'], ['#2b2b40', '#ff4e6a'],
    ['#ff6ac1', '#ffd36a'], ['#3cffb4', '#0a6c74'], ['#b06aff', '#1c1c3a'], ['#ff3c3c', '#2a0a14'],
  ];
  const COVERS = [];
  function bakeCover(i) {
    const S = 300, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), r = rng(500 + i), [a, b] = PALS[i % PALS.length];
    const lg = g.createLinearGradient(0, 0, S, S); lg.addColorStop(0, a); lg.addColorStop(1, b);
    g.fillStyle = lg; g.fillRect(0, 0, S, S);
    const kind = i % 6;
    g.globalCompositeOperation = 'source-over';
    if (kind === 0) { // sun
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(S * 0.5, S * 0.58, S * 0.22, 0, TAU); g.fill();
      for (let k = 0; k < 5; k++) { g.fillStyle = b; g.fillRect(0, S * (0.62 + k * 0.07), S, S * 0.025); }
    } else if (kind === 1) { // rings
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 6;
      for (let k = 1; k < 7; k++) { g.beginPath(); g.arc(S * 0.5, S * 0.5, k * 22, 0, TAU); g.stroke(); }
    } else if (kind === 2) { // blobs
      for (let k = 0; k < 4; k++) { const x = r() * S, y = r() * S, rad = 60 + r() * 120, rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, S, S); }
    } else if (kind === 3) { // waves
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 8;
      for (let k = 0; k < 8; k++) { g.beginPath(); for (let x = 0; x <= S; x += 6) g.lineTo(x, 30 + k * 36 + Math.sin(x / 30 + k) * 12); g.stroke(); }
    } else if (kind === 4) { // grid dots
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) { g.beginPath(); g.arc(30 + x * 48, 30 + y * 48, 4 + ((x + y) % 3) * 4, 0, TAU); g.fill(); }
    } else { // big type block
      const word = ['NOVA', 'GLOW', 'ECHO', 'NEON', 'WAVE', 'BLOOM'][((i / 6) | 0) % 6];
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.textBaseline = 'alphabetic';
      let fs = 130; g.font = DISP(800, fs); const mw = g.measureText(word).width;
      if (mw > S - 36) { fs = Math.floor(fs * (S - 36) / mw); g.font = DISP(800, fs); }
      g.fillText(word, 18, S - 24);
    }
    // subtle vinyl sheen
    const sh = g.createLinearGradient(0, 0, S, S); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = sh; g.fillRect(0, 0, S, S);
    return c;
  }
  function coverDraw(img, x, y, s, r = 18) {
    ctx.save(); rr(x, y, s, s, r); ctx.clip(); ctx.drawImage(img, x, y, s, s); ctx.restore();
  }

  // ================= Spotify "Live Rooms" concept =================
  const GREEN = [30, 215, 96], GRAY = [167, 167, 167], CARD = '#181818', CHIP = '#2a2a2a';
  const PEOPLE = [['Mia', '#ff6ac1', '#7a3cff'], ['Leo', '#ffb34e', '#ff4e3c'], ['Ava', '#3cc8ff', '#2b4fd8'], ['Noah', '#3cffb4', '#0a8c64'], ['Zoe', '#ffd36a', '#c26a1f']];
  function avatar(i, x, y, r, ring = 0) {
    const [name, a, b] = PEOPLE[i % PEOPLE.length];
    ctx.save();
    if (ring > 0) { ctx.strokeStyle = rgba(GREEN, ring); ctx.lineWidth = Math.max(2, r * 0.12); ctx.beginPath(); ctx.arc(x, y, r + r * 0.16, 0, TAU); ctx.stroke(); }
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#121212'; ctx.lineWidth = Math.max(2, r * 0.08); ctx.stroke();
    txt(name[0], x, y + r * 0.02, { font: SANS(700, r * 0.95), align: 'center', base: 'middle', color: [255, 255, 255] });
    ctx.restore();
  }
  function chip(label, x, y, state, o = {}) { // state 0..1 → grey → green
    const f = SANS(600, 30), w = measure(label, f) + 60 + (o.dot ? 28 : 0), h = 64;
    rr(x, y, w, h, 32);
    ctx.fillStyle = state > 0 ? rgba([lerp(42, 30, state), lerp(42, 215, state), lerp(42, 96, state)]) : CHIP; ctx.fill();
    if (o.outline) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.stroke(); }
    let tx = x + 30;
    if (o.dot) { ctx.fillStyle = state > 0.5 ? '#000' : rgba(GREEN); ctx.beginPath(); ctx.arc(tx + 8, y + h / 2, 8, 0, TAU); ctx.fill(); tx += 28; }
    txt(label, tx, y + h / 2 + 1, { font: f, base: 'middle', color: state > 0.5 ? [0, 0, 0] : [255, 255, 255] });
    return w;
  }
  function ambient(t, k = 1) {
    ctx.fillStyle = '#060706'; ctx.fillRect(0, 0, W, H);
    const blobs = [[0.15, 0.2, 900, 0.32], [0.85, 0.3, 800, 0.2], [0.5, 1.05, 1000, 0.25]];
    blobs.forEach(([bx, by, rad, a], i) => {
      const x = W * bx + Math.sin(t * 0.5 + i * 2) * 120, y = H * by + Math.cos(t * 0.4 + i) * 80;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba([20, 160, 70], a * k)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
  }
  function camera(cx, cy, s) { ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-cx, -cy); }
  const key = (t, frames, ease = E.inOutCubic) => { // piecewise camera keyframes [t, cx, cy, s]
    if (t <= frames[0][0]) return frames[0].slice(1);
    for (let i = 1; i < frames.length; i++) {
      const [t1, ...b] = frames[i], [t0, ...a] = frames[i - 1];
      if (t <= t1) { const e = ease(inv(t0, t1, t)); return a.map((v, k) => lerp(v, b[k], e)); }
    }
    return frames[frames.length - 1].slice(1);
  };

  // ---------- scene 1: home → Live chip → Live Rooms list ----------
  const ROOMS = [['Late Night Drive', 'Neon Rain · Kairo', 3, 0, 7], ['Gym Session', 'Run It Up · VANTA', 9, 1, 4], ['Study Lofi', 'Paper Moons · Elio', 4, 2, 12]];
  function sceneHome(t) {
    ambient(t);
    const tap = C.tap, sw = E.inOutCubic(inv(tap + 0.05, tap + 0.45, t));
    const [cx, cy, s] = key(t, [[0, 760, 300, 1.75], [1.1, 900, 280, 1.5], [1.5, 960, 380, 1.35], [2.2, 900, 420, 1.45], [2.6, 820, 400, 3.4]], E.inOutSine);
    ctx.save(); camera(cx, cy, s);
    // chips row
    const y0 = 190; let x = 470;
    avatar(0, x + 32, y0 + 32, 32); x += 84;
    x += chip('All', x, y0, 1 - sw) + 16;
    x += chip('Friends', x, y0, 0) + 16;
    x += chip('Podcasts', x, y0, 0) + 16;
    const lx = x; chip('Live', x, y0, sw, { dot: true, outline: t > tap - 0.25 && sw < 0.5 });
    // finger tap ripple
    const tp = inv(tap - 0.2, tap + 0.5, t);
    if (tp > 0 && tp < 1) {
      const fx = lx + 70, fy = y0 + 32;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * Math.sin(Math.PI * tp)})`; ctx.beginPath(); ctx.arc(fx, fy, 26 + 6 * Math.sin(Math.PI * tp), 0, TAU); ctx.fill();
      const rp = inv(tap, tap + 0.5, t);
      if (rp > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - rp)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, fy, 26 + rp * 90, 0, TAU); ctx.stroke(); }
    }
    // default tiles (fade out on tap)
    if (sw < 1) {
      ctx.save(); ctx.globalAlpha = 1 - sw; ctx.translate(0, -sw * 30);
      const tiles = [['Liked Songs', 'heart'], ['Your Episodes', 'mark'], ['Night Drive', 1], ['Focus Flow', 4], ['Kairo Radio', 2], ['Weekend Mix', 3]];
      tiles.forEach(([name, ic], i) => {
        const tx = 470 + (i % 2) * 560, ty = 290 + ((i / 2) | 0) * 120, fade = i >= 4 ? 0.45 : 1;
        ctx.save(); ctx.globalAlpha *= fade;
        rr(tx, ty, 540, 104, 10); ctx.fillStyle = '#1f1f1f'; ctx.fill();
        ctx.save(); rr(tx, ty, 104, 104, 10); ctx.clip();
        if (ic === 'heart') { const g = ctx.createLinearGradient(tx, ty, tx + 104, ty + 104); g.addColorStop(0, '#4a2bd8'); g.addColorStop(1, '#a9c6f0'); ctx.fillStyle = g; ctx.fillRect(tx, ty, 104, 104); txt('♥', tx + 52, ty + 54, { font: SANS(700, 46), align: 'center', base: 'middle' }); }
        else if (ic === 'mark') { ctx.fillStyle = '#056952'; ctx.fillRect(tx, ty, 104, 104); ctx.fillStyle = rgba(GREEN); ctx.beginPath(); ctx.moveTo(tx + 36, ty + 28); ctx.lineTo(tx + 68, ty + 28); ctx.lineTo(tx + 68, ty + 78); ctx.lineTo(tx + 52, ty + 66); ctx.lineTo(tx + 36, ty + 78); ctx.closePath(); ctx.fill(); }
        else ctx.drawImage(COVERS[ic], tx, ty, 104, 104);
        ctx.restore();
        txt(name, tx + 130, ty + 62, { font: SANS(700, 30) });
        ctx.restore();
      });
      ctx.restore();
    }
    // live rooms list
    if (sw > 0) {
      const ap = (i) => E.outExpo(inv(tap + 0.2 + i * 0.08, tap + 0.8 + i * 0.08, t));
      ctx.save(); ctx.globalAlpha = ap(0); ctx.translate(0, (1 - ap(0)) * 40);
      txt('Live Rooms', 470, 345, { font: DISP(700, 52) });
      const pulse = 0.5 + 0.5 * Math.sin(t * 8);
      ctx.fillStyle = rgba(GREEN); ctx.beginPath(); ctx.arc(800, 328, 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(GREEN, 0.5 * (1 - pulse)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(800, 328, 9 + pulse * 12, 0, TAU); ctx.stroke();
      txt('3 active now', 822, 340, { font: SANS(600, 28), color: GREEN });
      ctx.restore();
      ROOMS.forEach(([name, track, cov, a0, n], i) => {
        const e = ap(i + 1); if (e <= 0) return;
        const ry = 390 + i * 170;
        ctx.save(); ctx.globalAlpha = Math.min(1, e * 1.5); ctx.translate(0, (1 - e) * 60);
        rr(470, ry, 1100, 150, 18); ctx.fillStyle = i === 0 ? '#1d2a21' : CARD; ctx.fill();
        if (i === 0) { ctx.strokeStyle = rgba(GREEN, 0.5); ctx.lineWidth = 2; ctx.stroke(); }
        coverDraw(COVERS[cov], 490, ry + 20, 110, 10);
        txt(name, 630, ry + 66, { font: SANS(700, 36) });
        txt(track, 630, ry + 108, { font: SANS(500, 28), color: GRAY });
        for (let k = 3; k >= 0; k--) avatar((a0 + k) % 5, 1260 + k * 40, ry + 75, 28, 0);
        txt('+' + n, 1440, ry + 85, { font: SANS(600, 28), color: GRAY });
        rr(1490, ry + 55, 62, 40, 8); ctx.fillStyle = rgba(GREEN); ctx.fill();
        txt('LIVE', 1521, ry + 76, { font: SANS(800, 18), align: 'center', base: 'middle', color: [0, 0, 0], ls: 1 });
        ctx.restore();
      });
    }
    ctx.restore();
  }

  // ---------- scene 2: inside the room ----------
  const EMO = ['❤️', '🔥', '🎧', '🔥', '❤️', '✨'];
  function sceneRoom(t) {
    ambient(t, 1.2);
    const [cx, cy, s] = key(t, [[2.6, 700, 470, 2.4], [3.0, 760, 480, 1.35], [3.6, 980, 520, 1.3], [4.2, 1180, 560, 1.38], [4.6, 1500, 560, 1.6]], E.inOutSine);
    ctx.save(); camera(cx, cy, s);
    const bp = beatPulse(t);
    // cover
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
    const cs = 440 * (1 + 0.01 * bp); rr(300, 260, cs, cs, 14); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    coverDraw(COVERS[3], 300, 260, cs, 14);
    // text column
    const x0 = 820;
    rr(x0, 262, 210, 48, 24); ctx.fillStyle = rgba(GREEN); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x0 + 28, 286, 7, 0, TAU); ctx.fill();
    txt('LIVE ROOM', x0 + 46, 287, { font: SANS(800, 22), base: 'middle', color: [0, 0, 0], ls: 2 });
    txt('Late Night Drive', x0, 400, { font: DISP(800, 84), ls: -1 });
    txt('Neon Rain · Kairo', x0, 456, { font: SANS(500, 34), color: GRAY });
    // listeners, rings pulse on the beat (everyone hears the same beat)
    for (let k = 0; k < 5; k++) avatar(k, x0 + 40 + k * 92, 545, 36, 0.4 + 0.6 * bp);
    txt('+7 listening', x0 + 500, 556, { font: SANS(600, 30), color: GRAY });
    // shared progress bar with stacked playheads
    const px = x0, py = 640, pw = 860, p = lerp(0.48, 0.6, inv(2.6, 4.6, t));
    rr(px, py, pw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    rr(px, py, pw * p, 8, 4); ctx.fillStyle = rgba(GREEN); ctx.fill();
    for (let k = 4; k >= 0; k--) avatar(k, px + pw * p, py + 4 - k * 14, 20, 0);
    const sec = Math.floor(97 + (t - 2.6) * 1); txt(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, px, py + 50, { font: SANS(500, 24), color: GRAY });
    txt('3:22', px + pw, py + 50, { font: SANS(500, 24), color: GRAY, align: 'right' });
    // sync badge
    const sb = E.outBack(inv(3.1, 3.5, t));
    if (sb > 0) {
      ctx.save(); ctx.translate(px + pw * p, py + 78); ctx.scale(sb, sb);
      rr(-120, -30, 240, 60, 30); ctx.fillStyle = '#0f2a18'; ctx.fill(); ctx.strokeStyle = rgba(GREEN, 0.8); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = rgba(GREEN); ctx.beginPath(); ctx.arc(-88, 0, 7, 0, TAU); ctx.fill();
      txt('In sync · 0 ms', -70, 1, { font: SANS(700, 24), base: 'middle', color: GREEN });
      ctx.restore();
    }
    // comments
    const COM = [[0, 'this drop though'], [2, 'on repeat all night']];
    C.comments.forEach((tc, i) => {
      const e = E.outExpo(inv(tc, tc + 0.5, t)); if (e <= 0) return;
      const [who, msg] = COM[i], bx = 1230, by = 760 + i * 100;
      ctx.save(); ctx.globalAlpha = Math.min(1, e * 2); ctx.translate((1 - e) * 60, 0);
      const f = SANS(500, 28), w = measure(msg, f) + 130;
      rr(bx, by, w, 80, 40); ctx.fillStyle = '#222'; ctx.fill();
      avatar(who, bx + 40, by + 40, 24);
      txt(PEOPLE[who][0], bx + 78, by + 32, { font: SANS(700, 20), color: GRAY });
      txt(msg, bx + 78, by + 62, { font: f });
      ctx.restore();
    });
    // floating reactions
    C.reactions.forEach((tr, i) => {
      const a = inv(tr, tr + 1.4, t); if (a <= 0 || a >= 1) return;
      const x = 1835 + Math.sin(a * 6 + i) * 22 - (i % 3) * 6, y = 980 - a * 520;
      txt(EMO[i], x, y, { font: `${48 + (i % 3) * 8}px "Noto Color Emoji"`, align: 'center', alpha: Math.min(1, (1 - a) * 3) });
    });
    ctx.restore();
  }

  // ---------- scene 3: kinetic copy ----------
  // characters slide in from wide tracking (like letters assembling)
  function spread(str, x, y, t, t0, font, color, o = {}) {
    const chars = [...str], ws = chars.map(c => measure(c, font)), total = ws.reduce((a, b) => a + b, 0);
    let cx = o.align === 'center' ? x - total / 2 : x;
    const mid = total / 2;
    let acc = 0;
    chars.forEach((ch, i) => {
      const a = t0 + i * (o.stagger ?? 0.025), p = inv(a, a + (o.dur ?? 0.55), t);
      if (p > 0) {
        const e = E.outExpo(p), off = ((acc + ws[i] / 2) - mid) * 0.9 * (1 - e);
        ctx.save(); ctx.globalAlpha *= Math.min(1, p * 2);
        if (e < 0.97) ctx.filter = `blur(${(1 - e) * 8}px)`;
        txt(ch, cx + acc + off, y, { font, color, glow: o.glow, glowColor: o.glowColor });
        ctx.restore();
      }
      acc += ws[i];
    });
    return total;
  }
  function sceneText(t) {
    ambient(t, 0.8);
    const T = C.text, f = SANS(500, 92);
    // A: "Listen with your [avatars] friends."
    const outA = E.inCubic(inv(6.05, 6.25, t));
    if (t < 6.25) {
      ctx.save(); ctx.globalAlpha = 1 - outA; if (outA > 0) ctx.filter = `blur(${outA * 14}px)`;
      const w1 = measure('Listen with your ', f), w2 = 300, w3 = measure('friends.', f), total = w1 + w2 + w3;
      const x = W / 2 - total / 2, y = 575;
      spread('Listen with your', x, y, t, T.listen, f, WHITE);
      // avatar cluster pops in one by one
      for (let k = 0; k < 4; k++) {
        const e = E.outBack(inv(T.friends - 0.3 + k * 0.07, T.friends + 0.1 + k * 0.07, t)); if (e <= 0) continue;
        ctx.save(); ctx.translate(x + w1 + 50 + k * 56, y - 30); ctx.scale(e, e); avatar(k, 0, 0, 38, 0.9); ctx.restore();
      }
      spread('friends.', x + w1 + w2, y, t, T.friends, f, GREEN, { glow: 30, glowColor: 'rgba(30,215,96,0.5)' });
      ctx.restore();
    }
    // B: "Same song. / Same second."
    const outB = E.inCubic(inv(7.15, 7.35, t));
    if (t > 6.2 && t < 7.35) {
      ctx.save(); ctx.globalAlpha = 1 - outB; if (outB > 0) ctx.filter = `blur(${outB * 14}px)`;
      spread('Same song.', W / 2, 500, t, T.same1, SANS(600, 110), WHITE, { align: 'center' });
      const sw = measure('Same ', SANS(600, 110)), tw = sw + measure('second.', SANS(600, 110));
      spread('Same ', W / 2 - tw / 2, 650, t, T.same2, SANS(600, 110), WHITE);
      spread('second.', W / 2 - tw / 2 + sw, 650, t, T.same2 + 0.12, SANS(600, 110), GREEN, { glow: 34, glowColor: 'rgba(30,215,96,0.55)' });
      ctx.restore();
    }
    // C: "Wherever you are."
    if (t > 7.3) {
      const outC = E.inCubic(inv(8.1, 8.3, t));
      ctx.save(); ctx.globalAlpha = 1 - outC; if (outC > 0) ctx.filter = `blur(${outC * 14}px)`;
      const a = measure('Wherever ', f), b = measure('you', f), c = measure(' are.', f), x = W / 2 - (a + b + c) / 2;
      spread('Wherever', x, 575, t, T.wherever, f, WHITE);
      spread('you', x + a, 575, t, T.wherever + 0.2, f, GREEN, { glow: 30, glowColor: 'rgba(30,215,96,0.5)' });
      spread(' are.', x + a + b, 575, t, T.wherever + 0.3, f, WHITE);
      ctx.restore();
    }
  }

  // ---------- scene 4: logo ----------
  function sceneLogo(t) {
    ambient(t, 0.6 + 0.4 * E.outExpo(inv(8.3, 9.0, t)));
    const t0 = C.scenes.logo;
    const pop = E.outBack(inv(t0, t0 + 0.45, t));
    const slide = E.inOutCubic(inv(t0 + 0.45, t0 + 0.95, t));
    const wf = DISP(800, 150), ww = measure('Spotify', wf), vf = DISP(700, 64), vw = measure('2.0', vf);
    const r = 82, gap = 40, total = r * 2 + gap + ww + 14 + vw;
    const cx = lerp(W / 2, W / 2 - total / 2 + r, slide), cy = 500;
    // badge: generic green circle with a "live" broadcast glyph (not the Spotify logo)
    if (pop > 0) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop);
      ctx.shadowColor = 'rgba(30,215,96,0.7)'; ctx.shadowBlur = 60;
      ctx.fillStyle = rgba(GREEN); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      for (const k of [1, 2]) for (const d of [-1, 1]) { ctx.globalAlpha = k === 2 ? 0.55 + 0.45 * pulse : 1; ctx.beginPath(); ctx.arc(0, 0, 18 + k * 16, d > 0 ? -0.75 : Math.PI - 0.75, d > 0 ? 0.75 : Math.PI + 0.75); ctx.stroke(); }
      ctx.restore();
    }
    // wordmark revealed from behind the badge
    if (slide > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx + r * 0.6, 0, W, H); ctx.clip();
      const wx = cx + r + gap - (1 - slide) * 140;
      ctx.globalAlpha = slide;
      txt('Spotify', wx, cy + 52, { font: wf, ls: -2 });
      const vp = E.outBack(inv(t0 + 0.85, t0 + 1.2, t));
      if (vp > 0) { ctx.save(); ctx.translate(wx + ww + 14 + vw / 2, cy - 30); ctx.scale(vp, vp); txt('2.0', 0, 0, { font: vf, color: GREEN, align: 'center', glow: 30, glowColor: 'rgba(30,215,96,0.6)' }); ctx.restore(); }
      ctx.restore();
    }
    segLine([{ s: 'Introducing', font: SANS(500, 40), color: GRAY, t0: t0 + 1.05, dy: 20 }, { s: 'Live Rooms', font: SANS(700, 40), color: WHITE, t0: t0 + 1.15, dy: 20 }], W / 2, 680, t, { align: 'center', gap: 12 });
    txt('Fan concept · Not affiliated with Spotify', W / 2, 1035, { font: SANS(400, 20), color: [110, 110, 110], align: 'center', alpha: inv(t0 + 1.2, t0 + 1.6, t) });
  }

  // ---------- grain ----------
  const GRAIN = [];
  for (let k = 0; k < 4; k++) {
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const gc = g.getContext('2d'), id = gc.createImageData(256, 256), r = rng(100 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gc.putImageData(id, 0, 0); GRAIN.push(mainCtx.createPattern(g, 'repeat'));
  }

  // ---------- master: real motion blur via temporal supersampling during fast camera moves ----------
  const acc = document.createElement('canvas'); acc.width = W; acc.height = H;
  const accCtx = acc.getContext('2d');
  function drawScene(t) {
    const S = C.scenes;
    if (t < S.room) sceneHome(t);
    else if (t < S.text) sceneRoom(t);
    else if (t < S.logo) sceneText(t);
    else sceneLogo(t);
  }
  const blurAmount = t => Math.max(...C.whips.map(w => Math.exp(-Math.pow((t - (w + 0.08)) / 0.12, 2))), 0.25 * Math.exp(-Math.pow((t - 2.75) / 0.12, 2)));
  function render(t) {
    t = clamp(t, 0, DUR - 1e-4);
    const b = blurAmount(t), N = b > 0.05 ? Math.round(4 + b * 12) : 1, shutter = 0.09 * b;
    if (N === 1) {
      ctx = mainCtx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
      drawScene(t); ctx.restore();
    } else {
      accCtx.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        const st = clamp(t + (i / (N - 1) - 0.5) * shutter, 0, DUR - 1e-4);
        ctx = mainCtx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
        drawScene(st); ctx.restore();
        accCtx.globalAlpha = 1 / (i + 1); accCtx.drawImage(cv, 0, 0);
      }
      mainCtx.save(); mainCtx.globalAlpha = 1; mainCtx.drawImage(acc, 0, 0); mainCtx.restore();
    }
    ctx = mainCtx;
    // dip to black inside the whip into the text section
    const dip = Math.exp(-Math.pow((t - 4.6) / 0.1, 2));
    if (dip > 0.01) { ctx.fillStyle = `rgba(0,0,0,${0.9 * dip})`; ctx.fillRect(0, 0, W, H); }
    const fl = 0.35 * decay(t, C.scenes.logo, 8);
    if (fl > 0.005) { ctx.fillStyle = `rgba(200,255,220,${fl})`; ctx.fillRect(0, 0, W, H); }
    const fi = 1 - inv(0, 0.25, t); if (fi > 0) { ctx.fillStyle = `rgba(0,0,0,${fi})`; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const fr = Math.floor(t * C.fps);
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    ctx.translate((fr * 37) % 256, (fr * 91) % 256); ctx.fillStyle = GRAIN[fr % 4]; ctx.fillRect(-256, -256, W + 512, H + 512);
    ctx.restore();
  }

  // ---------- API + preview ----------
  const renderMode = new URLSearchParams(location.search).has('render');
  let cur = 0, playing = false, last = 0;
  window.__maTimeline = { duration: DUR, fps: C.fps, seek: t => { cur = t; render(t); } };
  const fontsReady = Promise.all([
    document.fonts.load(DISP(800, 100)), document.fonts.load(DISP(700, 100)), document.fonts.load(SANS(500, 30)), document.fonts.load(SANS(600, 30)),
    document.fonts.load(SANS(700, 30)), document.fonts.load(SANS(800, 30)), document.fonts.load(SANS(400, 30)), document.fonts.load('48px "Noto Color Emoji"', '❤️🔥🎧✨'),
  ]).catch(() => {});
  window.__ready = fontsReady.then(() => { for (let i = 0; i < 12; i++) COVERS.push(bakeCover(i)); render(0); return true; });
  if (!renderMode) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = now => { if (playing) { cur += (now - last) / 1000; if (cur >= DUR) cur = 0; render(cur); } last = now; requestAnimationFrame(loop); };
    window.__ready.then(() => { if (reduce) { cur = DUR - 0.05; render(cur); } else playing = true; requestAnimationFrame(n => { last = n; loop(n); }); });
    cv.addEventListener('click', () => { playing = !playing; });
    addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { playing = false; cur = clamp(cur + (e.key === 'ArrowRight' ? 0.1 : -0.1), 0, DUR); render(cur); }
      if (e.key === ' ') playing = !playing;
    });
  }
})();
