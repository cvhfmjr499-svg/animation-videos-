/* kit3d.js – gemeinsame 3D-Bausteine für die Erklärvideos (Three.js r160, deterministisch).
   Jede Szene: const k = KIT.stage(canvas, opts); Objekte bauen; in einer GSAP-Uhr-Tween onUpdate: k.render(). */
(function () {
  const T = window.THREE;
  const KIT = {};

  KIT.rng = function (seed) {
    let s = seed | 0;
    return function () { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  // Studio-Umgebung: dunkler Raum mit weichen Lichtleisten -> PMREM-Envmap für Reflexionen
  KIT.envMap = function (renderer, o) {
    o = o || {};
    const s = new T.Scene();
    s.background = new T.Color(o.bg != null ? o.bg : 0x0b0b0e);
    const strip = (w, h, x, y, z, ry, c) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = ry; m.lookAt(0, 0, 0); s.add(m);
    };
    const k = o.intensity || 1;
    strip(6, 1.2, -6, 4, 4, 0, new T.Color(1, 0.96, 0.9).multiplyScalar(3.2 * k));
    strip(1.2, 8, 7, 1, -2, 0, new T.Color(0.75, 0.85, 1).multiplyScalar(2.0 * k));
    strip(8, 0.6, 0, 7, -5, 0, new T.Color(1, 1, 1).multiplyScalar(1.4 * k));
    strip(10, 3, 0, -6, 2, 0, new T.Color(0.25, 0.25, 0.28).multiplyScalar(k));
    const pm = new T.PMREMGenerator(renderer);
    const tex = pm.fromScene(s, 0.035).texture;
    pm.dispose();
    return tex;
  };

  KIT.stage = function (canvas, o) {
    o = o || {};
    const W = o.w || 1080, H = o.h || 1920;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = o.exposure || 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.environment = KIT.envMap(renderer, { bg: o.envBg, intensity: o.envIntensity });
    if (o.background != null) scene.background = new T.Color(o.background);
    const camera = new T.PerspectiveCamera(o.fov || 30, W / H, 0.01, 200);
    const st = { renderer, scene, camera, W, H, labels: [] };
    st.render = function () {
      renderer.render(scene, camera);
      for (const l of st.labels) {
        const p = KIT.project(l.v, camera, W, H);
        l.el.style.transform = `translate(${(p.x + (l.dx || 0)).toFixed(1)}px, ${(p.y + (l.dy || 0)).toFixed(1)}px)`;
      }
    };
    // HTML-Label an einen 3D-Punkt heften (Element: position absolute; left 0; top 0)
    st.pin = function (el, v, dx, dy) { st.labels.push({ el, v, dx, dy }); };
    return st;
  };

  KIT.project = function (v, camera, W, H) {
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
  };

  KIT.roundRect = function (w, h, r, shape) {
    const s = shape || new T.Shape();
    const x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  KIT.roundRectPath = function (w, h, r) { return KIT.roundRect(w, h, r, new T.Path()); };

  // Abgerundeter Quader (extrudiert, mit Fase), zentriert
  KIT.roundBox = function (w, h, d, r, bevel) {
    const b = bevel != null ? bevel : Math.min(r, d / 2) * 0.6;
    const g = new T.ExtrudeGeometry(KIT.roundRect(w - 2 * b, h - 2 * b, Math.max(0.0001, r - b)), { depth: d - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 12 });
    g.translate(0, 0, -(d - 2 * b) / 2);
    g.computeVertexNormals();
    return g;
  };

  // Platte mit Loch (z. B. Fensterrahmen)
  KIT.frame = function (ow, oh, or, iw, ih, ir, d, bevel) {
    const s = KIT.roundRect(ow, oh, or);
    s.holes.push(KIT.roundRectPath(iw, ih, ir));
    const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 24 });
    g.translate(0, 0, -d / 2);
    g.computeVertexNormals();
    return g;
  };

  KIT.canvasTex = function (w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };

  KIT.skyTex = function () {
    return KIT.canvasTex(512, 1024, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#04112e"); gr.addColorStop(0.45, "#1a4b96"); gr.addColorStop(0.72, "#6fa6e2"); gr.addColorStop(0.82, "#cfe3f6"); gr.addColorStop(1, "#eef5fb");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  };

  KIT.cloudTex = function (seed) {
    const r = KIT.rng(seed || 3);
    return KIT.canvasTex(1024, 256, (g, w, h) => {
      for (let i = 0; i < 90; i++) {
        const x = r() * w, y = h * 0.55 + (r() - 0.3) * h * 0.35, rad = 30 + r() * 70;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
      }
      g.fillStyle = "rgba(245,249,253,0.95)"; g.fillRect(0, h * 0.72, w, h);
    });
  };

  KIT.mat = {
    plastic: (c, rough) => new T.MeshPhysicalMaterial({ color: c, roughness: rough != null ? rough : 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.9 }),
    metal: (c, rough) => new T.MeshStandardMaterial({ color: c, roughness: rough != null ? rough : 0.32, metalness: 1, envMapIntensity: 1.2 }),
    glass: (c, op) => new T.MeshPhysicalMaterial({ color: c || 0xdfefff, roughness: 0.04, metalness: 0, transparent: true, opacity: op != null ? op : 0.22, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false, side: T.DoubleSide }),
    fabric: (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0, envMapIntensity: 0.4 }),
    basic: (c) => new T.MeshBasicMaterial({ color: c, toneMapped: false }),
  };

  // Spiegelnder dunkler Boden (glänzend, nimmt Schatten an)
  KIT.floor = function (scene, y, color) {
    const m = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: color || 0x141317, roughness: 0.28, metalness: 0.0, envMapIntensity: 0.8 }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m);
    return m;
  };

  KIT.keyLight = function (scene, pos, target, intensity, color) {
    const l = new T.SpotLight(color || 0xfff1e0, intensity || 60, 0, 0.6, 0.7, 2);
    l.position.copy(pos); l.target.position.copy(target || new T.Vector3());
    l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0004; l.shadow.radius = 6;
    scene.add(l); scene.add(l.target);
    return l;
  };

  window.KIT = KIT;
})();

