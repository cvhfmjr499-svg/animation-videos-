// Klimawandel in 15 Sekunden — deterministic canvas renderer.
// Every frame is a pure function of time t, so the page can be scrubbed live
// (window.__maTimeline.seek(t)) and rendered frame-exactly to MP4 by render.cjs.
(() => {
  const C = window.CUES;
  const W = 1920, H = 1080, DUR = C.duration;
  const cv = document.getElementById('c');
  const mainCtx = cv.getContext('2d');
  let ctx = mainCtx; // rebound temporarily when drawing into offscreen layers

  // All on-screen copy in one place (swap here for another language).
  const T = {
    s1a: 'Sonnenlicht wärmt die Erde.',
    s1b: 'Ein Teil der Wärme strahlt zurück ins All.',
    s2a: 'Wir verbrennen Kohle, Öl und Gas.',
    s2b: 'Dabei entsteht CO₂.',
    s2c: 'CO₂ IN DER LUFT',
    s3a: 'CO₂ hält die Wärme fest –',
    s3b: 'wie eine Decke.',
    s3c: 'WÄRMER SEIT 1850',
    s4h: 'DIE FOLGEN',
    cards: [
      ['HITZEWELLEN', 'mehr und heißere Hitzetage'],
      ['EIS SCHMILZT', 'Gletscher und Polkappen schrumpfen'],
      ['MEERESSPIEGEL STEIGT', 'Küsten werden überflutet'],
      ['EXTREMWETTER', 'Dürren, Stürme, Starkregen'],
    ],
    k: 'DAS IST DER',
    title: 'KLIMAWANDEL',
    hope: 'Weniger CO₂ = weniger Erwärmung.',
    lblSun: 'SONNENLICHT', lblIr: 'WÄRMESTRAHLUNG',
  };

  // ---------- math / easing ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, t) => clamp((t - a) / (b - a));
  const E = {
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  };
  const TAU = Math.PI * 2;
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
  function ramp(stops, v) {
    v = clamp(v) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(v));
    return mix(stops[i], stops[i + 1], v - i);
  }

  // ---------- palette ----------
  const P = {
    bg: [4, 7, 15], ink: [238, 243, 255], dim: [150, 162, 190],
    sun: [255, 206, 84], ir: [255, 96, 54], teal: [61, 255, 181],
    co2: [170, 176, 190], hot: [255, 70, 45], amber: [255, 170, 60],
  };
  const LAND = [[78, 205, 140], [190, 210, 90], [255, 170, 60], [255, 80, 50]];
  const COOL = [61, 230, 181];

  const font = (w, s, fam = 'Inter Display') => `${w} ${s}px "${fam}"`;
  const MONO = (s, w = 500) => `${w} ${s}px "JetBrains Mono"`;

  // ---------- story-level curves ----------
  const blanketAt = t => (t < 12 ? E.inOutCubic(inv(3.5, 6.2, t)) : lerp(1, 0.35, E.inOutCubic(inv(13.3, 14.6, t))));
  const heatAt = t => (t < 12 ? E.inOutCubic(inv(6.2, 8.7, t)) : lerp(1, 0, E.inOutCubic(inv(13.3, 14.6, t))));

  // ---------- precomputed geometry ----------
  const landF = (lat, lon) =>
    Math.sin(3 * lon + 1.3) * Math.cos(2 * lat) + 0.6 * Math.sin(5 * lon - 2 * lat + 0.7) +
    0.45 * Math.cos(7 * lat + 4 * lon + 2.1) + 0.25 * Math.sin(11 * lon + 3 * lat);
  const GLOBE = [];
  {
    const N = 7000, ga = Math.PI * (3 - Math.sqrt(5)), r = rng(11);
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, rr = Math.sqrt(1 - y * y), th = ga * i;
      const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
      const lat = Math.asin(y), lon = Math.atan2(z, x);
      const f = landF(lat, lon);
      if (f > 0.5 || Math.abs(lat) > 1.25) GLOBE.push({ x, y, z, v: r(), ice: Math.abs(lat) > 1.2 });
    }
  }
  const STARS = [];
  { const r = rng(3); for (let i = 0; i < 380; i++) STARS.push({ x: r() * W, y: r() * H, s: r() * 1.6 + 0.3, p: r() * 6.28, a: r() * 0.6 + 0.2 }); }
  const GRAIN = [];
  for (let k = 0; k < 4; k++) {
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const gc = g.getContext('2d'), id = gc.createImageData(256, 256), r = rng(100 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gc.putImageData(id, 0, 0); GRAIN.push(ctx.createPattern(g, 'repeat'));
  }
  // CO2 molecules: born at chimneys, drift up, settle into the shell around the Earth.
  const MOLS = [];
  { const r = rng(21); for (let i = 0; i < 170; i++) MOLS.push({ tb: 3.35 + r() * 2.7, c: (r() * 3) | 0, af: r() * Math.PI * 2, j: (r() - 0.5) * 0.16, sz: 0.7 + r() * 0.6, spin: r() * 6 }); }
  // Infrared photons leaving the surface.
  const PHOT = [];
  { const r = rng(33); for (let i = 0; i < 110; i++) PHOT.push({ ts: 1.25 + i * 0.07 + r() * 0.05, a: -Math.PI * 0.95 + r() * Math.PI * 1.3, roll: r() }); }

  // ---------- layout of the Earth scene (scenes 1–3, 5) ----------
  function earthCam(t) {
    // globe center / radius drift: subtle push-in through the explanation, recentred for outro
    if (t < 12) {
      const push = E.inOutSine(inv(0, 9, t));
      return { cx: lerp(1310, 1290, push), cy: 530, R: lerp(272, 290, push), sun: [lerp(250, 270, push), 235] };
    }
    const e = E.outExpo(inv(12.0, 12.9, t));
    return { cx: 960, cy: lerp(560, 345, e), R: lerp(330, 185, e), sun: [-400, -400] };
  }

  // ---------- drawing helpers ----------
  function txt(str, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font || font(800, 40);
    ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.glow) { ctx.shadowColor = o.glowColor || rgba(o.color || P.ink); ctx.shadowBlur = o.glow; }
    ctx.fillStyle = typeof o.color === 'string' ? o.color : rgba(o.color || P.ink);
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Word-by-word kinetic line: each word rises out of a blur.
  function kWords(str, x, y, t, t0, o = {}) {
    const words = str.split(' ');
    ctx.save();
    ctx.font = o.font || font(700, 58);
    ctx.letterSpacing = (o.ls || 0) + 'px';
    const sp = ctx.measureText(' ').width;
    const widths = words.map(w => ctx.measureText(w).width);
    const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let cx = o.align === 'center' ? x - total / 2 : x;
    words.forEach((w, i) => {
      const p = inv(t0 + i * (o.stagger ?? 0.06), t0 + i * (o.stagger ?? 0.06) + (o.dur ?? 0.55), t);
      if (p > 0) {
        const e = E.outExpo(p);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2.5) * (o.alpha ?? 1);
        if (e < 0.98) ctx.filter = `blur(${(1 - e) * 14}px)`;
        ctx.translate(cx, y + (1 - e) * (o.dy ?? 42));
        if (o.glow) { ctx.shadowColor = rgba(o.glowColor || o.color || P.ink, 0.8); ctx.shadowBlur = o.glow; }
        const col = o.hl && o.hl[w] ? o.hl[w] : o.color || P.ink;
        ctx.fillStyle = rgba(col);
        ctx.fillText(w, 0, 0);
        ctx.restore();
      }
      cx += widths[i] + sp;
    });
    ctx.restore();
    return total;
  }

  // Per-character kinetic (title)
  function kChars(str, cx, y, t, t0, o) {
    ctx.save();
    ctx.font = o.font; ctx.letterSpacing = '0px';
    const chars = [...str], ws = chars.map(c => ctx.measureText(c).width);
    const ls = o.ls || 0, total = ws.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
    let x = cx - total / 2;
    chars.forEach((ch, i) => {
      const a = t0 + i * o.stagger, p = inv(a, a + o.dur, t);
      if (p > 0) {
        const e = E.outExpo(p);
        ctx.save();
        ctx.translate(x + ws[i] / 2, y + (1 - e) * o.dy);
        ctx.scale(lerp(1.35, 1, e), lerp(1.35, 1, e));
        ctx.globalAlpha *= Math.min(1, p * 3);
        if (e < 0.98) ctx.filter = `blur(${(1 - e) * o.blur}px)`;
        ctx.textAlign = 'center';
        ctx.fillStyle = o.fill || rgba(P.ink);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      x += ws[i] + ls;
    });
    ctx.restore();
    return total;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- backgrounds ----------
  function space(t, warm) {
    const g = ctx.createRadialGradient(W * 0.62, H * 0.5, 50, W * 0.6, H * 0.5, W * 0.8);
    g.addColorStop(0, rgba(mix([12, 22, 48], [52, 16, 14], warm)));
    g.addColorStop(1, rgba(P.bg));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const s of STARS) {
      const a = s.a * (0.65 + 0.35 * Math.sin(t * 2.2 + s.p));
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }

  // ---------- the Earth ----------
  function globe(t, cam, heat, cool) {
    const { cx, cy, R } = cam;
    const rot = t * 0.32, tilt = 0.38, cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    // atmosphere glow
    const atm = mix(mix([90, 170, 255], P.hot, heat), COOL, cool);
    let g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.32);
    g.addColorStop(0, rgba(atm, 0.55)); g.addColorStop(1, rgba(atm, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.32, 0, TAU); ctx.fill();
    // ocean body
    g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, rgba(mix([40, 110, 190], [150, 60, 40], heat * 0.8)));
    g.addColorStop(1, rgba(mix([6, 20, 52], [40, 8, 10], heat * 0.8)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // graticule
    ctx.lineWidth = 1;
    for (let la = -60; la <= 60; la += 30) {
      const y = Math.sin(la * Math.PI / 180), rr = Math.cos(la * Math.PI / 180);
      ctx.strokeStyle = `rgba(200,225,255,${0.07})`;
      ctx.beginPath(); ctx.ellipse(cx, cy - (y * ct) * R, rr * R, Math.abs(rr * st) * R, 0, 0, Math.PI); ctx.stroke();
    }
    // land dots
    const landHeat = ramp(LAND, heat);
    for (const p of GLOBE) {
      const x = p.x * cr - p.z * sr, z0 = p.x * sr + p.z * cr;
      const y = p.y * ct - z0 * st, z = p.y * st + z0 * ct;
      if (z < 0.02) continue;
      let col = p.ice ? mix([235, 245, 255], [120, 190, 255], heat) : mix(landHeat, ramp(LAND, clamp(heat + p.v * 0.25 * heat)), 0.5);
      col = mix(col, COOL, cool * (p.ice ? 0.2 : 0.75));
      const sz = (1.6 + 1.6 * z) * (R / 300);
      ctx.fillStyle = rgba(col, 0.35 + 0.65 * z);
      ctx.fillRect(cx + x * R - sz / 2, cy - y * R - sz / 2, sz, sz);
    }
    // terminator shading (sun from upper-left)
    g = ctx.createLinearGradient(cx - R, cy - R * 0.6, cx + R, cy + R * 0.6);
    g.addColorStop(0, 'rgba(255,240,200,0.10)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // heat bloom
    if (heat > 0.01) {
      g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.05);
      g.addColorStop(0, rgba(P.hot, 0)); g.addColorStop(1, rgba(P.hot, 0.32 * heat * (1 - cool)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    }
    // rim light
    ctx.strokeStyle = rgba(atm, 0.8); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  }

  function sunAndRays(t, cam, alpha) {
    if (alpha <= 0) return;
    const [sx, sy] = cam.sun, appear = E.outExpo(inv(0.0, 0.9, t));
    ctx.save(); ctx.globalAlpha *= alpha;
    // corona
    const pulse = 1 + 0.04 * Math.sin(t * 5);
    let g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260 * pulse * appear);
    g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.25, rgba(P.sun, 0.55)); g.addColorStop(1, rgba(P.sun, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 260 * pulse, 0, TAU); ctx.fill();
    // spikes
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.25);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.fillStyle = rgba(P.sun, 0.18);
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(150 * appear * (i % 2 ? 0.7 : 1), 0); ctx.lineTo(0, 6); ctx.fill();
    }
    ctx.restore();
    ctx.save(); ctx.shadowColor = 'rgba(255,220,120,1)'; ctx.shadowBlur = 80; ctx.fillStyle = 'rgb(255,250,232)'; ctx.beginPath(); ctx.arc(sx, sy, 62 * appear, 0, TAU); ctx.fill(); ctx.fill(); ctx.restore();
    { const cg = ctx.createRadialGradient(sx - 15, sy - 15, 5, sx, sy, 62 * appear); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, 'rgba(255,214,110,1)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(sx, sy, 62 * appear, 0, TAU); ctx.fill(); }

    // incoming sunlight beams → Earth
    const { cx, cy, R } = cam;
    const dx = cx - sx, dy = cy - sy, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    for (let i = 0; i < 6; i++) {
      const off = (i - 2.5) * R * 0.28;
      const x0 = sx + ux * 90 + nx * off * 0.35, y0 = sy + uy * 90 + ny * off * 0.35;
      // where the beam meets the globe surface
      const ex = cx + nx * off - ux * Math.sqrt(Math.max(0, R * R - off * off));
      const ey = cy + ny * off - uy * Math.sqrt(Math.max(0, R * R - off * off));
      const grow = E.outCubic(inv(0.25 + i * 0.06, 1.0 + i * 0.06, t));
      const lx = lerp(x0, ex, grow), ly = lerp(y0, ey, grow);
      const lg = ctx.createLinearGradient(x0, y0, ex, ey);
      lg.addColorStop(0, rgba(P.sun, 0.0)); lg.addColorStop(0.3, rgba(P.sun, 0.5)); lg.addColorStop(1, rgba(P.sun, 0.9));
      ctx.strokeStyle = lg; ctx.lineWidth = 3; ctx.setLineDash([26, 18]); ctx.lineDashOffset = -t * 260;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.setLineDash([]);
      // impact sparkle
      if (grow >= 1) {
        const k = 0.5 + 0.5 * Math.sin(t * 9 + i);
        ctx.fillStyle = rgba(P.sun, 0.35 + 0.4 * k);
        ctx.beginPath(); ctx.arc(ex, ey, 5 + 3 * k, 0, TAU); ctx.fill();
      }
    }
    // beam label
    const la = inv(0.8, 1.3, t) * (1 - inv(5.6, 6.0, t));
    if (la > 0) {
      ctx.save(); ctx.translate(lerp(sx, cx, 0.45) + nx * -150, lerp(sy, cy, 0.45) + ny * -150); ctx.rotate(Math.atan2(uy, ux));
      txt(T.lblSun, 0, 0, { font: MONO(18, 600), ls: 5, color: P.sun, alpha: la * 0.9, align: 'center' });
      ctx.restore();
    }
    ctx.restore();
  }

  // Infrared photons: escape early on, get trapped by the CO2 shell later.
  function photons(t, cam, alpha) {
    if (alpha <= 0) return;
    const { cx, cy, R } = cam, Rs = R * 1.45, speed = 330;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round';
    for (const ph of PHOT) {
      const age = t - ph.ts; if (age < 0 || age > 2.4) continue;
      const tHit = ph.ts + (Rs - R) / speed;
      const bounce = ph.roll < blanketAt(tHit) * 0.85;
      const rAt = a => {
        if (a < 0) return null;
        const r = R + speed * a;
        if (!bounce || r <= Rs) return r;
        const back = Rs - (r - Rs);
        return back < R ? null : back;
      };
      const fadeOut = 1 - inv(1.6, 2.4, age);
      // trail sampled back in time → wavy infrared squiggle
      ctx.beginPath(); let started = false;
      for (let k = 0; k <= 18; k++) {
        const a = age - k * 0.016; const r = rAt(a); if (r == null) break;
        const wig = Math.sin((a * speed) / 9) * 7;
        const px = cx + Math.cos(ph.a) * r - Math.sin(ph.a) * wig;
        const py = cy + Math.sin(ph.a) * r + Math.cos(ph.a) * wig;
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      if (!started) continue;
      const warm = bounce && R + speed * age > Rs ? 1 : 0;
      ctx.strokeStyle = rgba(mix(P.ir, [255, 40, 30], warm), 0.9 * fadeOut);
      ctx.lineWidth = 3.2;
      ctx.shadowColor = rgba(P.ir); ctx.shadowBlur = 12;
      ctx.stroke();
      // bounce flash on the shell
      if (bounce) {
        const f = gauss(t, tHit, 0.06);
        if (f > 0.02) {
          ctx.fillStyle = rgba([255, 150, 90], f * 0.9);
          ctx.beginPath(); ctx.arc(cx + Math.cos(ph.a) * Rs, cy + Math.sin(ph.a) * Rs, 10 * f + 3, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.restore();
    const la = inv(1.6, 2.1, t) * (1 - inv(3.2, 3.6, t));
    if (la > 0) txt(T.lblIr, cx + R * 0.55, cy - R * 1.12, { font: MONO(18, 600), ls: 5, color: P.ir, alpha: la * 0.9 });
  }

  // CO2 shell + chimneys + molecules
  const CHIMNEY_ANG = [-2.25, -1.85, -1.45];
  function co2(t, cam, alpha) {
    if (alpha <= 0) return;
    const { cx, cy, R } = cam, Rs = R * 1.45, B = blanketAt(t);
    ctx.save(); ctx.globalAlpha *= alpha;
    // shell haze
    if (B > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, Rs - 55, cx, cy, Rs + 55);
      g.addColorStop(0, rgba(P.co2, 0)); g.addColorStop(0.5, rgba(mix(P.co2, [255, 140, 90], heatAt(t)), 0.30 * B)); g.addColorStop(1, rgba(P.co2, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, Rs + 55, 0, TAU); ctx.arc(cx, cy, Rs - 55, 0, TAU, true); ctx.fill();
      ctx.strokeStyle = rgba(P.co2, 0.35 * B); ctx.lineWidth = 1.5; ctx.setLineDash([4, 10]); ctx.lineDashOffset = t * 20;
      ctx.beginPath(); ctx.arc(cx, cy, Rs, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    // chimneys (fade out in outro)
    const chA = E.outBack(inv(3.1, 3.6, t)) * (t < 12 ? 1 : 0);
    if (chA > 0) {
      CHIMNEY_ANG.forEach((a, i) => {
        const e = E.outBack(inv(3.1 + i * 0.08, 3.6 + i * 0.08, t));
        ctx.save(); ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.rotate(a + Math.PI / 2); ctx.scale(e, e);
        ctx.fillStyle = '#1b1f2b'; ctx.strokeStyle = 'rgba(200,210,230,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(-22, -30, 44, 30); ctx.rect(4, -62, 12, 34); ctx.fill(); ctx.stroke();
        // smoke puffs
        for (let k = 0; k < 4; k++) {
          const ph = (t * 1.2 + k / 4 + i * 0.3) % 1;
          ctx.fillStyle = `rgba(150,155,170,${0.45 * (1 - ph)})`;
          ctx.beginPath(); ctx.arc(10 + Math.sin(ph * 6 + k) * 8, -70 - ph * 70, 8 + ph * 18, 0, TAU); ctx.fill();
        }
        ctx.restore();
      });
    }
    // molecules
    for (const m of MOLS) {
      const p = inv(m.tb, m.tb + 1.6, t); if (p <= 0) continue;
      const a0 = CHIMNEY_ANG[m.c];
      const e = E.inOutCubic(p);
      const ang = lerp(a0, m.af, e) + (p >= 1 ? (t - m.tb - 1.6) * 0.05 : 0);
      const r = lerp(R + 70, Rs * (1 + m.j), E.outCubic(p));
      const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
      const fade = t < 12 ? 1 : 1 - (m.af % 1 < 0.6 ? 0 : 1) * inv(13.3, 14.4, t) - 0.35 * inv(13.3, 14.4, t);
      const s = m.sz * (R / 300) * Math.min(1, p * 4);
      ctx.save(); ctx.translate(x, y); ctx.rotate(m.spin + t * 0.8); ctx.globalAlpha *= clamp(fade);
      ctx.fillStyle = 'rgba(235,90,80,0.9)';
      ctx.beginPath(); ctx.arc(-11 * s, 0, 5.5 * s, 0, TAU); ctx.arc(11 * s, 0, 5.5 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(60,64,78,1)'; ctx.strokeStyle = 'rgba(200,205,220,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 7 * s, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // labelled hero molecule
    const la = inv(4.1, 4.6, t) * (1 - inv(5.7, 6.1, t));
    if (la > 0) {
      const a = -0.6, x = cx + Math.cos(a) * Rs, y = cy + Math.sin(a) * Rs;
      ctx.strokeStyle = rgba(P.ink, 0.5 * la); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + 12, y - 12); ctx.lineTo(x + 70, y - 70); ctx.lineTo(x + 140, y - 70); ctx.stroke();
      txt('CO₂', x + 150, y - 60, { font: font(800, 40), color: P.ink, alpha: la });
    }
    ctx.restore();
  }

  // Left text column: headline lines + data chip; exits upward with blur.
  function textBlock(t, t0, t1, lines, chip) {
    const out = E.inCubic(inv(t1 - 0.35, t1, t));
    ctx.save();
    ctx.globalAlpha = 1 - out;
    if (out > 0) ctx.filter = `blur(${out * 12}px)`;
    ctx.translate(0, -out * 40);
    const x = 120;
    lines.forEach((L, i) => kWords(L.s, x, L.y, t, t0 + (L.d || 0), { font: L.f, color: L.c || P.ink, hl: L.hl, glow: L.glow, glowColor: L.gc }));
    if (chip) chip();
    ctx.restore();
  }

  // ---------- scene 4 icons ----------
  function icon(k, x, y, s, t, lt) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (k === 0) { // thermometer + sun
      const lvl = E.outCubic(inv(0.1, 0.9, lt));
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t; ctx.strokeStyle = rgba(P.sun, 0.8); ctx.beginPath(); ctx.moveTo(40 + Math.cos(a) * 34, -40 + Math.sin(a) * 34); ctx.lineTo(40 + Math.cos(a) * 46, -40 + Math.sin(a) * 46); ctx.stroke(); }
      ctx.fillStyle = rgba(P.sun); ctx.beginPath(); ctx.arc(40, -40, 22, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(P.ink); roundRect(-30, -60, 30, 100, 15); ctx.stroke();
      ctx.fillStyle = rgba(P.hot); ctx.beginPath(); ctx.arc(-15, 50, 22, 0, TAU); ctx.fill();
      ctx.fillRect(-21, 50 - lvl * 100, 12, lvl * 100);
    } else if (k === 1) { // iceberg shrinking + drops
      const m = E.inOutSine(inv(0, 1.4, lt));
      ctx.fillStyle = 'rgba(200,235,255,0.95)';
      ctx.beginPath(); ctx.moveTo(-60, 30); ctx.lineTo(-25, lerp(-60, -25, m)); ctx.lineTo(5, lerp(-35, -10, m)); ctx.lineTo(30, lerp(-70, -30, m)); ctx.lineTo(60, 30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,170,255,0.9)';
      ctx.beginPath(); for (let i = -80; i <= 80; i += 10) ctx.lineTo(i, 36 + Math.sin(i / 12 + t * 4) * 4); ctx.stroke();
      for (let d = 0; d < 3; d++) { const ph = (lt * 1.4 + d / 3) % 1; ctx.fillStyle = `rgba(120,200,255,${1 - ph})`; ctx.beginPath(); ctx.arc(-30 + d * 30, 40 + ph * 40, 5, 0, TAU); ctx.fill(); }
    } else if (k === 2) { // house + rising water
      const lv = E.outCubic(inv(0.1, 1.2, lt));
      ctx.strokeStyle = rgba(P.ink); ctx.beginPath(); ctx.moveTo(-40, 40); ctx.lineTo(-40, -10); ctx.lineTo(0, -45); ctx.lineTo(40, -10); ctx.lineTo(40, 40); ctx.stroke();
      const wy = lerp(55, 0, lv);
      ctx.fillStyle = 'rgba(60,150,255,0.75)';
      ctx.beginPath(); ctx.moveTo(-75, 70); for (let i = -75; i <= 75; i += 6) ctx.lineTo(i, wy + Math.sin(i / 10 + t * 5) * 5); ctx.lineTo(75, 70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(P.hot); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(62, 40); ctx.lineTo(62, -40); ctx.moveTo(50, -26); ctx.lineTo(62, -42); ctx.lineTo(74, -26); ctx.stroke();
    } else { // storm cloud + lightning + rain
      ctx.fillStyle = 'rgba(170,180,200,0.95)';
      ctx.beginPath(); ctx.arc(-25, -15, 28, 0, TAU); ctx.arc(10, -30, 34, 0, TAU); ctx.arc(40, -10, 24, 0, TAU); ctx.rect(-50, -12, 112, 24); ctx.fill();
      const fl = Math.max(gauss(lt, 0.25, 0.05), gauss(lt, 0.42, 0.04), gauss(lt, 1.1, 0.05));
      ctx.fillStyle = `rgba(255,230,90,${0.35 + 0.65 * fl})`;
      ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(-12, 45); ctx.lineTo(4, 45); ctx.lineTo(-8, 80); ctx.lineTo(26, 36); ctx.lineTo(10, 36); ctx.lineTo(22, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(120,180,255,0.8)'; ctx.lineWidth = 3;
      for (let d = 0; d < 6; d++) { const ph = (lt * 2 + d * 0.37) % 1, rx = -45 + d * 18; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(rx - ph * 8, 20 + ph * 60); ctx.lineTo(rx - ph * 8 - 6, 34 + ph * 60); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---------- scenes ----------
  function sceneEarth(t) {
    const cam = earthCam(t), heat = heatAt(t);
    space(t, heat);
    // zoom-through exit into scene 4 (8.75 → 9.0)
    const z = E.inExpo(inv(8.7, 9.0, t));
    ctx.save();
    if (z > 0) { ctx.translate(cam.cx, cam.cy); ctx.scale(1 + z * 3, 1 + z * 3); ctx.translate(-cam.cx, -cam.cy); }
    sunAndRays(t, cam, 1);
    co2(t, cam, 1);
    globe(t, cam, heat, 0);
    photons(t, cam, 1);
    ctx.restore();

    // ----- copy ----- (soft scrim keeps the column readable over molecules)
    { ctx.save(); ctx.translate(330, 840); ctx.scale(1.7, 0.62); const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 560); sg.addColorStop(0, 'rgba(3,5,12,0.72)'); sg.addColorStop(0.6, 'rgba(3,5,12,0.45)'); sg.addColorStop(1, 'rgba(3,5,12,0)'); ctx.fillStyle = sg; ctx.fillRect(-600, -600, 1200, 1200); ctx.restore(); }
    if (t < 3.05)
      textBlock(t, 0.35, 3.0, [
        { s: T.s1a, y: 700, f: font(800, 64) , hl: { 'Sonnenlicht': P.sun } },
        { s: T.s1b, y: 770, f: font(500, 38, 'Inter'), c: P.dim, d: 1.15, hl: { 'Wärme': P.ir } },
      ]);
    else if (t < 6.05)
      textBlock(t, 3.15, 6.0, [
        { s: T.s2a, y: 700, f: font(800, 56) },
        { s: T.s2b, y: 770, f: font(500, 38, 'Inter'), c: P.dim, d: 0.95, hl: { 'CO₂.': P.ink } },
      ], () => {
        const a = inv(4.3, 4.7, t); if (a <= 0) return;
        const v = Math.round(lerp(280, 424, E.inOutCubic(inv(4.4, 5.7, t))));
        txt(T.s2c, 120, 860, { font: MONO(20, 600), ls: 5, color: P.dim, alpha: a });
        txt(String(v), 120, 960, { font: font(900, 110), color: mix(P.ink, P.ir, inv(300, 424, v)), alpha: a });
        ctx.save(); ctx.font = font(900, 110); const w = ctx.measureText(String(v)).width; ctx.restore();
        txt('ppm', 130 + w, 960, { font: MONO(30, 600), color: P.dim, alpha: a });
        txt('vorindustriell: 280', 120, 1010, { font: MONO(22, 600), ls: 2, color: P.dim, alpha: a * 0.85 * inv(5.0, 5.4, t) });
      });
    else
      textBlock(t, 6.15, 8.85, [
        { s: T.s3a, y: 700, f: font(800, 56), hl: { 'CO₂': [200, 205, 220], 'Wärme': P.ir } },
        { s: T.s3b, y: 772, f: font(800, 56), c: P.ir, d: 0.7, glow: 24, gc: P.hot },
      ], () => {
        const a = inv(7.0, 7.4, t); if (a <= 0) return;
        const v = 1.3 * E.outCubic(inv(7.1, 8.4, t));
        const s = '+' + v.toFixed(1).replace('.', ',') + ' °C';
        const thump = 1 + 0.05 * (gauss(t, 7.5, 0.05) + gauss(t, 8.0, 0.05) + gauss(t, 8.5, 0.05));
        txt(T.s3c, 120, 860, { font: MONO(20, 600), ls: 5, color: P.dim, alpha: a });
        ctx.save(); ctx.translate(120, 975); ctx.scale(thump, thump);
        txt(s, 0, 0, { font: font(900, 120), color: mix(P.amber, P.hot, inv(0.4, 1.3, v)), glow: 40, glowColor: rgba(P.hot, 0.8), alpha: a });
        ctx.restore();
      });
  }

  const CARD_POS = [[140, 200], [990, 200], [140, 580], [990, 580]];
  function sceneImpacts(t) {
    // warm dark bg with drifting heat haze
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120807'); g.addColorStop(1, '#2a0d08');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const y = ((i * 190 + t * 60) % (H + 200)) - 100;
      const hg = ctx.createRadialGradient(W * (0.2 + 0.13 * i), y, 0, W * (0.2 + 0.13 * i), y, 380);
      hg.addColorStop(0, 'rgba(255,90,40,0.10)'); hg.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    }
    const out = E.inExpo(inv(11.72, 12.0, t));
    txt(T.s4h, W / 2, 130, { font: MONO(28, 700), ls: 14, color: P.amber, align: 'center', alpha: inv(9.0, 9.3, t) * (1 - out) });
    C.cards.forEach((ts, i) => {
      const p = inv(ts, ts + 0.45, t); if (p <= 0) return;
      const e = E.outExpo(p), [x, y] = CARD_POS[i], w = 790, h = 330;
      ctx.save();
      const s = lerp(1.25, 1, e) * (1 + out * 0.4);
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = Math.min(1, p * 3) * (1 - out);
      if (e < 0.97) ctx.filter = `blur(${(1 - e) * 16}px)`;
      // card glass
      roundRect(0, 0, w, h, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.055)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,150,0.22)'; ctx.lineWidth = 2; ctx.stroke();
      // flash on slam
      const fl = decay(t, ts, 9);
      if (fl > 0.01) { ctx.fillStyle = `rgba(255,160,110,${0.35 * fl})`; ctx.fill(); }
      // index
      txt('0' + (i + 1), 40, 62, { font: MONO(22, 700), color: P.amber, alpha: 0.85 });
      icon(i, 150, 185, 1.15, t, t - ts);
      const [h1, h2] = T.cards[i];
      const fit = (str, wt, size, fam, max) => { ctx.font = font(wt, size, fam); const m = ctx.measureText(str).width; return m > max ? Math.floor(size * max / m) : size; };
      const maxW = w - 290 - 40;
      txt(h1, 290, 170, { font: font(900, fit(h1, 900, 60, 'Inter Display', maxW)), color: P.ink });
      txt(h2, 292, 225, { font: font(500, fit(h2, 500, 30, 'Inter', maxW), 'Inter'), color: [255, 200, 175] });
      ctx.restore();
    });
  }

  function sceneOutro(t) {
    const cam = earthCam(t), heat = heatAt(t), cool = E.inOutCubic(inv(13.3, 14.6, t));
    space(t, heat * 0.6);
    // radial burst on entry
    const b = inv(12.0, 12.7, t);
    if (b > 0 && b < 1) {
      ctx.save(); ctx.translate(cam.cx, cam.cy);
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2, r0 = lerp(120, 900, E.outExpo(b)), len = 160 * (1 - b);
        ctx.strokeStyle = rgba(mix(P.ir, P.ink, (i % 3) / 3), 0.6 * (1 - b)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len)); ctx.stroke();
      }
      ctx.restore();
    }
    co2(t, cam, 1);
    globe(t, cam, heat, cool);
    // cool-down ring
    const cr = inv(13.3, 14.3, t);
    if (cr > 0 && cr < 1) {
      ctx.strokeStyle = rgba(COOL, 0.8 * (1 - cr)); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cam.cx, cam.cy, cam.R * lerp(1, 2.2, E.outCubic(cr)), 0, TAU); ctx.stroke();
    }

    txt(T.k, W / 2, 690, { font: MONO(26, 700), ls: 14, color: P.dim, align: 'center', alpha: inv(12.15, 12.5, t) });
    // title on its own layer so a light sweep can be clipped to the glyphs
    const L = titleLayer; const lc = L.getContext('2d');
    lc.clearRect(0, 0, W, 260);
    // draw chars into layer
    const ls = lerp(42, 10, E.outExpo(inv(12.25, 13.4, t)));
    const fill = (() => {
      const g = lc.createLinearGradient(0, 40, 0, 220);
      g.addColorStop(0, rgba(mix([255, 255, 255], [220, 255, 240], cool)));
      g.addColorStop(1, rgba(mix(mix(P.amber, P.hot, 0.5), COOL, cool)));
      return g;
    })();
    swapCtx(lc, () => kChars(T.title, W / 2, 180, t, 12.25, { font: font(900, 170), ls, stagger: 0.04, dur: 0.7, dy: 90, blur: 22, fill }));
    const sw = inv(13.9, 14.5, t);
    if (sw > 0 && sw < 1) {
      lc.save(); lc.globalCompositeOperation = 'source-atop';
      const sx = lerp(-300, W + 300, E.inOutSine(sw));
      const g = lc.createLinearGradient(sx - 160, 0, sx + 160, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      lc.fillStyle = g; lc.fillRect(0, 0, W, 260); lc.restore();
    }
    ctx.save();
    ctx.shadowColor = rgba(mix(P.hot, COOL, cool), 0.55); ctx.shadowBlur = 50;
    ctx.drawImage(L, 0, 680);
    ctx.restore();

    kWords(T.hope, W / 2, 975, t, C.resolve, { font: font(700, 48), color: P.ink, align: 'center', hl: { 'Weniger': COOL, 'weniger': COOL }, stagger: 0.07 });
  }
  const titleLayer = document.createElement('canvas'); titleLayer.width = W; titleLayer.height = 260;
  function swapCtx(c2, fn) { const keep = ctx; ctx = c2; try { fn(); } finally { ctx = keep; } }

  // ---------- post FX ----------
  const shakeAmp = t =>
    C.impacts.reduce((s, c) => s + 16 * decay(t, c, 7), 0) + C.cards.reduce((s, c) => s + 9 * decay(t, c, 10), 0) +
    5 * gauss(t, 8.5, 0.25) * inv(7.5, 8.6, t);
  const flashAmt = t => 0.55 * decay(t, 9.0, 9) + 0.7 * decay(t, 12.0, 7) + 0.25 * decay(t, 6.0, 10) + 0.12 * decay(t, 3.0, 8);
  const chromaAmt = t => gauss(t, 6.0, 0.06) * 0.6 + gauss(t, 8.95, 0.07) + gauss(t, 12.0, 0.07) * 0.9 + C.cards.reduce((s, c) => s + 0.45 * gauss(t, c + 0.02, 0.04), 0);

  function chroma(px) {
    const id = ctx.getImageData(0, 0, W, H), d = id.data, src = new Uint8ClampedArray(d);
    const o = Math.round(px) * 4;
    for (let i = 0; i < d.length; i += 4) {
      const ir = i + o, ib = i - o;
      d[i] = ir < d.length ? src[ir] : 0;
      d[i + 2] = ib >= 0 ? src[ib + 2] : 0;
    }
    ctx.putImageData(id, 0, 0);
  }

  // ---------- master render ----------
  function render(t) {
    t = clamp(t, 0, DUR - 1e-4);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const sa = shakeAmp(t);
    if (sa > 0.05) ctx.translate(Math.sin(t * 91) * sa, Math.cos(t * 73) * sa * 0.7);
    if (t < 9) sceneEarth(t);
    else if (t < 12) sceneImpacts(t);
    else sceneOutro(t);
    ctx.restore();

    const ca = chromaAmt(t);
    if (ca > 0.03) chroma(ca * 14);
    // flash
    const fl = flashAmt(t);
    if (fl > 0.005) { ctx.fillStyle = `rgba(255,245,235,${fl})`; ctx.fillRect(0, 0, W, H); }
    // fade from black at start
    const fi = 1 - inv(0, 0.35, t);
    if (fi > 0) { ctx.fillStyle = `rgba(0,0,0,${fi})`; ctx.fillRect(0, 0, W, H); }
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // grain
    const f = Math.floor(t * C.fps);
    ctx.save(); ctx.globalAlpha = 0.055; ctx.globalCompositeOperation = 'overlay';
    ctx.translate((f * 37) % 256, (f * 91) % 256);
    ctx.fillStyle = GRAIN[f % 4]; ctx.fillRect(-256, -256, W + 512, H + 512);
    ctx.restore();
  }

  // ---------- timeline API + live preview ----------
  const params = new URLSearchParams(location.search);
  const renderMode = params.has('render');
  let cur = 0, playing = false, last = 0;
  window.__maTimeline = { duration: DUR, fps: C.fps, seek: t => { cur = t; render(t); } };
  const fontsReady = Promise.all([
    document.fonts.load(font(900, 100)), document.fonts.load(font(800, 60)), document.fonts.load(font(700, 48)),
    document.fonts.load(font(500, 30, 'Inter')), document.fonts.load(MONO(20, 600)), document.fonts.load(MONO(20, 700)),
  ]).catch(() => {});
  window.__ready = fontsReady.then(() => { render(0); return true; });
  if (!renderMode) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = now => {
      if (playing) { cur += (now - last) / 1000; if (cur >= DUR) cur = 0; render(cur); }
      last = now; requestAnimationFrame(loop);
    };
    window.__ready.then(() => {
      if (reduce) { cur = DUR - 0.05; render(cur); } else playing = true; // reduced motion: show the end card, play on click
      requestAnimationFrame(n => { last = n; loop(n); });
    });
    cv.addEventListener('click', () => { playing = !playing; });
    addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { playing = false; cur = clamp(cur + (e.key === 'ArrowRight' ? 0.1 : -0.1), 0, DUR); render(cur); }
      if (e.key === ' ') playing = !playing;
    });
  }
})();
