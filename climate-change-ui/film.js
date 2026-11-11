// Klimawandel — UI-Motion-Film (16:9). Deterministic: every frame is a pure function of t.
// window.__maTimeline.seek(t) for scrubbing / frame-exact rendering (render.cjs).
(() => {
  const C = window.CUES, W = C.width, H = C.height, DUR = C.duration;
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
    outQuint: x => 1 - Math.pow(1 - x, 5),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: x => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const gauss = (t, c, w) => Math.exp(-Math.pow((t - c) / w, 2));
  const decay = (t, c, k) => (t < c ? 0 : Math.exp(-(t - c) * k));
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const ramp = (stops, v) => { v = clamp(v) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(v)); return mix(stops[i], stops[i + 1], v - i); };
  const deNum = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // ---------- type ----------
  const SANS = (w, s) => `${w} ${s}px "Inter"`;
  const DISP = (w, s) => `${w} ${s}px "Inter Display"`;
  const SERIF = s => `italic 400 ${s}px "Instrument Serif", "Inter"`;
  const INK = [17, 17, 22], WHITE = [255, 255, 255], GRAY = [120, 122, 135];
  const RAINBOW = ['#ff3b6b', '#ff9a3c', '#ffe14d', '#3dff9a', '#3dc8ff', '#7a5cff', '#ff3bd4', '#ff3b6b'];

  function txt(str, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font || SANS(500, 32);
    ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.glow) { ctx.shadowColor = o.glowColor || 'rgba(255,255,255,0.6)'; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = typeof o.color === 'string' ? o.color : rgba(o.color || WHITE);
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  const measure = (str, font, ls = 0) => { ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w; };

  // A line made of differently-styled segments; each segment rises out of blur on its own beat.
  function segLine(segs, x, y, t, o = {}) {
    const widths = segs.map(s => measure(s.s, s.font, s.ls || 0));
    const gap = o.gap ?? 0;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (segs.length - 1);
    let cx = o.align === 'center' ? x - total / 2 : x;
    segs.forEach((s, i) => {
      const p = inv(s.t0, s.t0 + (s.dur ?? 0.7), t);
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
    return total;
  }
  // word-by-word reveal
  function words(str, x, y, t, t0, o = {}) {
    const ws = str.split(' ');
    const sp = measure(' ', o.font);
    let cx = x;
    if (o.align === 'center') cx -= ws.reduce((a, w) => a + measure(w, o.font), 0) / 2 + (sp * (ws.length - 1)) / 2;
    ws.forEach((w, i) => {
      const a = t0 + i * (o.stagger ?? 0.06), p = inv(a, a + (o.dur ?? 0.5), t);
      if (p > 0) {
        const e = E.outExpo(p);
        ctx.save(); ctx.globalAlpha *= Math.min(1, p * 2.5);
        if (e < 0.98) ctx.filter = `blur(${(1 - e) * 10}px)`;
        txt(w, cx, y + (1 - e) * (o.dy ?? 24), { font: o.font, color: o.color || WHITE });
        ctx.restore();
      }
      cx += measure(w, o.font) + sp;
    });
  }
  function wrap(str, font, maxW) {
    const out = []; let line = '';
    for (const w of str.split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (measure(test, font) > maxW && line) { out.push(line); line = w; } else line = test;
    }
    if (line) out.push(line);
    return out;
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function card(x, y, w, h, r = 36, o = {}) {
    ctx.save();
    ctx.shadowColor = `rgba(20,20,40,${o.shadow ?? 0.14})`; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    rr(x, y, w, h, r); ctx.fillStyle = o.fill || '#ffffff'; ctx.fill();
    ctx.restore();
    if (o.stroke !== false) { ctx.save(); rr(x, y, w, h, r); ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
  }
  function chip(str, x, y, o = {}) {
    const f = o.font || SANS(600, 24), w = measure(str, f, o.ls || 0) + 40, h = o.h || 48;
    rr(x, y, w, h, h / 2); ctx.fillStyle = o.bg || '#f1f1f4'; ctx.fill();
    txt(str, x + 20, y + h / 2 + 1, { font: f, color: o.color || INK, base: 'middle', ls: o.ls });
    return w;
  }

  // ---------- icons (white, drawn around 0,0 in a ~48px box) ----------
  function icon(k, x, y, s, col = '#fff', t = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (k === 'sun') { ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 17, Math.sin(a) * 17); ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.stroke(); } }
    else if (k === 'drought') { ctx.beginPath(); ctx.moveTo(-24, 10); ctx.lineTo(24, 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(-8, 20); ctx.lineTo(-12, 26); ctx.moveTo(6, 10); ctx.lineTo(10, 18); ctx.lineTo(4, 26); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -10, 9, 0, TAU); ctx.fill(); }
    else if (k === 'fire') { ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(16, -8, 20, 4, 16, 14); ctx.bezierCurveTo(12, 26, -12, 26, -16, 14); ctx.bezierCurveTo(-20, 2, -8, -4, -6, -14); ctx.bezierCurveTo(-2, -6, 2, -6, 0, -26); ctx.fill(); }
    else if (k === 'flood') { for (let r = 0; r < 3; r++) { ctx.beginPath(); for (let i = -24; i <= 24; i += 3) ctx.lineTo(i, -12 + r * 12 + Math.sin(i / 5 + t * 4 + r) * 3); ctx.stroke(); } }
    else if (k === 'ice') { for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 24); ctx.moveTo(-7, -17); ctx.lineTo(0, -10); ctx.lineTo(7, -17); ctx.moveTo(-7, 17); ctx.lineTo(0, 10); ctx.lineTo(7, 17); ctx.stroke(); ctx.restore(); } }
    else if (k === 'storm') { ctx.beginPath(); ctx.arc(-8, -6, 11, Math.PI * 0.9, Math.PI * 1.9); ctx.arc(8, -8, 13, Math.PI * 1.1, Math.PI * 0.1); ctx.lineTo(20, 6); ctx.lineTo(-20, 6); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(2, 10); ctx.lineTo(-6, 22); ctx.lineTo(2, 22); ctx.lineTo(-4, 32); ctx.stroke(); }
    else if (k === 'spark') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - Math.PI / 2, r = i % 2 ? 6 : 20; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
    else if (k === 'arrow') { ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -14); ctx.moveTo(-11, -3); ctx.lineTo(0, -14); ctx.lineTo(11, -3); ctx.stroke(); }
    else if (k === 'warn') { ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(22, 18); ctx.lineTo(-22, 18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-2.5, -6, 5, 13); ctx.fillRect(-2.5, 10, 5, 5); }
    ctx.restore();
  }

  // ================= SCENE 1: 3D cloud of climate UI cards =================
  const CARD_TYPES = 8;
  function bakeCard(type, seed) {
    const r = rng(seed);
    const w = [460, 520, 420, 480, 440, 500, 380, 420][type], h = [300, 260, 300, 300, 320, 180, 380, 280][type];
    const S = 1.6, M = 50; // supersample + margin for shadow/blur
    const c = document.createElement('canvas'); c.width = (w + M * 2) * S; c.height = (h + M * 2) * S;
    const g = c.getContext('2d'); g.scale(S, S); g.translate(M, M);
    swapCtx(g, () => {
      if (type === 6) { // photo tile
        const P = [['#ff9a3c', '#c2185b', 'Hitzesommer'], ['#9fe7ff', '#2e5aa8', 'Gletscher 2025'], ['#4a90e2', '#0d2b5c', 'Hochwasser'], ['#ffcf6b', '#8a3b12', 'Dürre']][(r() * 4) | 0];
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
        rr(0, 0, w, h, 26); const gr = ctx.createLinearGradient(0, 0, w * 0.6, h); gr.addColorStop(0, P[0]); gr.addColorStop(1, P[1]); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
        ctx.save(); rr(0, 0, w, h, 26); ctx.clip();
        for (let i = 0; i < 5; i++) { const gx = r() * w, gy = r() * h, rad = 60 + r() * 140; const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad); rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h); }
        ctx.restore();
        chip(P[2], 20, h - 68, { bg: 'rgba(255,255,255,0.9)', font: SANS(600, 22) });
        return;
      }
      card(0, 0, w, h, 26, { shadow: 0.45, fill: '#fbfbfd' });
      if (type === 0) { // heat alert
        icon('warn', 44, 50, 0.8, '#ff3b30');
        txt('HITZEWARNUNG', 74, 58, { font: SANS(700, 20), color: '#ff3b30', ls: 2 });
        txt('38°', 30, 200, { font: DISP(800, 130), color: INK });
        txt('Berlin · heute, 15 Uhr', 34, 258, { font: SANS(500, 22), color: GRAY });
        icon('sun', w - 80, 150, 1.6, '#ffb020');
      } else if (type === 1) { // news
        ctx.save(); rr(18, 18, w * 0.38, h - 36, 18); const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff7a2f'); gr.addColorStop(1, '#5a0f0f'); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
        icon('fire', 18 + w * 0.19, h / 2, 1.4, 'rgba(255,230,180,0.95)');
        const x0 = w * 0.38 + 40;
        txt('NACHRICHTEN', x0, 54, { font: SANS(700, 16), color: GRAY, ls: 2 });
        txt('Waldbrände', x0, 98, { font: DISP(800, 34), color: INK });
        txt('in Südeuropa', x0, 136, { font: DISP(800, 34), color: INK });
        for (let i = 0; i < 3; i++) { rr(x0, 162 + i * 26, (w - x0 - 30) * (1 - i * 0.2), 12, 6); ctx.fillStyle = '#e6e6ec'; ctx.fill(); }
      } else if (type === 2) { // chat
        txt('Mia', 30, 50, { font: SANS(700, 22), color: INK });
        rr(26, 74, 300, 64, 24); ctx.fillStyle = '#efeff3'; ctx.fill();
        txt('Ist das noch normal?', 48, 114, { font: SANS(500, 22), color: INK });
        rr(w - 330, 154, 304, 64, 24); ctx.fillStyle = '#3b6cff'; ctx.fill();
        txt('Schon wieder 36 Grad…', w - 310, 194, { font: SANS(500, 22), color: WHITE });
        rr(26, 234, 180, 44, 20); ctx.fillStyle = '#efeff3'; ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#b8b8c4'; ctx.beginPath(); ctx.arc(64 + i * 22, 256, 6, 0, TAU); ctx.fill(); }
      } else if (type === 3) { // CO2 chart
        txt('CO₂ IN DER LUFT', 30, 52, { font: SANS(700, 18), color: GRAY, ls: 2 });
        txt('424', 30, 140, { font: DISP(800, 84), color: INK });
        txt('ppm', 200, 140, { font: SANS(600, 28), color: GRAY });
        ctx.beginPath(); for (let i = 0; i <= 60; i++) { const p = i / 60; ctx.lineTo(30 + p * (w - 60), 270 - Math.pow(p, 2.6) * 110 - Math.sin(i * 1.7) * 3); }
        ctx.strokeStyle = '#ff4d3a'; ctx.lineWidth = 4; ctx.stroke();
        ctx.lineTo(w - 30, 280); ctx.lineTo(30, 280); ctx.closePath(); ctx.fillStyle = 'rgba(255,77,58,0.12)'; ctx.fill();
      } else if (type === 4) { // heat map
        ctx.save(); rr(14, 14, w - 28, h - 28, 18); ctx.clip(); ctx.fillStyle = '#e9eef2'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 9; i++) { ctx.fillStyle = '#d3dbe2'; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 40 + r() * 80, 25 + r() * 50, r() * 3, 0, TAU); ctx.fill(); }
        for (let i = 0; i < 4; i++) { const gx = r() * w, gy = r() * h, rad = 60 + r() * 90; const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad); rg.addColorStop(0, 'rgba(255,60,40,0.85)'); rg.addColorStop(0.5, 'rgba(255,170,40,0.45)'); rg.addColorStop(1, 'rgba(255,200,40,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h); }
        ctx.restore();
        chip('Hitzekarte · Europa', 30, h - 76, { bg: '#fff', font: SANS(600, 20) });
      } else if (type === 5) { // notification
        ctx.save(); rr(26, 40, 96, 96, 24); const gr = ctx.createLinearGradient(26, 40, 122, 136); gr.addColorStop(0, '#4fa3ff'); gr.addColorStop(1, '#2b4fd8'); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
        icon('storm', 74, 82, 1.2, '#fff');
        txt('Unwetterwarnung', 146, 76, { font: SANS(700, 26), color: INK });
        txt('Starkregen: bis zu 60 l/m²', 146, 112, { font: SANS(500, 21), color: GRAY });
        txt('jetzt', w - 70, 76, { font: SANS(500, 18), color: GRAY });
      } else { // sea level stat
        txt('MEERESSPIEGEL', 30, 52, { font: SANS(700, 18), color: GRAY, ls: 2 });
        txt('+20 cm', 30, 150, { font: DISP(800, 88), color: '#2b6cff' });
        txt('seit 1900', 34, 196, { font: SANS(500, 24), color: GRAY });
        ctx.save(); ctx.beginPath(); for (let i = 0; i <= 40; i++) ctx.lineTo(30 + i * (w - 60) / 40, 240 + Math.sin(i * 0.6) * 8); ctx.strokeStyle = '#2b6cff'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
      }
    });
    // blurred twin for depth of field
    const b = document.createElement('canvas'); b.width = c.width; b.height = c.height;
    const bg = b.getContext('2d'); bg.filter = 'blur(14px)'; bg.drawImage(c, 0, 0);
    return { c, b, w: w + M * 2, h: h + M * 2 };
  }
  const BAKED = [];
  const CLOUD = [];
  function buildCloud() {
    for (let i = 0; i < 16; i++) BAKED.push(bakeCard(i % CARD_TYPES, 100 + i));
    const r = rng(5), N = 90;
    for (let i = 0; i < N; i++) {
      // keep a clear-ish corridor in the middle so the camera flies *through* the cloud
      let x = (r() - 0.5) * 4200, y = (r() - 0.5) * 2600;
      if (Math.abs(x) < 380 && Math.abs(y) < 240) x += x < 0 ? -420 : 420;
      CLOUD.push({ k: i % BAKED.length, x, y, z: 400 + (i / N) * 6200 + r() * 200, rot: (r() - 0.5) * 0.3, spin: (r() - 0.5) * 0.12, bob: r() * TAU });
    }
  }
  function cloud(t, defocus, alpha) {
    const zc = -300 + 4600 * E.outQuint(inv(0, 3.6, t)) + 180 * t;
    const F = 1100, focus = 1300;
    const list = [];
    for (const p of CLOUD) {
      const d = p.z - zc; if (d < 80) continue;
      list.push([d, p]);
    }
    list.sort((a, b) => b[0] - a[0]);
    ctx.save(); ctx.globalAlpha = alpha;
    for (const [d, p] of list) {
      const s = F / d; if (s > 5) continue;
      const B = BAKED[p.k];
      const sx = W / 2 + p.x * s + Math.sin(t * 0.5 + p.bob) * 6, sy = H / 2 + p.y * s + Math.cos(t * 0.4 + p.bob) * 6;
      const ww = B.w * s, hh = B.h * s;
      if (sx + ww / 2 < -50 || sx - ww / 2 > W + 50 || sy + hh / 2 < -50 || sy - hh / 2 > H + 50) continue;
      const fadeFar = clamp((6000 - d) / 1500), fadeNear = clamp((d - 80) / 250);
      const blur = clamp(Math.max(Math.abs(d - focus) / 1600, defocus));
      ctx.save();
      ctx.globalAlpha *= fadeFar * fadeNear;
      ctx.translate(sx, sy); ctx.rotate(p.rot + p.spin * t);
      // atmospheric tint: far cards sink into the purple haze
      if (blur < 0.99) { ctx.globalAlpha *= 1; ctx.drawImage(B.c, -ww / 2, -hh / 2, ww, hh); }
      if (blur > 0.01) { ctx.globalAlpha *= blur; ctx.drawImage(B.b, -ww / 2, -hh / 2, ww, hh); }
      ctx.restore();
    }
    ctx.restore();
  }
  function nebula(t, k = 1) {
    ctx.fillStyle = '#07060f'; ctx.fillRect(0, 0, W, H);
    const blobs = [[0.25, 0.3, [120, 60, 220], 900], [0.8, 0.75, [255, 110, 50], 800], [0.65, 0.2, [60, 90, 255], 700], [0.2, 0.85, [200, 40, 120], 700]];
    blobs.forEach(([bx, by, col, rad], i) => {
      const x = W * bx + Math.sin(t * 0.3 + i) * 80, y = H * by + Math.cos(t * 0.25 + i * 2) * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(col, 0.32 * k)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
  }

  // ================= SCENE 2: the counter =================
  function counter(t) {
    const out = E.inCubic(inv(6.25, 6.6, t));
    ctx.save(); ctx.globalAlpha = 1 - out; if (out > 0) ctx.filter = `blur(${out * 18}px)`;
    const [a, b] = C.counter;
    const v = 102000000 * E.outExpo(inv(a, b, t));
    const x = 200;
    segLine([{ s: 'Jeden Tag stößt die Menschheit', font: SANS(500, 44), color: [230, 230, 240], t0: 3.15, dy: 30 }], x, 400, t);
    const numP = inv(a - 0.05, a + 0.4, t);
    if (numP > 0) {
      const e = E.outExpo(numP);
      ctx.save(); ctx.globalAlpha *= Math.min(1, numP * 2.5); if (e < 0.98) ctx.filter = `blur(${(1 - e) * 16}px)`;
      txt(deNum(v), x - 6, 590 + (1 - e) * 50, { font: DISP(700, 220), color: WHITE, ls: -4, glow: 30, glowColor: 'rgba(160,140,255,0.35)' });
      ctx.restore();
    }
    segLine([
      { s: 'Tonnen', font: SERIF(190), color: WHITE, t0: 4.3 },
      { s: 'CO₂', font: SERIF(190), color: [255, 170, 120], t0: 4.42 },
      { s: 'aus.', font: SERIF(190), color: WHITE, t0: 4.54 },
    ], x, 790, t, { gap: 40 });
    // progress hairline (like a timeline scrubber) along the bottom
    const pr = inv(3.0, 6.4, t);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, 930, W - 2 * x, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x, 930, (W - 2 * x) * pr, 2);
    txt('Ø 2024 · fossile Emissionen', W - x, 975, { font: SANS(500, 22), color: [180, 180, 200], align: 'right', alpha: inv(5.0, 5.4, t) });
    ctx.restore();
  }

  // ================= SCENE 3: rainbow search pill =================
  function rainbowStroke(x, y, w, h, t, width, blur, alpha) {
    ctx.save();
    const g = ctx.createConicGradient(t * 2.2, x + w / 2, y + h / 2);
    RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
    ctx.strokeStyle = g; ctx.lineWidth = width; ctx.globalAlpha *= alpha;
    if (blur) ctx.filter = `blur(${blur}px)`;
    rr(x, y, w, h, h / 2); ctx.stroke();
    ctx.restore();
  }
  function searchPill(t) {
    const S = C.search;
    const open = E.outExpo(inv(S.open, S.open + 0.55, t));
    const collapse = E.inExpo(inv(9.05, 9.4, t));
    const ph = 120, pw = lerp(ph, 940, open) * (1 - collapse) + 4 * collapse;
    const cx = W / 2, cy = H / 2 + 20;
    const x = cx - pw / 2, y = cy - ph / 2 * (1 - collapse * 0.9), h = ph * (1 - collapse * 0.9);
    const press = 1 - 0.06 * gauss(t, S.send, 0.06);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(press, press); ctx.translate(-cx, -cy);
    // bloom
    rainbowStroke(x, y, pw, h, t, 26, 40, 0.55 + 0.4 * collapse);
    rainbowStroke(x, y, pw, h, t, 10, 12, 0.85);
    ctx.save(); rr(x, y, pw, h, h / 2); ctx.fillStyle = '#0b0b12'; ctx.fill(); ctx.restore();
    rainbowStroke(x, y, pw, h, t, 4, 0, 1);
    if (open > 0.6 && collapse < 0.5) {
      const a = inv(0.6, 1, open) * (1 - collapse * 2);
      ctx.save(); ctx.globalAlpha = a;
      icon('spark', x + 64, cy, 0.9, '#ffffff');
      const n = Math.floor(inv(S.typeStart, S.typeEnd, t) * C.query.length);
      const typed = C.query.slice(0, n);
      if (n === 0) txt('Frag etwas …', x + 110, cy + 1, { font: SANS(500, 42), color: [110, 110, 130], base: 'middle' });
      txt(typed, x + 110, cy + 1, { font: SANS(500, 42), color: WHITE, base: 'middle' });
      const cw = measure(typed, SANS(500, 42));
      if (Math.floor(t * 2.5) % 2 === 0 || (t > S.typeStart && t < S.typeEnd)) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 114 + cw, cy - 24, 3, 48); }
      // send button
      const bx = x + pw - 64, ready = inv(S.typeEnd, S.typeEnd + 0.2, t);
      ctx.beginPath(); ctx.arc(bx, cy, 40, 0, TAU);
      ctx.fillStyle = rgba(mix([60, 60, 75], [255, 255, 255], ready)); ctx.fill();
      icon('arrow', bx, cy, 0.95, rgba(mix([150, 150, 160], [10, 10, 15], ready)));
      const fl = decay(t, S.send, 6);
      if (fl > 0.01) { ctx.beginPath(); ctx.arc(bx, cy, 40 + (1 - fl) * 60, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${fl})`; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  // ================= SCENE 4: light trails around +1,3 °C =================
  const TRAILS = Array.from({ length: 11 }, (_, i) => ({
    col: RAINBOW[i % 7], ra: 560 + i * 26, rb: 320 + (i % 3) * 50, tx: 0.45 + i * 0.16, tz: (i - 5) * 0.2, sp: 2.0 + (i % 4) * 0.22, off: i * 0.57, ph: i * 0.83,
  }));
  function trailPts(tr, t, k) {
    const pts = [], head = t * tr.sp + tr.off, len = 3.3, n = 110;
    const ry = t * 0.7 + tr.ph, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(tr.tx), sx = Math.sin(tr.tx), cz = Math.cos(tr.tz), sz = Math.sin(tr.tz);
    for (let i = 0; i <= n; i++) {
      const s = head - len + (len * i) / n;
      let x = tr.ra * Math.cos(s) * k, y = tr.rb * Math.sin(2 * s) * 0.5 * k, z = tr.ra * Math.sin(s) * k;
      let y2 = y * cx - z * sx, z2 = y * sx + z * cx; y = y2; z = z2;               // tilt X
      let x2 = x * cz - y * sz; y2 = x * sz + y * cz; x = x2; y = y2;               // tilt Z
      x2 = x * cy + z * sy; z2 = -x * sy + z * cy; x = x2; z = z2;                  // spin Y
      const f = 1500 / (1500 + z);
      pts.push({ x: W / 2 + x * f, y: H / 2 + y * f, z, f, a: i / n });
    }
    return pts;
  }
  function drawTrails(t, k, front, alpha) {
    if (alpha <= 0 || k <= 0.001) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.globalAlpha = alpha;
    for (const tr of TRAILS) {
      const pts = trailPts(tr, t, k);
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          if ((b.z < 0) !== front) continue;
          const w = (pass ? 3.5 : 24) * b.f * (0.25 + 0.75 * b.a);
          ctx.strokeStyle = pass ? `rgba(255,255,255,${0.85 * Math.pow(b.a, 2)})` : tr.col;
          if (!pass) ctx.globalAlpha = alpha * 0.6 * Math.pow(b.a, 1.3);
          else ctx.globalAlpha = alpha;
          ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // glowing head
      const hd = pts[pts.length - 1];
      if ((hd.z < 0) === front) {
        const g = ctx.createRadialGradient(hd.x, hd.y, 0, hd.x, hd.y, 40 * hd.f);
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, tr.col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha * 0.8; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hd.x, hd.y, 40 * hd.f, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function trailsScene(t) {
    ctx.fillStyle = '#030306'; ctx.fillRect(0, 0, W, H);
    const k = E.outExpo(inv(9.2, 10.1, t)) * (1 - E.inExpo(inv(12.0, 12.4, t)) * 0.95);
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 900);
    g.addColorStop(0, `rgba(90,60,200,${0.18 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawTrails(t, k, false, 1);
    const out = E.inCubic(inv(11.9, 12.25, t));
    ctx.save(); ctx.globalAlpha = 1 - out;
    segLine([{ s: 'Die Erde ist heute', font: SANS(500, 44), color: [225, 225, 235], t0: 9.65 }], W / 2, 375, t, { align: 'center' });
    const v = 1.3 * E.outCubic(inv(9.8, 10.9, t));
    segLine([
      { s: '+' + v.toFixed(1).replace('.', ',') + ' °C', font: DISP(800, 180), color: WHITE, t0: 9.8, glow: 40, glowColor: 'rgba(255,120,80,0.45)' },
      { s: 'wärmer.', font: SERIF(196), color: [255, 196, 150], t0: 10.25 },
    ], W / 2, 600, t, { align: 'center', gap: 40 });
    segLine([{ s: 'als vor der Industrialisierung (1850–1900).', font: SANS(400, 36), color: [190, 190, 205], t0: 10.75 }], W / 2, 700, t, { align: 'center' });
    ctx.restore();
    drawTrails(t, k, true, 0.7);
  }

  // ================= SCENE 5: light UI =================
  const LIGHT_BG = '#efede8';
  function lightBg(t) {
    ctx.fillStyle = LIGHT_BG; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 1100);
    g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const enter = (t, t0, d = 0.6) => E.outExpo(inv(t0, t0 + d, t));
  function rise(t, t0, fn, o = {}) {
    const p = inv(t0, t0 + (o.d ?? 0.6), t); if (p <= 0) return;
    const e = E.outExpo(p);
    ctx.save(); ctx.globalAlpha *= Math.min(1, p * 2.2);
    ctx.translate(o.cx ?? 0, (o.cy ?? 0) + (1 - e) * (o.dy ?? 70));
    const s = lerp(o.s0 ?? 0.94, 1, e); ctx.scale(s, s); ctx.translate(-(o.cx ?? 0), -(o.cy ?? 0));
    if (e < 0.97 && o.blur !== false) ctx.filter = `blur(${(1 - e) * 10}px)`;
    fn(e); ctx.restore();
  }

  function blockA(t) {
    const t0 = C.blocks[0];
    // chat card (left)
    rise(t, t0, () => {
      const x = 150, y = 150, w = 780, h = 640;
      card(x, y, w, h, 40);
      ctx.save(); const ag = ctx.createLinearGradient(x + 40, y + 40, x + 100, y + 100); ag.addColorStop(0, '#3dffb5'); ag.addColorStop(1, '#2b8cff'); ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x + 74, y + 74, 30, 0, TAU); ctx.fill(); ctx.restore();
      icon('spark', x + 74, y + 74, 0.75, '#fff');
      txt('Klima erklärt', x + 124, y + 84, { font: SANS(700, 30), color: INK });
      txt('jetzt', x + w - 50, y + 84, { font: SANS(500, 22), color: GRAY, align: 'right' });
      rise(t, t0 + 0.25, () => {
        const q = 'Warum wird die Erde wärmer?', f = SANS(500, 30), qw = measure(q, f) + 56;
        rr(x + w - 40 - qw, y + 150, qw, 76, 30); ctx.fillStyle = '#3b6cff'; ctx.fill();
        txt(q, x + w - 40 - qw + 28, y + 199, { font: f, color: WHITE });
      }, { dy: 30, s0: 0.9, cx: x + w - 200, cy: y + 190 });
      rise(t, t0 + 0.5, () => {
        const f = SANS(500, 31), lines = wrap('Kohle, Öl und Gas setzen CO₂ frei. Das CO₂ legt sich wie eine Decke um die Erde und hält Wärme fest.', f, w - 160);
        const bh = 44 + lines.length * 46;
        rr(x + 40, y + 260, w - 80, bh, 30); ctx.fillStyle = '#f1f1f4'; ctx.fill();
        // words appear like streaming text
        let wi = 0;
        lines.forEach((ln, li) => {
          let lx = x + 70;
          ln.split(' ').forEach(wd => {
            const a = inv(t0 + 0.6 + wi * 0.035, t0 + 0.8 + wi * 0.035, t); wi++;
            const col = /CO₂|Wärme|Decke/.test(wd) ? [255, 80, 50] : INK;
            txt(wd, lx, y + 312 + li * 46, { font: f, color: col, alpha: a });
            lx += measure(wd + ' ', f);
          });
        });
        // sources row
        const sr = inv(t0 + 1.2, t0 + 1.5, t);
        ctx.save(); ctx.globalAlpha *= sr;
        chip('IPCC', x + 40, y + 280 + bh, { font: SANS(600, 20), h: 40 });
        chip('NOAA', x + 140, y + 280 + bh, { font: SANS(600, 20), h: 40 });
        ctx.restore();
      }, { dy: 30, s0: 0.96, cx: x + 300, cy: y + 350 });
    }, { cx: 540, cy: 470 });
    // big number (right)
    const nx = 1040;
    rise(t, t0 + 0.35, () => chip('CO₂ IN DER LUFT', nx, 240, { bg: '#e9e3ff', color: [100, 70, 255], font: SANS(700, 22), ls: 2 }), { dy: 30 });
    rise(t, t0 + 0.45, () => {
      const v = lerp(280, 424, E.outExpo(inv(t0 + 0.45, t0 + 1.4, t)));
      txt(String(Math.round(v)), nx - 12, 560, { font: DISP(800, 300), color: INK, ls: -8 });
      txt('ppm', nx + measure(String(Math.round(v)), DISP(800, 300), -8) + 10, 560, { font: SANS(600, 56), color: GRAY });
    }, { dy: 60 });
    rise(t, t0 + 0.8, () => {
      let cx = nx;
      cx += chip('↑ +51 % seit 1750', cx, 620, { bg: '#ffe4df', color: [220, 50, 30], font: SANS(600, 26), h: 56 }) + 14;
      chip('Höchster Wert seit 800.000 Jahren', nx, 690, { font: SANS(600, 26), h: 56 });
    }, { dy: 30 });
  }

  const DECADES = [-0.05, -0.12, -0.2, -0.12, 0.0, 0.08, 0.1, 0.05, 0.1, 0.25, 0.45, 0.62, 0.82, 1.0, 1.32];
  const BLUE_RED = [[60, 120, 255], [130, 170, 255], [255, 190, 120], [255, 110, 70], [235, 40, 40]];
  function blockB(t) {
    const t0 = C.blocks[1];
    const x = 330, y = 120, w = 1080, h = 700;
    rise(t, t0, () => {
      card(x, y, w, h, 44);
      txt('GLOBALE TEMPERATUR', x + 60, y + 86, { font: SANS(700, 22), color: GRAY, ls: 2 });
      const v = 1.3 * E.outExpo(inv(t0 + 0.2, t0 + 1.1, t));
      txt('+' + v.toFixed(1).replace('.', ',') + ' °C', x + 56, y + 200, { font: DISP(800, 110), color: INK, ls: -2 });
      chip('ggü. 1850–1900', x + 470, y + 150, { bg: '#ffe4df', color: [220, 50, 30], font: SANS(600, 24), h: 52 });
      // bars
      const bx = x + 60, by = y + h - 90, bw = (w - 120) / DECADES.length;
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by - 0.45 * 300 * 0 - 2); ctx.lineTo(bx + w - 120, by - 2); ctx.stroke();
      DECADES.forEach((a, i) => {
        const p = E.outBack(inv(t0 + 0.25 + i * 0.045, t0 + 0.75 + i * 0.045, t));
        const hh = (a + 0.3) * 260 * p;
        const col = ramp(BLUE_RED, (a + 0.2) / 1.5);
        rr(bx + i * bw + 8, by - hh, bw - 16, Math.max(0, hh), 10); ctx.fillStyle = rgba(col); ctx.fill();
      });
      txt('1880er', bx + 8, by + 46, { font: SANS(500, 22), color: GRAY });
      txt('2020er', bx + w - 128, by + 46, { font: SANS(500, 22), color: GRAY, align: 'right' });
      // tooltip on last bar
      const tp = E.outBack(inv(t0 + 1.0, t0 + 1.35, t));
      if (tp > 0) {
        const lx = bx + (DECADES.length - 1) * bw + bw / 2, ly = by - (DECADES[14] + 0.3) * 260 - 30;
        ctx.save(); ctx.translate(lx, ly); ctx.scale(tp, tp);
        rr(-170, -70, 170, 56, 16); ctx.fillStyle = INK.join ? rgba(INK) : INK; ctx.fill();
        txt('heute', -150, -34, { font: SANS(600, 24), color: WHITE });
        txt('▲', -60, -34, { font: SANS(600, 22), color: [255, 90, 70] });
        ctx.restore();
      }
    }, { cx: x + w / 2, cy: y + h / 2 });
    // floating phone widget
    rise(t, t0 + 0.4, () => {
      ctx.save(); ctx.translate(1520, 180 + Math.sin(t * 2) * 8); ctx.rotate(0.08);
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
      rr(0, 0, 250, 400, 46); ctx.fillStyle = '#121218'; ctx.fill(); ctx.shadowColor = 'transparent';
      const gg = ctx.createLinearGradient(0, 0, 0, 400); gg.addColorStop(0, '#ff8a3c'); gg.addColorStop(1, '#d6283c');
      rr(14, 14, 222, 372, 34); ctx.fillStyle = gg; ctx.fill();
      txt('Heute', 40, 76, { font: SANS(600, 24), color: [255, 235, 220] });
      icon('sun', 125, 160, 1.5, '#fff', t);
      txt('38°', 125, 300, { font: DISP(800, 96), color: WHITE, align: 'center' });
      txt('Hitzetag Nr. 14', 125, 346, { font: SANS(600, 20), color: [255, 235, 220], align: 'center' });
      ctx.restore();
    }, { dy: 120, s0: 0.85 });
  }

  const TILES = [
    ['sun', 'Hitze', 'mehr Hitzetage', '#ffa13c', '#ff3b3b'],
    ['drought', 'Dürre', 'Ernten fallen aus', '#e7b45d', '#9a5b2b'],
    ['fire', 'Waldbrände', 'größer & häufiger', '#ff6a2a', '#6a1010'],
    ['flood', 'Fluten', 'mehr Starkregen', '#4c95ff', '#123a8a'],
    ['ice', 'Eisschmelze', 'Meere steigen', '#8fe0ff', '#3a6fd0'],
    ['storm', 'Stürme', 'werden heftiger', '#8f7dff', '#2e2a5a'],
  ];
  function blockC(t) {
    const t0 = C.blocks[2];
    segLine([{ s: 'Was das', font: DISP(800, 120), color: INK, t0: t0, dy: 40 }], 150, 430, t);
    segLine([{ s: 'bedeutet.', font: SERIF(150), color: [230, 70, 40], t0: t0 + 0.12, dy: 40 }], 150, 560, t);
    segLine([{ s: 'Die Folgen spüren wir schon heute.', font: SANS(500, 30), color: GRAY, t0: t0 + 0.35, dy: 20 }], 154, 630, t);
    const r = rng(9), tw = 340, th = 300, gx = 790, gy = 150, gap = 30;
    TILES.forEach((tl, i) => {
      const col = i % 3, row = (i / 3) | 0;
      const fx = gx + col * (tw + gap), fy = gy + row * (th + gap);
      const sx = fx + (r() - 0.5) * 700, sy = fy + 500 + r() * 300, rot = (r() - 0.5) * 0.8;
      const p = inv(t0 + 0.1 + i * 0.07, t0 + 0.75 + i * 0.07, t); if (p <= 0) return;
      const e = E.outBack(p), e2 = E.outExpo(p);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 3);
      ctx.translate(lerp(sx, fx, e2) + tw / 2, lerp(sy, fy, e2) + th / 2); ctx.rotate(rot * (1 - e)); ctx.scale(lerp(0.6, 1, e), lerp(0.6, 1, e));
      ctx.save(); ctx.shadowColor = 'rgba(30,20,40,0.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
      rr(-tw / 2, -th / 2, tw, th, 34); const g = ctx.createLinearGradient(-tw / 2, -th / 2, tw / 2, th / 2); g.addColorStop(0, tl[3]); g.addColorStop(1, tl[4]); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.save(); rr(-tw / 2, -th / 2, tw, th, 34); ctx.clip();
      const hl = ctx.createRadialGradient(-tw / 4, -th / 3, 0, -tw / 4, -th / 3, 260); hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fillRect(-tw / 2, -th / 2, tw, th);
      ctx.restore();
      icon(tl[0], -tw / 2 + 64, -th / 2 + 70, 1.25, '#fff', t);
      txt(tl[1], -tw / 2 + 30, th / 2 - 68, { font: DISP(800, 46), color: WHITE });
      txt(tl[2], -tw / 2 + 32, th / 2 - 30, { font: SANS(500, 24), color: [255, 255, 255], alpha: 0.85 });
      ctx.restore();
    });
  }

  // persistent bottom pill (light scenes) → becomes the white pill / line of the finale
  function bottomPill(t) {
    const B = C.blocks, f = C.finale;
    const appear = E.outExpo(inv(B[0] + 0.1, B[0] + 0.7, t));
    if (appear <= 0) return;
    const toCenter = E.inOutCubic(inv(16.85, f.line, t));
    const squash = E.inOutCubic(inv(f.line, f.line + 0.35, t));
    const stretch = E.outExpo(inv(f.reveal - 0.1, f.reveal + 0.5, t));
    const fadeLine = 1 - inv(f.reveal + 0.1, f.reveal + 0.7, t);
    let pw = lerp(960, 760, squash) + stretch * 900, ph = lerp(104, 6, squash);
    const cx = W / 2, cy = lerp(lerp(H + 80, 975, appear), H / 2, toCenter);
    const x = cx - pw / 2, y = cy - ph / 2;
    ctx.save(); ctx.globalAlpha = fadeLine;
    ctx.save(); ctx.shadowColor = `rgba(0,0,0,${0.12 * (1 - toCenter)})`; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    rr(x, y, pw, ph, ph / 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
    if (toCenter > 0) { ctx.save(); ctx.globalAlpha *= toCenter; ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 40; rr(x, y, pw, ph, ph / 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); }
    const ta = 1 - inv(16.85, 17.05, t);
    if (ta > 0) {
      ctx.save(); ctx.globalAlpha *= ta;
      icon('spark', x + 56, cy, 0.75, '#111');
      // which query?
      const bi = t < B[1] ? 0 : t < B[2] ? 1 : 2, q = C.pillQueries[bi];
      const n = Math.floor(inv(B[bi] + 0.15, B[bi] + 0.85, t) * q.length);
      txt(q.slice(0, n), x + 96, cy + 1, { font: SANS(500, 32), color: INK, base: 'middle' });
      const cw = measure(q.slice(0, n), SANS(500, 32));
      if (n < q.length || Math.floor(t * 2.5) % 2 === 0) { ctx.fillStyle = '#111'; ctx.fillRect(x + 100 + cw, cy - 18, 2.5, 36); }
      ctx.beginPath(); ctx.arc(x + pw - 54, cy, 32, 0, TAU); ctx.fillStyle = '#111'; ctx.fill();
      icon('arrow', x + pw - 54, cy, 0.75, '#fff');
      ctx.restore();
    }
    ctx.restore();
  }

  function lightScene(t) {
    lightBg(t);
    const B = C.blocks;
    // vertical "scroll" between blocks
    const sc = H * (E.inOutCubic(inv(B[1] - 0.1, B[1] + 0.4, t)) + E.inOutCubic(inv(B[2] - 0.1, B[2] + 0.4, t)));
    const fin = E.inOutCubic(inv(16.85, 17.15, t));
    ctx.save();
    ctx.globalAlpha = 1 - fin;
    ctx.translate(W / 2, H / 2); ctx.scale(1 - fin * 0.08, 1 - fin * 0.08); ctx.translate(-W / 2, -H / 2);
    ctx.translate(0, -sc);
    if (t < B[1] + 0.45) blockA(t);
    if (t > B[1] - 0.15 && t < B[2] + 0.45) { ctx.save(); ctx.translate(0, H); blockB(t); ctx.restore(); }
    if (t > B[2] - 0.15) { ctx.save(); ctx.translate(0, 2 * H); blockC(t); ctx.restore(); }
    ctx.restore();
  }

  // ================= SCENE 6: finale =================
  function finale(t) {
    const f = C.finale;
    const dark = E.inOutCubic(inv(16.85, 17.15, t));
    ctx.fillStyle = `rgba(3,3,6,${dark})`; ctx.fillRect(0, 0, W, H);
    if (t < f.reveal - 0.1) return;
    const glow = inv(f.reveal, f.reveal + 1.2, t);
    const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, 900);
    g.addColorStop(0, `rgba(255,120,60,${0.16 * glow * (0.85 + 0.15 * Math.sin(t * 3))})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    segLine([{ s: 'Ziel des Pariser Klimaabkommens:', font: SANS(500, 42), color: [210, 210, 222], t0: f.reveal }], W / 2, 330, t, { align: 'center' });
    // title on its own layer for a light sweep clipped to glyphs
    const lc = layer.getContext('2d'); lc.clearRect(0, 0, W, 360);
    swapCtx(lc, () => segLine([
      { s: 'max. 1,5 °C', font: DISP(800, 250), color: WHITE, t0: f.reveal + 0.1, dur: 0.8, dy: 70 },
    ], W / 2, 290, t, { align: 'center' }));
    const sw = inv(f.end + 0.3, f.end + 1.0, t);
    if (sw > 0 && sw < 1) {
      lc.save(); lc.globalCompositeOperation = 'source-atop';
      const sx = lerp(-300, W + 300, E.inOutSine(sw)), sg = lc.createLinearGradient(sx - 200, 0, sx + 200, 0);
      sg.addColorStop(0, 'rgba(255,170,120,0)'); sg.addColorStop(0.5, 'rgba(255,170,120,1)'); sg.addColorStop(1, 'rgba(255,170,120,0)');
      lc.fillStyle = sg; lc.fillRect(0, 0, W, 360); lc.restore();
    }
    ctx.save(); ctx.shadowColor = 'rgba(255,140,90,0.35)'; ctx.shadowBlur = 60; ctx.drawImage(layer, 0, 300); ctx.restore();
    segLine([{ s: 'Jedes Zehntelgrad zählt.', font: SERIF(130), color: [255, 196, 150], t0: f.tagline, dur: 0.9 }], W / 2, 770, t, { align: 'center' });
    txt('KLIMAWANDEL  ·  ERKLÄRT', W / 2, 960, { font: SANS(600, 24), color: [160, 160, 175], ls: 10, align: 'center', alpha: inv(f.end, f.end + 0.5, t) });
  }
  const layer = document.createElement('canvas'); layer.width = W; layer.height = 360;

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
    const S = C.scenes;
    const shake = 6 * decay(t, S.trails, 8) + 4 * decay(t, C.finale.reveal, 8);
    if (shake > 0.05) ctx.translate(Math.sin(t * 91) * shake, Math.cos(t * 73) * shake);

    if (t < S.search) {
      nebula(t, 1 - inv(6.2, 6.6, t));
      const defocus = E.inOutCubic(inv(3.0, 3.7, t));
      cloud(t, defocus, 1 - 0.55 * defocus - 0.45 * inv(5.9, 6.6, t));
      if (t > 3.0) { ctx.fillStyle = `rgba(5,4,12,${0.45 * defocus})`; ctx.fillRect(0, 0, W, H); counter(t); }
      // opening: whoosh out of darkness
      const fi = 1 - inv(0, 0.4, t); if (fi > 0) { ctx.fillStyle = `rgba(0,0,0,${fi})`; ctx.fillRect(0, 0, W, H); }
    } else if (t < S.trails - 0.2) {
      ctx.fillStyle = '#030306'; ctx.fillRect(0, 0, W, H);
      searchPill(t);
    } else if (t < S.light) {
      trailsScene(t);
      if (t < S.trails + 0.05) searchPill(t);
      // iris to light
      const ir = E.inExpo(inv(12.1, S.light, t));
      if (ir > 0) { ctx.fillStyle = LIGHT_BG; ctx.beginPath(); ctx.arc(W / 2, H / 2, ir * 1150, 0, TAU); ctx.fill(); }
    } else {
      lightScene(t);
      finale(t);
      bottomPill(t);
    }
    ctx.restore();

    // flash on the burst into the trails
    const fl = 0.5 * decay(t, S.trails, 7);
    if (fl > 0.005) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H); }
    // vignette (dark scenes only)
    const darkness = t < S.light ? 1 : inv(16.85, 17.15, t);
    if (darkness > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.55 * darkness})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
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
    document.fonts.load(DISP(800, 100)), document.fonts.load(DISP(700, 100)), document.fonts.load(SANS(500, 30)),
    document.fonts.load(SANS(600, 30)), document.fonts.load(SANS(700, 30)), document.fonts.load(SANS(400, 30)),
    document.fonts.load(SERIF(100)), document.fonts.load(SERIF(100), 'äöüß'),
  ]).catch(() => {});
  window.__ready = fontsReady.then(() => { buildCloud(); render(0); return true; });
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