/* Kabinenwand mit Fenster (für Hook- und Bruch-Szene) */
(function () {
  const T = window.THREE, KIT = window.KIT;
  KIT.cabin = function (k, o) {
    o = o || {};
    const scene = k.scene, h = {};
    const sky = new T.Mesh(new T.PlaneGeometry(7, 9), new T.MeshBasicMaterial({ map: KIT.skyTex(), toneMapped: false }));
    sky.position.set(0, 0.6, -3); scene.add(sky);
    const cloudTex = KIT.cloudTex(7); cloudTex.wrapS = T.RepeatWrapping;
    h.clouds = new T.Mesh(new T.PlaneGeometry(9, 2.2), new T.MeshBasicMaterial({ map: cloudTex, transparent: true, toneMapped: false }));
    h.clouds.position.set(0, -0.62, -2.6); scene.add(h.clouds);
    const ws = new T.Shape(); ws.moveTo(0, 0); ws.lineTo(2.8, 0.42); ws.lineTo(2.8, 0.5); ws.lineTo(0, 0.24); ws.lineTo(0, 0);
    const wing = new T.Mesh(new T.ExtrudeGeometry(ws, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 }), KIT.mat.plastic(0xd2d6dd, 0.3));
    wing.position.set(-0.3, -0.42, -1.5); wing.rotation.set(-1.15, 0.05, 0.18); scene.add(wing);
    h.wallMat = KIT.mat.plastic(o.wall || 0xcfc8bc, 0.6);
    const wall = new T.Mesh(KIT.frame(1.3, 1.7, 0.16, 0.34, 0.46, 0.15, 0.04, 0.012), h.wallMat);
    wall.receiveShadow = true; scene.add(wall);
    // Paneelfugen
    for (const x of [-0.42, 0.42]) { const s = new T.Mesh(new T.BoxGeometry(0.004, 1.5, 0.005), KIT.mat.plastic(0x8f897f, 0.7)); s.position.set(x, 0, 0.026); scene.add(s); }
    const rev = new T.Mesh(KIT.frame(0.36, 0.48, 0.16, 0.30, 0.42, 0.13, 0.12, 0.004), KIT.mat.plastic(0xb9b3a8, 0.6));
    rev.position.z = -0.06; scene.add(rev);
    h.bezelMat = KIT.mat.plastic(0xf3f0ea, 0.38);
    h.bezel = new T.Mesh(KIT.frame(0.44, 0.58, 0.2, 0.31, 0.43, 0.135, 0.03, 0.014), h.bezelMat);
    h.bezel.position.z = 0.035; h.bezel.castShadow = true; scene.add(h.bezel);
    const shade = new T.Mesh(KIT.roundBox(0.3, 0.07, 0.01, 0.004), KIT.mat.plastic(0xece8e0, 0.5));
    shade.position.set(0, 0.185, -0.02); scene.add(shade);
    const pane = (z, op) => { const m = new T.Mesh(new T.ShapeGeometry(KIT.roundRect(0.3, 0.42, 0.13), 24), KIT.mat.glass(0xe6f2ff, op)); m.position.z = z; scene.add(m); return m; };
    h.paneIn = pane(0.0, 0.12);
    h.paneOut = pane(-0.11, 0.16);
    // Riss-Textur
    const cc = document.createElement("canvas"); cc.width = 512; cc.height = 720;
    const ctex = new T.CanvasTexture(cc); ctex.colorSpace = T.SRGBColorSpace;
    h.crack = new T.Mesh(new T.PlaneGeometry(0.3, 0.42), new T.MeshBasicMaterial({ map: ctex, transparent: true, toneMapped: false, depthWrite: false }));
    h.crack.position.z = 0.002; scene.add(h.crack);
    let last = "";
    h.drawCrack = function (paths, p) {
      const key = paths.length + ":" + p.toFixed(3);
      if (key === last) return; last = key;
      const g = cc.getContext("2d"); g.clearRect(0, 0, 512, 720);
      g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round";
      g.shadowColor = "rgba(255,255,255,0.8)"; g.shadowBlur = 6;
      for (const pts of paths) {
        const n = pts.length / 2 - 1, upto = p * n;
        g.beginPath(); g.moveTo(pts[0], pts[1]);
        for (let i = 1; i <= n; i++) { const f = Math.min(1, Math.max(0, upto - (i - 1))); if (f <= 0) break; g.lineTo(pts[2 * i - 2] + (pts[2 * i] - pts[2 * i - 2]) * f, pts[2 * i - 1] + (pts[2 * i + 1] - pts[2 * i - 1]) * f); }
        g.stroke();
      }
      ctex.needsUpdate = true;
    };
    const seat = new T.Group();
    const back = new T.Mesh(KIT.roundBox(0.46, 0.78, 0.14, 0.07), KIT.mat.fabric(0x26324a)); back.castShadow = true; seat.add(back);
    const head = new T.Mesh(KIT.roundBox(0.4, 0.2, 0.03, 0.02), KIT.mat.fabric(0xe9e6df)); head.position.set(0, 0.25, 0.075); seat.add(head);
    seat.position.set(-0.55, -0.62, 0.55); seat.rotation.y = 0.55; scene.add(seat);
    scene.add(new T.HemisphereLight(0x9fb8ff, 0x18161a, 0.12));
    h.key = KIT.keyLight(scene, new T.Vector3(1.2, 1.4, 2.4), new T.Vector3(0, 0, 0), 34); h.key.angle = 0.17; h.key.penumbra = 1;
    h.win = new T.SpotLight(0x9cc8ff, 14, 0, 0.9, 0.8, 2); h.win.position.set(0.05, 0.2, -0.4); h.win.target.position.set(-0.1, -0.2, 1.0); scene.add(h.win); scene.add(h.win.target);
    return h;
  };
})();
/* Standard-Abdunklung: oben dunkel für die Untertitel, Ränder dunkel */
window.KIT.VIG = "linear-gradient(180deg, #0d0c0f 0%, rgba(13,12,15,0.9) 20%, rgba(13,12,15,0) 34%, rgba(13,12,15,0) 66%, rgba(13,12,15,0.9) 82%, #0d0c0f 100%), radial-gradient(ellipse 75% 45% at 50% 50%, rgba(13,12,15,0) 45%, rgba(13,12,15,0.9) 100%)";
