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

/* Nachbearbeitung: HDR-Render -> Bloom (3 Stufen) -> ACES -> sRGB, Vignette, Filmkorn. Ersetzt st.render. */
(function () {
  const T = window.THREE, KIT = window.KIT;
  const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  KIT.post = function (st, o) {
    o = o || {};
    const r = st.renderer, W = st.W, H = st.H;
    const mk = (w, h, s) => new T.WebGLRenderTarget(Math.round(w), Math.round(h), { type: T.HalfFloatType, samples: s || 0, depthBuffer: !!s });
    const main = mk(W, H, 4);
    const lv = [[mk(W / 2, H / 2), mk(W / 2, H / 2)], [mk(W / 4, H / 4), mk(W / 4, H / 4)], [mk(W / 8, H / 8), mk(W / 8, H / 8)]];
    const qs = new T.Scene(), qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
    const bright = new T.ShaderMaterial({ uniforms: { tex: { value: null }, th: { value: o.threshold || 1.0 }, knee: { value: 0.6 } }, vertexShader: VS,
      fragmentShader: "uniform sampler2D tex; uniform float th, knee; varying vec2 vUv; void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float s = clamp((l - th + knee) / (2.0 * knee), 0.0, 1.0); s = s * s * knee * 2.0; float w = max(s, l - th) / max(l, 1e-4); gl_FragColor = vec4(min(c * w, vec3(40.0)), 1.0); }" });
    const blur = new T.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new T.Vector2() } }, vertexShader: VS,
      fragmentShader: "uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(tex, vUv).rgb * 0.227027; c += texture2D(tex, vUv + dir * 1.3846).rgb * 0.316216; c += texture2D(tex, vUv - dir * 1.3846).rgb * 0.316216; c += texture2D(tex, vUv + dir * 3.2308).rgb * 0.070270; c += texture2D(tex, vUv - dir * 3.2308).rgb * 0.070270; gl_FragColor = vec4(c, 1.0); }" });
    const comp = new T.ShaderMaterial({ uniforms: { tex: { value: main.texture }, b1: { value: lv[0][0].texture }, b2: { value: lv[1][0].texture }, b3: { value: lv[2][0].texture }, strength: { value: o.strength || 0.9 }, exposure: { value: o.exposure || 1.0 }, vig: { value: o.vignette != null ? o.vignette : 0.55 }, grain: { value: o.grain != null ? o.grain : 0.035 }, seed: { value: 0 }, fade: { value: 1 }, aspect: { value: W / H } }, vertexShader: VS,
      fragmentShader: [
        "uniform sampler2D tex, b1, b2, b3; uniform float strength, exposure, vig, grain, seed, fade, aspect; varying vec2 vUv;",
        "vec3 aces(vec3 x){ x *= 0.6; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }",
        "float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }",
        "void main(){",
        "  vec3 c = texture2D(tex, vUv).rgb;",
        "  vec3 b = texture2D(b1, vUv).rgb * 0.5 + texture2D(b2, vUv).rgb * 0.8 + texture2D(b3, vUv).rgb * 1.2;",
        "  c = (c + b * strength) * exposure;",
        "  c = aces(c);",
        "  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0) * 1.6; c *= mix(1.0, smoothstep(1.25, 0.15, length(q)), vig);",
        "  c = pow(c, vec3(1.0/2.2));",
        "  c += (h(vUv * 1000.0) - 0.5) * grain;",
        "  gl_FragColor = vec4(c * fade, 1.0);",
        "}"].join("\n") });
    const pass = (mat, target) => { quad.material = mat; r.setRenderTarget(target); r.render(qs, qc); };
    st.post = comp.uniforms;
    st.render = function () {
      if (st.preRender) st.preRender();
      r.setRenderTarget(main); r.render(st.scene, st.camera);
      bright.uniforms.tex.value = main.texture; pass(bright, lv[0][0]);
      for (let i = 0; i < 3; i++) {
        const [a, b] = lv[i];
        if (i > 0) { blur.uniforms.tex.value = lv[i - 1][0].texture; blur.uniforms.dir.value.set(0, 0); pass(blur, a); }
        for (let k = 0; k < 2; k++) {
          blur.uniforms.tex.value = a.texture; blur.uniforms.dir.value.set(1 / a.width, 0); pass(blur, b);
          blur.uniforms.tex.value = b.texture; blur.uniforms.dir.value.set(0, 1 / a.height); pass(blur, a);
        }
      }
      pass(comp, null);
      for (const l of st.labels) { const p = KIT.project(l.v, st.camera, W, H); l.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`; }
    };
    return st;
  };
})();

/* Studio-Look: große Softboxen als Umgebung + Spiegelboden (planare Reflexion, weich, ausblendend) */
(function () {
  const T = window.THREE, KIT = window.KIT;
  KIT.studioEnv = function (renderer, o) {
    o = o || {};
    const s = new T.Scene(); s.background = new T.Color(o.bg != null ? o.bg : 0x141215);
    const box = (w, h, pos, c, k) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k), side: T.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); s.add(m); };
    box(7, 4, new T.Vector3(-3, 6, 3), 0xfff4ea, 2.4);   // große Oberlicht-Softbox
    box(3, 6, new T.Vector3(6, 2, 1), 0xeaf2ff, 1.3);    // seitliche Streifenbox
    box(8, 2, new T.Vector3(0, 2, -7), 0xffe6cc, 0.5);   // warmer Hintergrund (Laden)
    box(12, 4, new T.Vector3(0, -4, 0), 0x1a1816, 1.0);  // dunkler Boden
    const pm = new T.PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.06).texture; pm.dispose(); return tex;
  };
  KIT.mirrorFloor = function (st, y, o) {
    o = o || {};
    const W = Math.round(st.W / 2), H = Math.round(st.H / 2);
    const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType });
    const vcam = new T.PerspectiveCamera();
    const tm = new T.Matrix4();
    const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { tex: { value: rt.texture }, tm: { value: tm }, strength: { value: o.strength || 0.35 }, fadeR: { value: o.fade || 2.2 }, px: { value: new T.Vector2(1 / W, 1 / H) } },
      vertexShader: "uniform mat4 tm; varying vec4 vP; varying vec3 vW; void main(){ vP = tm * vec4(position, 1.0); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tex; uniform float strength, fadeR; uniform vec2 px; varying vec4 vP; varying vec3 vW; void main(){ vec2 uv = vP.xy / vP.w; vec3 c = vec3(0.0); float k = 0.0; for (int i=-2;i<=2;i++) for (int j=-2;j<=2;j++){ float w = 1.0/(1.0+float(i*i+j*j)); c += texture2D(tex, uv + vec2(float(i), float(j)) * px * 2.5).rgb * w; k += w; } c /= k; float f = smoothstep(fadeR, 0.0, length(vW.xz)); gl_FragColor = vec4(c * strength * f, 1.0); }" });
    const plane = new T.Mesh(new T.PlaneGeometry(30, 30), mat); plane.rotation.x = -Math.PI / 2; plane.position.y = y + 0.0005; st.scene.add(plane);
    const n = new T.Vector3(0, 1, 0), rp = new T.Vector3(0, y, 0), cp = new T.Vector3(), view = new T.Vector3(), look = new T.Vector3(), tgt = new T.Vector3(), rot = new T.Matrix4();
    return function render() {
      const cam = st.camera; cam.updateMatrixWorld(); cp.setFromMatrixPosition(cam.matrixWorld);
      view.subVectors(rp, cp); if (view.dot(n) > 0) return;
      view.reflect(n).negate().add(rp);
      rot.extractRotation(cam.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp);
      tgt.subVectors(rp, look).reflect(n).negate().add(rp);
      vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n); vcam.lookAt(tgt);
      vcam.far = cam.far; vcam.near = cam.near; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(cam.projectionMatrix);
      plane.updateMatrixWorld();
      tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); tm.multiply(vcam.projectionMatrix); tm.multiply(vcam.matrixWorldInverse); tm.multiply(plane.matrixWorld);
      plane.visible = false; const r = st.renderer; r.setRenderTarget(rt); r.clear(); r.render(st.scene, vcam); plane.visible = true;
    };
  };
})();
