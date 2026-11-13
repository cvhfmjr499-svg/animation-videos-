// Apple Music — inoffizielles 10-Sekunden-Promo (16:9). Deterministic canvas renderer:
// every frame is a pure function of t → window.__maTimeline.seek(t) (used by render.cjs).
// Songs, artists and covers are invented. No Apple logo / app icon is reproduced.
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

  // ================= A: cover wall — „Über 100 Millionen Songs." =================
  function sceneCovers(t) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const zoomIn = E.outExpo(inv(0, 1.3, t)), out = E.inExpo(inv(1.7, 2.0, t));
    const scale = lerp(1.35, 1.0, zoomIn) * (1 + out * 0.9);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(-0.21); ctx.scale(scale, scale);
    const size = 236, gap = 26, step = size + gap, cols = 11;
    if (out > 0.02) ctx.filter = `blur(${out * 14}px)`;
    for (let c = 0; c < cols; c++) {
      const dir = c % 2 ? 1 : -1, off = dir * t * 150 + c * 77;
      const x = (c - (cols - 1) / 2) * step - size / 2;
      for (let k = -5; k <= 5; k++) {
        const y = ((k * step + off) % (step * 11) + step * 11) % (step * 11) - step * 5.5 - size / 2;
        coverDraw(COVERS[(c * 7 + k + 50) % COVERS.length], x, y, size);
      }
    }
    ctx.restore();
    // darken centre for the headline
    const vg = ctx.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, 1050);
    vg.addColorStop(0, 'rgba(0,0,0,0.9)'); vg.addColorStop(0.55, 'rgba(0,0,0,0.6)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    { ctx.save(); ctx.translate(W / 2, 590); ctx.scale(1.9, 0.75); const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 520);
      sg.addColorStop(0, 'rgba(0,0,0,0.85)'); sg.addColorStop(0.6, 'rgba(0,0,0,0.6)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(-600, -600, 1200, 1200); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = 1 - out;
    segLine([{ s: 'Über 100 Millionen', font: DISP(800, 150), t0: 0.2, ls: -3 }], W / 2, 520, t, { align: 'center' });
    const pg = ctx.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0); pg.addColorStop(0, rgba(PINK2)); pg.addColorStop(1, rgba(PINK));
    segLine([{ s: 'Songs.', font: SERIF(210), color: pg, t0: 0.5, dur: 0.7, glow: 50, glowColor: 'rgba(250,35,59,0.55)' }], W / 2, 720, t, { align: 'center' });
    ctx.restore();
  }

  // ================= B: spatial audio orb =================
  const RINGS = [0, 1, 2].map(i => ({ R: 290 + i * 80, tilt: 1.15 + i * 0.12, roll: (i - 1) * 0.45, sp: 0.9 - i * 0.22, n: 150 + i * 30, col: [[255, 92, 118], [190, 90, 255], [90, 160, 255]][i] }));
  function sceneSpatial(t) {
    const lt = t - 2.0, bp = beatPulse(t);
    ctx.fillStyle = '#030206'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = 400;
    const intro = E.outExpo(inv(2.0, 2.6, t));
    // ambient glow
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 800);
    g.addColorStop(0, `rgba(250,35,90,${0.28 + 0.12 * bp})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // beat shockwaves
    for (let k = 0; k < 4; k++) {
      const bt = 2.0 + k * BEAT, p = inv(bt, bt + 1.0, t); if (p <= 0 || p >= 1) continue;
      ctx.strokeStyle = `rgba(255,120,150,${0.5 * (1 - p)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, 120 + p * 700, (120 + p * 700) * 0.42, 0, 0, TAU); ctx.stroke();
    }
    // particles (split by depth around the orb)
    const pts = [];
    RINGS.forEach((ring, ri) => {
      const ct = Math.cos(ring.tilt), st = Math.sin(ring.tilt), cr = Math.cos(ring.roll), sr = Math.sin(ring.roll);
      for (let i = 0; i < ring.n; i++) {
        const a = (i / ring.n) * TAU + lt * ring.sp * (ri % 2 ? -1 : 1);
        const R = ring.R * intro * (1 + 0.03 * Math.sin(i * 3.1 + lt * 4));
        let x = Math.cos(a) * R, y = 0, z = Math.sin(a) * R;
        let y2 = y * ct - z * st, z2 = y * st + z * ct; y = y2; z = z2;
        const x2 = x * cr - y * sr; y2 = x * sr + y * cr; x = x2; y = y2;
        const f = 1400 / (1400 + z);
        pts.push({ x: cx + x * f, y: cy + y * f, z, f, col: ring.col, s: (i % 5 === 0 ? 5 : 2.6) });
      }
    });
    const drawPts = front => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of pts) {
        if ((p.z < 0) !== front) continue;
        const a = front ? 0.95 : 0.4;
        ctx.fillStyle = rgba(p.col, a);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * p.f * (1 + bp * 0.4), 0, TAU); ctx.fill();
      }
      ctx.restore();
    };
    drawPts(false);
    // orb
    const or = 120 * intro * (1 + 0.06 * bp);
    g = ctx.createRadialGradient(cx - or * 0.35, cy - or * 0.4, or * 0.1, cx, cy, or);
    g.addColorStop(0, '#ffd1da'); g.addColorStop(0.45, rgba(PINK2)); g.addColorStop(1, '#8a1030');
    ctx.save(); ctx.shadowColor = 'rgba(250,35,59,0.9)'; ctx.shadowBlur = 90;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, or, 0, TAU); ctx.fill(); ctx.restore();
    drawPts(true);
    // copy
    const out = E.inCubic(inv(3.75, 3.95, t));
    ctx.save(); ctx.globalAlpha = 1 - out;
    segLine([{ s: 'Spatial Audio', font: DISP(800, 128), t0: 2.2, ls: -2 }], W / 2, 905, t, { align: 'center' });
    segLine([
      { s: 'mit Dolby Atmos.', font: SANS(500, 42), color: [200, 200, 212], t0: 2.55, dy: 24 },
      { s: 'Dazu Lossless Audio.', font: SANS(500, 42), color: PINK2, t0: 2.75, dy: 24 },
    ], W / 2, 980, t, { align: 'center', gap: 16 });
    ctx.restore();
    // orb swells into the next scene
    const sw = E.inExpo(inv(3.7, 4.0, t));
    if (sw > 0) {
      ctx.fillStyle = rgba([40, 6, 22], sw); ctx.beginPath(); ctx.arc(cx, cy, or + sw * 1500, 0, TAU); ctx.fill();
    }
  }

  // ================= C: player + live lyrics =================
  let NOW_COVER;
  function lyricBg(t) {
    ctx.fillStyle = '#28061a'; ctx.fillRect(0, 0, W, H);
    const blobs = [[0.2, 0.3, [255, 78, 106], 700], [0.75, 0.25, [122, 60, 255], 650], [0.55, 0.8, [255, 138, 60], 700], [0.1, 0.85, [214, 31, 105], 600], [0.9, 0.7, [255, 60, 140], 600]];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    blobs.forEach(([bx, by, col, rad], i) => {
      const x = W * bx + Math.sin(t * 0.7 + i * 1.7) * 140, y = H * by + Math.cos(t * 0.6 + i) * 100;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(col, 0.45)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
    ctx.fillStyle = 'rgba(10,0,8,0.35)'; ctx.fillRect(0, 0, W, H);
  }
  function icon(k, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#fff';
    if (k === 'pause') { rr(-14, -20, 10, 40, 3); ctx.fill(); rr(4, -20, 10, 40, 3); ctx.fill(); }
    else { const d = k === 'next' ? 1 : -1; for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.moveTo(d * (-16 + j * 16), -14); ctx.lineTo(d * (j * 16), 0); ctx.lineTo(d * (-16 + j * 16), 14); ctx.closePath(); ctx.fill(); } }
    ctx.restore();
  }
  function sceneLyrics(t) {
    lyricBg(t);
    const bp = beatPulse(t);
    const rise = (t0, fn, dy = 40) => {
      const p = inv(t0, t0 + 0.55, t); if (p <= 0) return;
      const e = E.outExpo(p); ctx.save(); ctx.globalAlpha *= Math.min(1, p * 2.5); ctx.translate(0, (1 - e) * dy);
      if (e < 0.97) ctx.filter = `blur(${(1 - e) * 10}px)`; fn(); ctx.restore();
    };
    const out = E.inCubic(inv(6.3, 6.5, t));
    ctx.save(); ctx.globalAlpha = 1 - out;
    // player column
    const px = 170;
    rise(4.02, () => {
      const s = 330 * (1 + 0.012 * bp);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
      rr(px, 170, s, s, 22); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
      coverDraw(NOW_COVER, px, 170, s, 22);
    }, 60);
    rise(4.12, () => {
      txt('Midnight Bloom', px, 580, { font: SANS(700, 40) });
      txt('Nova Lane', px, 626, { font: SANS(500, 32), color: [255, 210, 220], alpha: 0.8 });
    });
    rise(4.2, () => {
      const p = lerp(0.31, 0.47, inv(4.0, 6.5, t));
      rr(px, 668, 330, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
      rr(px, 668, 330 * p, 8, 4); ctx.fillStyle = '#fff'; ctx.fill();
      txt('1:12', px, 708, { font: SANS(500, 20), color: [255, 220, 230], alpha: 0.7 });
      txt('−2:31', px + 330, 708, { font: SANS(500, 20), color: [255, 220, 230], alpha: 0.7, align: 'right' });
      icon('prev', px + 75, 780, 1.1); icon('pause', px + 165, 780, 1.25 * (1 + 0.05 * bp)); icon('next', px + 255, 780, 1.1);
    });
    // lyrics column
    const lx = 690, lh = 118, L = C.lyrics, times = C.lyricLines;
    let cur = -1; times.forEach((tt, i) => { if (t >= tt) cur = i; });
    // smooth scroll so the active line sits at y≈470
    let scroll = 0;
    times.forEach((tt, i) => { scroll += E.inOutCubic(inv(tt - 0.15, tt + 0.25, t)) * (i ? lh : 0); });
    rise(4.15, () => {
      rr(lx, 150, measure('Songtexte in Echtzeit', SANS(600, 26)) + 44, 50, 25); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
      txt('Songtexte in Echtzeit', lx + 22, 184, { font: SANS(600, 26) });
    }, 20);
    rise(4.1, () => {
      ctx.save();
      L.forEach((line, i) => {
        const y = 470 + i * lh - scroll;
        const active = i === cur, past = i < cur;
        const edge = clamp((y - 300) / 100) * clamp((1000 - y) / 110); if (edge <= 0) return;
        ctx.save(); ctx.globalAlpha *= edge;
        const f = DISP(800, 84);
        if (!active) {
          ctx.save(); const d = Math.abs(i - Math.max(cur, 0));
          if (d > 0) ctx.filter = `blur(${Math.min(6, d * 2.2)}px)`;
          txt(line, lx, y, { font: f, color: WHITE, alpha: past ? 0.28 : 0.38, ls: -1 });
          ctx.restore();
        } else {
          // word-by-word fill across the line's duration
          const t0 = times[i], t1 = i + 1 < times.length ? times[i + 1] : 6.5;
          const ws = line.split(' ');
          let wx = lx;
          ws.forEach((w, k) => {
            const wp = inv(t0 + (k / ws.length) * (t1 - t0) * 0.9, t0 + ((k + 0.6) / ws.length) * (t1 - t0) * 0.9, t);
            const lift = E.outCubic(wp);
            txt(w, wx, y - lift * 4, { font: f, color: WHITE, alpha: lerp(0.4, 1, lift), ls: -1, glow: 30 * lift, glowColor: 'rgba(255,255,255,0.45)' });
            wx += measure(w + ' ', f, -1);
          });
        }
        ctx.restore();
      });
      ctx.restore();
    }, 50);
    ctx.restore();
  }

  // ================= D: devices =================
  function screenContent(x, y, w, h, t, compact) {
    ctx.save(); rr(x, y, w, h, Math.min(w, h) * 0.06); ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#ff4e6a'); g.addColorStop(0.6, '#b0246a'); g.addColorStop(1, '#3a0f4a');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const s = Math.min(w, h) * (compact ? 0.5 : 0.42);
    const cx = x + w / 2 - s / 2, cy = y + h * (compact ? 0.12 : 0.14);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = s * 0.2; coverDraw(NOW_COVER, cx, cy, s, s * 0.06); ctx.restore();
    // equaliser synced to the groove
    const n = compact ? 7 : 13, bw = (w * 0.6) / n, bx = x + w * 0.2, by = cy + s + h * 0.2;
    for (let i = 0; i < n; i++) {
      const v = 0.25 + 0.75 * Math.abs(Math.sin(t * (5 + i * 0.7) + i * 1.3)) * (0.5 + 0.5 * beatPulse(t));
      const bh = h * 0.12 * v;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; rr(bx + i * bw + bw * 0.2, by - bh, bw * 0.6, bh, bw * 0.3); ctx.fill();
    }
    ctx.restore();
  }
  function device(kind, cx, cy, sc, t) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(250,35,59,0.25)'; ctx.shadowBlur = 80;
    const bezel = '#16161a', edge = '#45454f';
    if (kind === 'laptop') {
      rr(-400, -260, 800, 500, 28); ctx.fillStyle = bezel; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke();
      screenContent(-380, -240, 760, 460, t, false);
      ctx.fillStyle = '#2a2a31'; rr(-470, 240, 940, 26, 12); ctx.fill(); ctx.fillStyle = '#1b1b20'; rr(-80, 240, 160, 10, 5); ctx.fill();
    } else if (kind === 'tablet') {
      rr(-190, -250, 380, 500, 34); ctx.fillStyle = bezel; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke();
      screenContent(-172, -232, 344, 464, t, false);
    } else if (kind === 'phone') {
      rr(-115, -235, 230, 470, 44); ctx.fillStyle = bezel; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke();
      screenContent(-103, -223, 206, 446, t, true);
      ctx.fillStyle = '#000'; rr(-36, -213, 72, 20, 10); ctx.fill();
    } else { // watch
      ctx.fillStyle = '#26262c'; rr(-50, -165, 100, 330, 30); ctx.fill();
      rr(-85, -105, 170, 210, 46); ctx.fillStyle = bezel; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke();
      screenContent(-72, -92, 144, 184, t, true);
    }
    ctx.restore();
  }
  function sceneDevices(t) {
    ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, 600, 0, W / 2, 600, 950);
    g.addColorStop(0, `rgba(250,35,59,${0.2 + 0.08 * beatPulse(t)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const out = E.inExpo(inv(8.25, 8.5, t));
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.translate(W / 2, 590); ctx.scale(1 - out * 0.15, 1 - out * 0.15); ctx.translate(-W / 2, -590);
    const D = [['tablet', 520, 620, 0.78], ['laptop', 960, 600, 0.8], ['phone', 1395, 650, 0.8], ['watch', 1610, 700, 0.62]];
    const order = [1, 0, 2, 3]; // laptop first
    order.forEach((di, k) => {
      const [kind, x, y, s] = D[di], t0 = C.devicesIn[k], p = inv(t0, t0 + 0.6, t); if (p <= 0) return;
      const e = E.outExpo(p);
      ctx.save(); ctx.globalAlpha *= Math.min(1, p * 2.5);
      if (e < 0.97) ctx.filter = `blur(${(1 - e) * 10}px)`;
      device(kind, x, y + (1 - e) * 140 + Math.sin(t * 2 + di) * 5, s * lerp(0.92, 1, e), t);
      ctx.restore();
    });
    segLine([{ s: 'Auf all deinen', font: DISP(800, 96), t0: 6.55, ls: -2 }, { s: 'Geräten.', font: SERIF(120), color: PINK2, t0: 6.7 }], W / 2, 170, t, { align: 'center', gap: 26 });
    segLine([{ s: 'iPhone · iPad · Mac · Apple Watch · Android · Windows · Web', font: SANS(500, 30), color: [170, 170, 185], t0: 7.25, dy: 20 }], W / 2, 1010, t, { align: 'center' });
    ctx.restore();
  }

  // ================= E: end card =================
  const layer = document.createElement('canvas'); layer.width = W; layer.height = 320;
  function sceneEnd(t) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const gl = E.outExpo(inv(8.5, 9.4, t));
    const g = ctx.createRadialGradient(W / 2, 520, 0, W / 2, 520, 900);
    g.addColorStop(0, `rgba(250,35,59,${0.28 * gl})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // radial streaks on the hit
    const b = inv(8.5, 9.1, t);
    if (b > 0 && b < 1) {
      ctx.save(); ctx.translate(W / 2, 500); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU, r0 = lerp(100, 1100, E.outExpo(b)), len = 180 * (1 - b);
        ctx.strokeStyle = `rgba(255,${90 + (i % 3) * 50},${120 + (i % 2) * 60},${0.55 * (1 - b)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len)); ctx.stroke();
      }
      ctx.restore();
    }
    // wordmark on its own layer (gradient fill + light sweep clipped to glyphs)
    const lc = layer.getContext('2d'); lc.clearRect(0, 0, W, 320);
    const fill = lc.createLinearGradient(W / 2 - 600, 0, W / 2 + 600, 0); fill.addColorStop(0, rgba(PINK2)); fill.addColorStop(1, rgba(PINK));
    swapCtx(lc, () => {
      const word = 'Apple Music', f = DISP(800, 220);
      lc.font = f; lc.letterSpacing = '0px';
      const chars = [...word], ws = chars.map(ch => lc.measureText(ch).width);
      const ls = lerp(30, -6, E.outExpo(inv(8.55, 9.5, t)));
      const total = ws.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
      let x = W / 2 - total / 2;
      chars.forEach((ch, i) => {
        const a = 8.55 + i * 0.035, p = inv(a, a + 0.6, t);
        if (p > 0) {
          const e = E.outExpo(p);
          lc.save(); lc.globalAlpha = Math.min(1, p * 3);
          if (e < 0.98) lc.filter = `blur(${(1 - e) * 18}px)`;
          lc.translate(x + ws[i] / 2, 250 + (1 - e) * 80); lc.textAlign = 'center'; lc.font = f; lc.fillStyle = fill; lc.fillText(ch, 0, 0);
          lc.restore();
        }
        x += ws[i] + ls;
      });
    });
    const sw = inv(9.25, 9.8, t);
    if (sw > 0 && sw < 1) {
      lc.save(); lc.globalCompositeOperation = 'source-atop';
      const sx = lerp(-200, W + 200, E.inOutSine(sw)), sg = lc.createLinearGradient(sx - 180, 0, sx + 180, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      lc.fillStyle = sg; lc.fillRect(0, 0, W, 320); lc.restore();
    }
    ctx.save(); ctx.shadowColor = 'rgba(250,35,59,0.6)'; ctx.shadowBlur = 70; ctx.drawImage(layer, 0, 300); ctx.restore();
    segLine([{ s: 'Hör, was dich bewegt.', font: SERIF(96), color: [255, 225, 232], t0: 9.0, dur: 0.7 }], W / 2, 735, t, { align: 'center' });
    txt('Inoffizielles Fan-Video · Apple Music ist eine Marke von Apple Inc.', W / 2, 1035, { font: SANS(400, 20), color: [140, 140, 150], align: 'center', alpha: inv(9.2, 9.6, t) });
  }

  // ---------- grain ----------
  const GRAIN = [];
  for (let k = 0; k < 4; k++) {
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const gc = g.getContext('2d'), id = gc.createImageData(256, 256), r = rng(100 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gc.putImageData(id, 0, 0); GRAIN.push(mainCtx.createPattern(g, 'repeat'));
  }

  // ---------- master ----------
  function render(t) {
    t = clamp(t, 0, DUR - 1e-4);
    ctx = mainCtx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
    // camera: micro push on every beat while the groove plays
    const z = 1 + 0.008 * beatPulse(t);
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    const S = C.scenes;
    if (t < S.spatial) sceneCovers(t);
    else if (t < S.lyrics) sceneSpatial(t);
    else if (t < S.devices) sceneLyrics(t);
    else if (t < S.end) sceneDevices(t);
    else sceneEnd(t);
    ctx.restore();
    // cut flashes
    const fl = 0.55 * decay(t, S.spatial, 9) + 0.25 * decay(t, S.devices, 10) + 0.6 * decay(t, S.end, 7);
    if (fl > 0.005) { ctx.fillStyle = `rgba(255,240,244,${fl})`; ctx.fillRect(0, 0, W, H); }
    const fi = 1 - inv(0, 0.25, t); if (fi > 0) { ctx.fillStyle = `rgba(0,0,0,${fi})`; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const fr = Math.floor(t * C.fps);
    ctx.save(); ctx.globalAlpha = 0.04; ctx.globalCompositeOperation = 'overlay';
    ctx.translate((fr * 37) % 256, (fr * 91) % 256); ctx.fillStyle = GRAIN[fr % 4]; ctx.fillRect(-256, -256, W + 512, H + 512);
    ctx.restore();
  }

  // ---------- API + preview ----------
  const renderMode = new URLSearchParams(location.search).has('render');
  let cur = 0, playing = false, last = 0;
  window.__maTimeline = { duration: DUR, fps: C.fps, seek: t => { cur = t; render(t); } };
  const fontsReady = Promise.all([
    document.fonts.load(DISP(800, 100)), document.fonts.load(SANS(500, 30)), document.fonts.load(SANS(600, 30)),
    document.fonts.load(SANS(700, 30)), document.fonts.load(SANS(400, 30)), document.fonts.load(SERIF(100), 'Hör, was dich bewegt. Geräten Songs'),
  ]).catch(() => {});
  window.__ready = fontsReady.then(() => {
    for (let i = 0; i < 36; i++) COVERS.push(bakeCover(i));
    NOW_COVER = bakeCover(0);
    render(0); return true;
  });
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
