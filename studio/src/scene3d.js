
/* ================= River Studio in 3D (Three.js r128 + OrbitControls) =================
   The same building as the SVG drawing, rebuilt as a real 3D scene you can orbit, tilt, pan and zoom.
   World units are the SVG's: x runs along the building, y from the back wall to the front, z up.
   In Three.js that is X = x, Y = z, Z = y (+14 on the post-production floor, the SVG's YOFF).
   If Three.js or WebGL isn't available, renderScene() keeps drawing the SVG. */
const R3D = { on: false };
window.R3D = R3D;
(function init3d() {
  const host = $("stage");
  if (!host || typeof THREE === "undefined" || !THREE.OrbitControls) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); if (!renderer.getContext()) return; }
  catch (_) { return; }
  const RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const box3 = document.createElement("div"); box3.id = "three"; box3.tabIndex = 0;
  box3.setAttribute("aria-label", "The studio in 3D. Drag to look around, right-drag or two fingers to move, scroll or pinch to zoom. Arrow keys move, Q and E turn, plus and minus zoom, 1 to 6 jump to a room.");
  host.insertBefore(box3, host.firstChild); host.classList.add("is3d");
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  box3.appendChild(renderer.domElement);
  const labelsEl = document.createElement("div"); labelsEl.className = "l3"; box3.appendChild(labelsEl);
  const VIEWS = [
    ["Overview", [34, 0, 27], [94, 66, 96]],
    ["Recording sets", [32, 3, 4], [32, 14, 31]],
    ["Green room", [8, 1, 25], [27, 16, 47]],
    ["Edit booths", [32, 1, 28], [35, 27, 58]],
    ["Screening", [56, 3, 19], [57, 12, 47]],
    ["Control room", [39, 3, 50], [41, 14, 70]]
  ];
  const ui = document.createElement("div"); ui.className = "views";
  ui.innerHTML = VIEWS.map(([n], i) => `<button type="button" data-view="${i}" title="${esc(n)} (${i + 1})">${esc(n)}</button>`).join("");
  host.appendChild(ui);
  const nav = document.createElement("div"); nav.className = "nav3";
  nav.innerHTML = [["turn", -1, "Turn left (Q)", "M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5"], ["turn", 1, "Turn right (E)", "M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"], ["tilt", 1, "Look from above", "M12 4v16M5 11l7-7 7 7"], ["tilt", -1, "Look from floor level", "M12 20V4M5 13l7 7 7-7"], ["zoom", 1, "Zoom in (+)", "M12 5v14M5 12h14"], ["zoom", -1, "Zoom out (−)", "M5 12h14"]]
    .map(([k, d, t, p]) => `<button type="button" data-nav="${k}" data-d="${d}" title="${t}" aria-label="${t}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p}"/></svg></button>`).join("");
  host.appendChild(nav);
  const hint = document.querySelector(".hint");
  if (hint) hint.textContent = "Drag to look around the building, right-drag or two fingers to move, scroll or pinch to zoom, double-click to fly closer. Click a set, a booth, a screen, a tape or a person. Drag a guest from the green room into a booth to give the episode to that editor.";

  /* ---------- scene, camera, light ---------- */
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#07090D"); scene.fog = new THREE.Fog("#07090D", 210, 420);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 600);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !RM; controls.dampingFactor = 0.09; controls.screenSpacePanning = false;
  controls.minDistance = 5; controls.maxDistance = 190; controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.zoomSpeed = 0.9; controls.rotateSpeed = 0.7;
  camera.position.set(...VIEWS[0][2]); controls.target.set(...VIEWS[0][1]); controls.update();
  scene.add(new THREE.HemisphereLight("#C8DCFF", "#2A2018", 0.75));
  scene.add(new THREE.AmbientLight("#ffffff", 0.3));
  const sun = new THREE.DirectionalLight("#FFF2DD", 0.9); sun.position.set(70, 90, 70); sun.target.position.set(32, 0, 28);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 260 }); sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  [[8, 10], [32, 13], [56, 14], [39, 37], [32, 6]].forEach(([x, y], k) => { const l = new THREE.PointLight(k === 4 ? "#FFE7C4" : "#FFE2B0", k === 4 ? 0.5 : 0.55, 34, 1.6); l.position.set(x, 7, y + (k === 4 ? 0 : 14)); scene.add(l); });

  /* ---------- helpers ---------- */
  let yo = 0;                                  // 0 for the recording wing, 14 for the post-production floor
  const G1 = new THREE.BoxGeometry(1, 1, 1), PG = new THREE.PlaneGeometry(1, 1);
  const matC = new Map(), owned = [];
  const mat = (col, o) => { const k = col + (o ? JSON.stringify(o) : ""); if (!matC.has(k)) matC.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.82, metalness: 0.04 }, o || {}))); return matC.get(k); };
  const own = m => { owned.push(m); return m; };
  function bx(p, x, y, z, w, d, h, col, o = {}) {
    const m = new THREE.Mesh(G1, o.own ? own(new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.82, metalness: 0.04 }, o.m || {}))) : mat(col, o.m));
    m.scale.set(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001)); m.position.set(x + w / 2, z + h / 2, y + yo + d / 2);
    m.castShadow = o.cast !== false && h > 0.08; m.receiveShadow = true; p.add(m); return m;
  }
  const flat = (p, x, y, w, d, col, z = 0) => bx(p, x, y, z, w, d, 0.03, col, { cast: false });
  function glass(p, x, y, z, w, d, h, op = 0.07) {
    const m = new THREE.Mesh(G1, mat("#A0C8FF", { transparent: true, opacity: op, roughness: 0.1, metalness: 0.3, depthWrite: false }));
    m.scale.set(Math.max(w, 0.02), h, Math.max(d, 0.02)); m.position.set(x + w / 2, z + h / 2, y + yo + d / 2); m.userData.nopick = true; p.add(m); return m;
  }
  const group = (p, data) => { const g = new THREE.Group(); Object.assign(g.userData, data || {}); p.add(g); return g; };
  /* Flat artwork: SVG markup (the same strings the SVG engine draws) painted into a canvas texture. */
  const DEFS = `<defs><linearGradient id="scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF6FF"/><stop offset="1" stop-color="#9FCBEE"/></linearGradient></defs>`;
  const texC = new Map(); let texUsed = new Set();
  function tex(inner, w, h, ppu = 56) {
    const key = w + "x" + h + "@" + ppu + ":" + inner; texUsed.add(key);
    if (texC.has(key)) return texC.get(key);
    const cw = Math.max(2, Math.min(4096, Math.round(w * ppu))), ch = Math.max(2, Math.min(4096, Math.round(h * ppu)));
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
    const mt = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: true, alphaTest: 0.02 });
    const img = new Image();
    img.onload = () => { try { cv.getContext("2d").drawImage(img, 0, 0, cw, ch); t.needsUpdate = true; } catch (_) {} };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${DEFS}${inner}</svg>`);
    const rec = { t, mt }; texC.set(key, rec); return rec;
  }
  /* fy: art on a wall facing the front (plane y), top-left corner at (x, z). fz: on a floor or desk top, top-left at (x, y). fx: on a side wall (plane x) facing +x. */
  function fy(p, x, y, z, w, h, inner, o = {}) { const m = new THREE.Mesh(PG, tex(inner, w, h, o.ppu).mt); m.scale.set(w, h, 1); m.position.set(x + w / 2, z - h / 2, y + yo + 0.012); p.add(m); return m; }
  function fz(p, x, y, z, w, h, inner, o = {}) { const m = new THREE.Mesh(PG, tex(inner, w, h, o.ppu).mt); m.scale.set(w, h, 1); m.rotation.x = -Math.PI / 2; m.position.set(x + w / 2, z + (z === 0 ? 0.075 : 0.015), y + yo + h / 2); m.userData.nopick = !o.pick; m.renderOrder = 1; p.add(m); return m; }
  function fx(p, x, y, z, w, h, inner, o = {}) { const m = new THREE.Mesh(PG, tex(inner, w, h, o.ppu).mt); m.scale.set(w, h, 1); m.rotation.y = Math.PI / 2; m.position.set(x + 0.012, z - h / 2, y + yo - w / 2); p.add(m); return m; }
  /* A soft glow (screens, lamps), drawn without depth so it reads through the room. */
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function glow(p, x, y, z, col, size, op = 0.5) { const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }))); s.scale.set(size, size, 1); s.position.set(x, z, y + yo); s.userData.nopick = true; p.add(s); return s; }
  function rod(p, a, b, r, col) { const A = new THREE.Vector3(a[0], a[2], a[1] + yo), B = new THREE.Vector3(b[0], b[2], b[1] + yo), m = new THREE.Mesh(CYL, mat(col)); m.scale.set(r, A.distanceTo(B), r); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); p.add(m); return m; }
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 10), TORSO = new THREE.CylinderGeometry(0.34, 0.47, 1, 16), HEAD = new THREE.SphereGeometry(0.34, 20, 14), HAIRG = new THREE.SphereGeometry(0.365, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), LEG = new THREE.CylinderGeometry(0.13, 0.12, 1, 8);
  /* A person. face = direction they look: 0 = towards the front (+y), Math.PI = towards the back wall, Math.PI/2 = along +x. */
  function person(p, x, y, z, shirt, key, face = 0, seated = true) {
    const g = new THREE.Group(), h = hash(key), skin = SKIN[h % SKIN.length], hair = HAIR[(h >> 3) % HAIR.length];
    const tH = seated ? 1.15 : 1.25, base = seated ? 0 : 0.95;
    if (!seated) [-0.16, 0.16].forEach(dx => { const l = new THREE.Mesh(LEG, mat("#20242C")); l.scale.set(1, 0.95, 1); l.position.set(dx, 0.475, 0); l.castShadow = true; g.add(l); });
    else [-0.16, 0.16].forEach(dx => { const l = new THREE.Mesh(LEG, mat("#20242C")); l.scale.set(1, 0.8, 1); l.rotation.x = Math.PI / 2; l.position.set(dx, 0.12, 0.4); l.castShadow = true; g.add(l); });
    const t = new THREE.Mesh(TORSO, mat(shirt)); t.scale.set(1, tH, 0.82); t.position.y = base + tH / 2; t.castShadow = true; g.add(t);
    const hd = new THREE.Mesh(HEAD, mat(skin, { roughness: 0.6 })); hd.position.y = base + tH + 0.36; hd.castShadow = true; g.add(hd);
    const hr = new THREE.Mesh(HAIRG, mat(hair, { roughness: 0.9 })); hr.position.y = base + tH + 0.38; hr.rotation.x = -0.55; g.add(hr);
    g.position.set(x, z, y + yo); g.rotation.y = face; p.add(g); return g;
  }
  /* Labels: small HTML tags pinned to points in the scene, re-projected every frame. */
  let labels = [];
  function lab(html, x, y, z, cls, attrs, far = 150) {
    const el = document.createElement("div"); el.className = "lb " + (cls || ""); el.innerHTML = html;
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v)); labelsEl.appendChild(el);
    const L = { el, v: new THREE.Vector3(x, z, y + yo), far, hid: false, occ: false, crowd: false, w: 0, h: 0,
      pri: /live|you|msg/.test(cls || "") ? 5 : /late/.test(cls || "") ? 4 : /free/.test(cls || "") ? 1 : /bub/.test(cls || "") ? 2 : 3 }; labels.push(L); return L;
  }
  /* Outer walls fade away while the camera is on their outside, so you can look in from any direction. */
  let fades = [];
  const fade = (meshes, nx, nz, px, pz) => fades.push({ meshes: [].concat(meshes), nx, nz, px, pz, out: null });
  const reg = new Map();

  /* ---------- static world: ground, Al Barsha towers, Sheikh Zayed Road, the Metro ---------- */
  const world = new THREE.Group(); scene.add(world);
  const anim = { cars: [], train: null, blink: [], screens: [] };
  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat("#0A0D12")); ground.rotation.x = -Math.PI / 2; ground.position.set(32, -1.02, 25); ground.receiveShadow = true; world.add(ground);
    yo = 0;
    const towers = [[-1, 12], [5, 16], [11, 9], [15, 14.5], [22, 11], [27, 17], [33, 10], [38, 15], [44, 12.5], [49, 18], [55, 10.5], [60, 14]], tw = [];
    towers.forEach(([x, z], k) => {
      const w = 3.6 + (k % 3), d = 2.2, y = -10.6;
      const m = bx(world, x, y, -1, w, d, z + 1, k % 2 ? "#172033" : "#141B2A", { own: true });
      let win = ""; for (let u = .4; u < w - .3; u += .7) for (let v = .6; v < z - .4; v += .9) if ((hash(k + ":" + u + ":" + v) % 5) < 2) win += `<rect x="${u.toFixed(2)}" y="${v.toFixed(2)}" width=".3" height=".42" fill="${(hash(k + "w" + v) % 4) ? "#E9C77A" : "#9CC8F0"}" opacity=".75"/>`;
      const f = fy(world, x, y + d, z, w, z, win, { ppu: 20 }); tw.push(m, f);
      for (let s = 0; s < 3; s++) if (hash("roof" + k + s) % 2) glow(world, x + w / 2, y + d / 2, z + 0.4, "#FF4D6A", 1.2, 0.5);
    });
    fade(tw, 0, -1, 0, -9);
    /* the road and the Metro along the open side */
    bx(world, 65, -40, -0.97, 9, 140, 0.02, "#0C0F14", { cast: false }); bx(world, 64.6, -40, -0.97, .4, 140, .14, "#2A2F38", { cast: false });
    for (let y = -38; y < 98; y += 4) bx(world, 69.3, y, -0.94, .18, 2, .01, "#6B7280", { cast: false });
    const carCols = ["#D9DEE6", "#2E5A7A", "#8E3B2E", "#C9A24B", "#1E1E22", "#5A6170", "#E7E2D6", "#3A4A6A"];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Group(), dir = k % 2 ? 1 : -1, lane = k % 2 ? 70.2 : 66.4 + (k % 4 === 0 ? 1.4 : 0);
      bx(c, 0, 0, 0, 1.4, 2.6, .55, carCols[k], { m: { metalness: 0.4, roughness: 0.4 } }); bx(c, .12, .55, .55, 1.16, 1.4, .42, "#0E141C", { m: { metalness: 0.6, roughness: 0.2 } });
      glow(c, .7, dir > 0 ? 2.7 : -0.1, .4, "#FFF1C2", 1.4, 0.55); glow(c, .7, dir > 0 ? -0.1 : 2.7, .4, "#FF2A2A", 0.9, 0.5);
      c.position.set(lane, -0.95, 0); world.add(c); anim.cars.push({ c, dir, off: (hash("car" + k) % 100) / 100 * 120, sp: 5 + (k % 3) * 2.2 });
    }
    for (let y = -32; y <= 92; y += 8) bx(world, 72.6, y, -1, .8, .8, 4.2, "#3A404C");
    bx(world, 72.2, -40, 3.2, 1.6, 140, .55, "#4A515E");
    const tr = new THREE.Group();
    for (let c = 0; c < 5; c++) { const y = c * 3.6; bx(tr, 72.45, y, 3.75, 1.1, 3.4, 1.05, "#D9DEE6", { m: { metalness: 0.5, roughness: 0.35 } }); bx(tr, 73.56, y + .2, 4.12, .02, 3.0, .3, "#1E2A3A", { m: { emissive: "#7FB8E6", emissiveIntensity: 0.35 } }); bx(tr, 73.56, y, 3.85, .02, 3.4, .14, "#C8102E"); bx(tr, 72.44, y, 3.85, .02, 3.4, .14, "#C8102E"); }
    world.add(tr); anim.train = tr;
    const rt = (x, y, z, w, h, inner) => { const m = new THREE.Mesh(PG, tex(inner, w, h, 30).mt); m.scale.set(w, h, 1); m.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); m.position.set(x, z, y + w / 2); world.add(m); m.userData.nopick = true; };
    rt(68.6, 46, -0.93, 18, 1.2, TM(0, .85, .85, "SHEIKH ZAYED ROAD", "rgb(255 255 255 / .3)", 'letter-spacing=".35"'));
    rt(71.4, 18, -0.93, 13, 0.9, TM(0, .6, .55, "DUBAI METRO · RED LINE", "rgb(200 16 46 / .75)", 'letter-spacing=".25"'));
  }

  /* ---------- live content, rebuilt when the data changes ---------- */
  let root = null, lastSig = "";
  function dispose() {
    if (root) { root.traverse(o => { if (o.geometry && o.geometry.userData.own) o.geometry.dispose(); }); scene.remove(root); root = null; }
    anim.blink = [];
    owned.splice(0).forEach(m => m.dispose());
    labels.forEach(l => l.el.remove()); labels = []; fades = fades.filter(f => f.static); reg.clear();
  }
  fades.forEach(f => f.static = true);
  const sigOf = () => JSON.stringify([S.items, (S.bookings || []).map(b => [b.start, b.end, b.setup, b.name, b.seats]), S.cap, !!S.error, Math.floor(Date.now() / 120000)]);
  function build(force) {
    const sig = sigOf(); if (!force && sig === lastSig) return; lastSig = sig;
    dispose(); texUsed = new Set(); pickables = [];
    root = new THREE.Group(); scene.add(root);
    buildWing(root); buildPost(root);
    for (const [k, rec] of texC) if (!texUsed.has(k) && !k.includes("@20:") && !k.includes("@30:")) { rec.t.dispose(); rec.mt.dispose(); texC.delete(k); }
    root.traverse(o => { if (o.isMesh && !o.userData.nopick) pickables.push(o); });
    occT = 0;
  }
  let pickables = [];

  function buildWing(R) {
    yo = 0;
    bx(R, -0.6, -0.6, -1, 65.2, 14.6, 1, "#10141B", { cast: false });
    const back = bx(R, -0.6, -0.6, 0, 65.2, 0.6, 9.2, "#1E242E", { own: true }), side = bx(R, -0.6, 0, 0, 0.6, 14, 9.2, "#1E242E", { own: true });
    const sign = fy(R, 1, 0, 8.9, 27, 1.5, `<rect x="0" y="0" width="1.5" height="1.5" rx=".35" fill="#FF003C"/><rect x=".45" y=".3" width=".6" height=".68" rx=".3" fill="none" stroke="#fff" stroke-width=".14"/><path d="M.52,.82 V1.25" stroke="#fff" stroke-width=".14" stroke-linecap="round"/>`
      + TX(2, 1.15, 1.15, "PODDSTER", "#EEF3FA", 'font-weight="700" letter-spacing=".14"') + TM(9.4, 1.12, .55, "DUBAI · AL BARSHA · SHEIKH ZAYED RD · SIX SETS", "#7D8AA3", 'letter-spacing=".18"'), { ppu: 40 });
    fade([back, sign], 0, -1, 0, -0.6); fade([side], -1, 0, -0.6, 0);
    const W = 10.66;
    SETS.forEach((st, k) => {
      const sx = k * W + 0.15, cx = sx + W / 2, info = setNow(st.n), live = info.live, gs = st.seats === 2 ? "1–2" : st.seats === 5 ? "1–5" : "1–4";
      const g = group(R, { room: "studio:" + st.n, tip: "Set " + st.n + " · " + gs + " guests", tip2: live ? "Recording now: " + live.name : info.next ? "Next today: " + dubaiTime(info.next.start) + " " + info.next.name : "No more sessions today · click for the schedule" });
      reg.set("room:studio:" + st.n, g);
      flat(g, sx, 0, W - .3, 12, st.floor); flat(g, sx + 1, 1.2, W - 2.3, 9, shade(st.floor, 1.12), 0.03);
      fy(g, sx + .5, 0, 6.6, W - 1.3, 5.6, backdrop(st.back, st.acc, W - 1.3, 5.6), { ppu: 48 });
      bx(g, cx - 1.05, 0, 7.33, 2.1, .1, .72, live ? "#E0002F" : "#2A1418", { m: live ? { emissive: "#FF003C", emissiveIntensity: 1.4 } : null });
      fy(g, cx - 1, .1, 8.0, 2, .62, TM(.25, .46, .42, "ON AIR", live ? "#fff" : "#5A2A33", 'font-weight="700"'));
      if (live) { const gl = glow(g, cx, .6, 7.7, "#FF003C", 5, 0.6); anim.blink.push({ o: gl, base: 0.6 }); const pl = new THREE.PointLight("#FF2A4A", 0.9, 14, 1.8); pl.position.set(cx, 6, 3); g.add(pl); }
      const n = st.seats, tw = n * 1.55 + .9, tx0 = cx - tw / 2, guestsN = live ? Math.max(1, Math.min(n, +String(live.seats).match(/\d+/)?.[0] || n)) : 0;
      for (let i = 0; i < n; i++) { const x = tx0 + .45 + i * 1.55 + .2; bx(g, x - .1, 2.6, .9, 1.25, .25, 1.4, "#2B2F37"); bx(g, x - .1, 2.85, 0, 1.25, 1.1, .9, "#30353E"); }
      for (let i = 0; i < guestsN; i++) person(g, tx0 + .45 + i * 1.55 + .52, 3.35, .9, shade(st.acc, .7), (live ? live.name : "") + i, 0);
      bx(g, tx0, 4.3, 0, tw, 1.9, 1.15, st.n === "Exec" ? "#4A4F58" : "#5B4632");
      for (let i = 0; i < n; i++) { const x = tx0 + .45 + i * 1.55 + .62; bx(g, x - .05, 4.45, 1.15, .1, .1, .9, "#15181E"); bx(g, x - .2, 4.3, 1.95, .4, .55, .4, "#0C0E12", { m: { metalness: 0.5, roughness: 0.4 } }); }
      const cams = Math.min(5, n + 1);
      for (let c = 0; c < cams; c++) {
        const x = sx + 1.4 + c * ((W - 3) / Math.max(1, cams - 1)), y = 8.8 + (c % 2) * .7, top = [x + .35, y + .25, 1.5];
        [[-.6, .5], [.6, .5], [0, -.6]].forEach(([dx, dy]) => rod(g, top, [x + .35 + dx, y + .25 + dy, 0], .04, "#3A404C"));
        bx(g, x, y - .1, 1.5, .7, .75, .55, "#0D0F13", { m: { metalness: 0.4, roughness: 0.5 } }); bx(g, x + .2, y - .35, 1.62, .3, .25, .3, "#05070A");
        if (live) glow(g, x + .55, y + .6, 2.15, "#FF003C", .7, 0.9);
        if (st.n === "Exec" && c === Math.floor(cams / 2)) glass(g, x - .2, y - .5, 2.1, 1.1, .04, .8, 0.3);
      }
      fz(g, sx + .7, 10.3, 0, 9, 1.8, TX(0, .9, 1.05, st.n, "#EEF3FA", 'font-weight="700"') + TM(0, 1.6, .5, gs + " GUESTS · " + cams + " FX3", "#7D8AA3", 'letter-spacing=".1"'));
      if (k < SETS.length - 1) { bx(R, sx + W - .3, 0, 0, .3, 11.4, 1.6, "#2A303B"); glass(R, sx + W - .2, 0, 1.6, .1, 11.4, 3.8, 0.05); }
      const txt = live ? "LIVE · " + live.name : info.next ? "Next " + dubaiTime(info.next.start) + " · " + info.next.name : "Free today";
      lab((live ? '<i class="dot"></i>' : "") + esc(txt.length > 34 ? txt.slice(0, 33) + "…" : txt), cx, 1.2, 10.2, live ? "live" : info.next ? "" : "free", { "data-room": "studio:" + st.n, title: "Set " + st.n });
    });
    flat(R, 0, 12, 64, 2, "#171B22"); bx(R, 0, 11.6, 0, 64, .3, .9, "#2A303B");
  }

  function buildPost(R) {
    yo = 14;
    const ready = S.items.length > 0, sm = new Map(suites().map(s => [firstName(s.name).toLowerCase(), s]));
    bx(R, -0.6, -0.6, -1, 65.2, 47.2, 1, "#10141B", { cast: false });
    flat(R, 0, 0, 16, 22, "#1F2B27"); flat(R, 0, 22, 16, 24, "#1A1E26"); flat(R, 16, 0, 32, 28, "#1B1F27"); flat(R, 48, 0, 16, 28, "#2A1820"); flat(R, 16, 28, 48, 18, "#151A22");
    bx(R, -0.6, -0.6, 0, 65.2, 0.6, 1.1, "#232A36"); glass(R, 0, -0.35, 1.1, 64, .1, 2.3);
    const side = bx(R, -0.6, 0, 0, 0.6, 46, 8.5, "#232A36", { own: true });
    const del = fx(R, 0, 44, 7.6, 10, 2.2, TM(0, 0.9, 0.85, "DELIVERY", "#B7A9FF", 'letter-spacing=".25"') + TM(0, 1.9, 0.55, "DONE THIS WEEK", "#7D74B8", 'letter-spacing=".2"'));
    fade([side, del], -1, 0, -0.6, 0);
    fz(R, 1.2, 0.5, 0, 8, 2, TM(0, .9, .95, "GREEN ROOM", "#7FA391", 'letter-spacing=".25"') + TM(0, 1.8, .55, "QUEUE", "#5E7A6C", 'letter-spacing=".2"'));
    fz(R, 48.8, 26.6, 0, 12, 1, TM(0, .6, .55, "SCREENING · CLIENT REVIEW", "#B98A98", 'letter-spacing=".15"'));

    /* ---------- green room ---------- */
    const gq = guests(), G = group(R, { room: "green", tip: "Green room", tip2: gq.length + " waiting for an editor · click for the list" }); reg.set("room:green", G);
    flat(G, 1.6, 3.6, 12.4, 13.4, "#2A3B34", .03); flat(G, 2.2, 4.2, 11.2, 12.2, "#30443B", .06);
    bx(G, 13, 1, 0, 1.6, 1.6, 1.1, "#5B4632");
    [[13.8, 1.8, 2.5, 1.0, "#2F6B46"], [13.3, 1.6, 3.2, .7, "#3C8A57"], [14.2, 2.2, 3.0, .6, "#357A4E"]].forEach(([x, y, z, r, c]) => { const s = new THREE.Mesh(HEAD, mat(c)); s.scale.setScalar(r / .34); s.position.set(x, z, y + yo); s.castShadow = true; G.add(s); });
    bx(G, 2, 1, 0, 10.4, 2.4, 1.0, "#2F5C4F"); bx(G, 2, 0.6, 1.0, 10.4, 0.6, 1.6, "#2A5246");
    bx(G, 1, 5, 0, 2.4, 12, 1.0, "#2F5C4F"); bx(G, 0.6, 5, 1.0, 0.6, 12, 1.6, "#2A5246");
    const gpos = [[3, 2.1, 0], [5, 2.1, 0], [7, 2.1, 0], [9, 2.1, 0], [11, 2.1, 0], [2.2, 7, Math.PI / 2], [2.2, 9.2, Math.PI / 2], [2.2, 11.4, Math.PI / 2], [2.2, 13.6, Math.PI / 2], [2.2, 15.8, Math.PI / 2]];
    gq.slice(0, 10).forEach(({ it, wait }, i) => {
      const [x, y, f] = gpos[i], g = group(G, { gep: it.id, tip: it.name, tip2: (wait ? "Waiting " + wait + (wait === 1 ? " day" : " days") : "Arrived today") + " · drag into a booth to assign" });
      reg.set("gep:" + it.id, g); person(g, x, y, 1.0, waitCol(wait), it.id, f);
      lab(wait ? wait + "d" : "new", x, y, 3.2, "bub", { "data-ep": it.id, style: "--c:" + waitCol(wait), title: it.name }, 80);
    });
    if (gq.length > 10) fz(G, 5, 18, 0, 6, 1.4, `<rect x="0" y="0" width="5.6" height="1.3" rx=".3" fill="#0B0F14" stroke="#F6B64A" stroke-width=".06"/>` + TX(.3, .95, .75, "+" + (gq.length - 10) + " more waiting", "#F6B64A"));
    bx(G, 6, 8.5, 0, 4.2, 3, 0.7, "#5B4632"); bx(G, 7.4, 9.3, 0.7, 1.2, 0.8, 0.35, "#D9DFE8");
    if (ready && !gq.length) fz(G, 4.5, 12.5, 0, 8, 1.2, TX(0, .9, .9, "Nobody waiting", "#9FB8A8"));

    /* ---------- delivery (Done this week) ---------- */
    const done = S.items.filter(i => i.stage === "Done" && i.updated && Date.now() - Date.parse(i.updated) < 7 * 864e5);
    bx(R, 0.2, 25, 0, 1.6, 17, 5.4, "#30353F");
    for (let sh = 0; sh < 4; sh++) bx(R, 0.2, 25, 0.3 + sh * 1.3, 1.9, 17, 0.12, "#4A505C");
    done.slice(0, 48).forEach((it, i) => { const sh = Math.floor(i / 12), k = i % 12, g = group(R, { ep: it.id, tip: it.name, tip2: "Done" }); reg.set("ep:" + it.id, g); bx(g, 1.85, 25.6 + k * 1.35, 0.42 + sh * 1.3, .55, 0.9, 1.0, "#7B6FD6", { m: { emissive: "#3B2F96", emissiveIntensity: .25 } }); });
    fz(R, 4, 36.4, 0, 9, 3, TX(0, 1.9, 2.2, String(done.length), "#9C8CFF", 'font-weight="700"') + TX(0, 2.8, .8, "delivered this week", "#7D74B8"));
    bx(R, 9, 28, 0, 5, 2.2, 1.1, "#3B2E5C"); bx(R, 9, 30, 1.1, 5, 0.4, 1.2, "#33284F");
    bx(R, 15.7, 0, 0, 0.3, 10, 4.2, "#2B323E"); bx(R, 15.7, 13, 0, 0.3, 15, 4.2, "#2B323E"); bx(R, 0, 21.8, 0, 9, 0.3, 1.1, "#2B323E");

    /* ---------- edit booths ---------- */
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const ed = EDITORS[r * 4 + c], bxx = 16 + c * 8, by = r * 9 + 0.4;
      if (!ed) { bx(R, bxx + 1, by + 1.2, 0, 5.8, 2, 1.4, "#2A2F38"); fz(R, bxx + 1.6, by + 4.6, 0, 6, 1.2, TX(0, .9, .8, "Spare booth", "#55617A")); continue; }
      const name = ed[0], s = sm.get(firstName(name).toLowerCase()) || { name, edit: [], cr: [], late: 0, u: 0 };
      const rows = s.edit.slice().sort((a, b) => (isLate(b) - isLate(a)) || ((daysTo(a) ?? 99) - (daysTo(b) ?? 99)));
      const ratio = s.u / capOf(name), lit = s.edit.some(i => i.stage === "In Process"), busy = rows.length > 0;
      const B = group(R, { drop: name, room: "suite:" + name, tip: name + "'s booth", tip2: fmtU(s.u) + " units in edit of " + capOf(name) + "/wk · " + s.late + " late · " + s.cr.length + " with clients" });
      reg.set("drop:" + name, B);
      flat(B, bxx + 0.3, by + 0.3, 7.4, 8.3, busy ? "#20252F" : "#1A1E26", .03);
      const hl = bx(B, bxx + 0.3, by + 0.3, .07, 7.4, 8.3, .02, "#3FA9FF", { own: true, cast: false, m: { emissive: "#3FA9FF", emissiveIntensity: .9, transparent: true, opacity: .45 } }); hl.visible = false; B.userData.hl = hl;
      bx(B, bxx + 0.3, by, 0, 7.4, 0.3, 2.8, "#2B323E"); bx(B, bxx, by, 0, 0.3, 8.6, 2.8, "#29303B");
      fy(B, bxx + 0.7, by + 0.3, 2.55, 3.6, .75, `<rect x="0" y="0" width="3.6" height=".75" rx=".12" fill="#0C1016" stroke="rgb(255 255 255 / .12)" stroke-width=".04"/>` + TX(.2, .55, .5, firstName(name).toUpperCase(), "#EEF3FA", 'font-weight="600" letter-spacing=".08"'));
      fy(B, bxx + 4.6, by + 0.3, 2.6, 1.7, .55, `<rect x="0" y="0" width="1.7" height=".55" rx=".08" fill="${lit ? "#E0002F" : "#2A1418"}"/>` + TM(.17, .41, .38, "ON AIR", lit ? "#fff" : "#5A2A33", 'font-weight="700"'));
      if (lit) anim.blink.push({ o: glow(B, bxx + 5.45, by + .6, 2.3, "#FF003C", 2.4, .55), base: .55 });
      const ledsOn = Math.round(Math.min(1.5, ratio) / 1.5 * 6);
      fy(B, bxx + 6.55, by + 0.3, 2.3, .6, 2.1, Array.from({ length: 6 }, (_, k) => `<rect x="0" y="${(5 - k) * .34}" width=".55" height=".26" rx=".05" fill="${k < ledsOn ? (k >= 4 ? "#FF4D6A" : k >= 3 ? "#F6B64A" : "#3EDC97") : "#141922"}"/>`).join(""));
      bx(B, bxx + 0.8, by + 0.8, 0, 6.0, 2.3, 1.45, "#6A4F37");
      [[bxx + 1.2, rows[0]], [bxx + 3.75, rows[1]]].forEach(([mx, ep], k) => {
        const z0 = 1.75, my = by + 1.05;
        bx(B, mx + 1, my + 0.1, 1.45, 0.4, 0.3, 0.3, "#15181E");
        const M = ep ? group(B, { ep: ep.id, tip: ep.name, tip2: ep.stage + " · " + rel(ep).txt }) : B;
        bx(M, mx, my, z0, 2.4, 0.22, 1.55, "#0A0C10", { m: { metalness: .3, roughness: .4 } });
        if (ep) {
          const col = stageHex(ep.stage), late = isLate(ep);
          fy(M, mx + 0.12, my + 0.22, z0 + 1.43, 2.16, 1.31, `<rect x="0" y="0" width="2.16" height="1.31" fill="#0E1C2B"/><rect x="0" y="0" width="2.16" height=".24" fill="${late ? "#FF4D6A" : col}"/>`
            + TX(.1, .18, .17, (late ? "LATE · " : "") + ep.stage.toUpperCase(), "#05080D", 'font-weight="700"') + TX(.1, .6, .3, label(ep).slice(0, 13), "#EEF3FA", 'font-weight="600"')
            + Array.from({ length: 14 }, (_, q) => `<rect x="${.1 + q * .146}" y="${1.05 - (.12 + ((hash(ep.id + q) % 9) / 9) * .32)}" width=".09" height="${.12 + ((hash(ep.id + q) % 9) / 9) * .32}" fill="${col}" opacity=".8"/>`).join("")
            + `<rect x=".1" y="1.12" width="1.96" height=".05" fill="rgb(255 255 255 / .15)"/><rect x="${.1 + 1.96 * ((hash(ep.id) % 70) / 100 + .15)}" y="1.02" width=".04" height=".22" fill="#FF003C"/>`, { ppu: 90 });
          glow(B, mx + 1.2, my + .9, z0 + .8, col, 3.2, .22);
          if (k === 0) reg.set("ep:" + ep.id, M);
        } else fy(M, mx + 0.12, my + 0.22, z0 + 1.43, 2.16, 1.31, `<rect x="0" y="0" width="2.16" height="1.31" fill="#0B0F15"/>` + (k === 0 && !busy ? TX(.45, .75, .26, "No edits", "#3A4558") : ""));
      });
      rows.slice(0, 7).forEach((ep, i) => {
        const late = isLate(ep), T3 = group(B, { ep: ep.id, tip: ep.name, tip2: ep.stage + " · " + rel(ep).txt + (ep.editor ? " · " + ep.editor : "") });
        reg.set("tape:" + ep.id, T3); if (!reg.has("ep:" + ep.id)) reg.set("ep:" + ep.id, T3);
        const m = bx(T3, bxx + 1.0 + i * 0.42, by + 2.3, 1.45, 0.34, 0.62, 0.62, late ? "#FF4D6A" : stageHex(ep.stage), late ? { own: true, m: { emissive: "#FF4D6A", emissiveIntensity: .5 } } : {});
        if (late) anim.blink.push({ m: m.material, base: .5 });
      });
      if (rows.length > 7) fz(B, bxx + 4.0, by + 2.4, 1.46, 1.4, .5, TX(0, .4, .42, "+" + (rows.length - 7), "#C9D3E2", 'font-weight="600"'));
      bx(B, bxx + 3.3, by + 4.3, 0, 1.5, 1.5, 0.85, "#252A33");
      if (busy) person(B, bxx + 4.05, by + 4.6, 0.85, stageHex(rows[0].stage) === "#C9D3E2" ? "#6C7A91" : shade(stageHex(rows[0].stage), .7), name, Math.PI);
      bx(B, bxx + 3.3, by + 5.6, 0.85, 1.5, 0.28, 1.25, "#2D333D");
      fz(B, bxx + 1.0, by + 6.4, 0, 6.4, 1.9, TX(0, .7, .62, firstName(name), busy ? "#C9D3E2" : "#55617A", 'font-weight="600"') + TX(0, 1.55, .48, busy ? `${fmtU(s.u)}u of ${capOf(name)}/wk${s.late ? " · " + s.late + " late" : ""}` : s.cr.length ? s.cr.length + " with clients" : "Free", s.late ? "#FF6B82" : "#6F7C92"));
      const txt = firstName(name) + (busy ? " · " + fmtU(s.u) + "/" + capOf(name) : " · free");
      lab((lit ? '<i class="dot"></i>' : "") + esc(txt), bxx + 4, by + .3, 3.5, (s.late ? "late " : "") + (busy ? "" : "free"), { "data-room": "suite:" + name, title: name + "'s booth" }, 120);
    }
    bx(R, 47.7, 0, 0, 0.3, 21, 4.2, "#2B323E"); bx(R, 47.7, 24, 0, 0.3, 4, 4.2, "#2B323E");

    /* ---------- screening room ---------- */
    const cr = screening(), vip = cr.filter(i => CORPORATE.test(i.name)), reg2 = cr.filter(i => !CORPORATE.test(i.name));
    const SR = group(R, { room: "screening", tip: "Screening room", tip2: cr.length + " with clients · click for the seats" }); reg.set("room:screening", SR);
    flat(SR, 48.3, 0.3, 15.4, 27.4, "#2E1A23", .03);
    fy(SR, 50, 0, 6.8, 12, 4.6, `<rect x="0" y="0" width="12" height="4.6" rx=".1" fill="url(#scr)"/>` + TX(.6, 1.6, .9, "CLIENT REVIEW", "#0E2A44", 'font-weight="700" letter-spacing=".05"') + TX(.6, 2.9, 1.3, String(cr.length) + " in review", "#0E2A44", 'font-weight="600"') + TX(.6, 3.9, .5, reg2.filter(isLate).length + " quiet for more than 7 days", "#5B2030"), { ppu: 48 });
    glow(SR, 56, 1.5, 4.5, "#CFE8FF", 16, .18); { const pl = new THREE.PointLight("#CFE8FF", 0.6, 26, 1.6); pl.position.set(56, 4.5, 16.5); SR.add(pl); }
    bx(SR, 48.6, 0.4, 0, 1.1, 1.1, 4.6, "#1A1D23"); bx(SR, 62.4, 0.4, 0, 1.1, 1.1, 4.6, "#1A1D23");
    for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
      const x = 49.6 + col * 2.35, y = 6.2 + row * 3.3, vipRow = row === 4, it = vipRow ? vip[col] : reg2[row * 6 + col], colr = vipRow ? "#6B5521" : "#5E1B2A";
      bx(SR, x, y, 0, 1.7, 1.4, 0.75, colr); bx(SR, x, y + 1.25, 0.75, 1.7, 0.35, 1.05, shade(colr, 1.1));
      if (it) { const a = ageDays(it), c = ageCol(a, vipRow), g = group(SR, { ep: it.id, tip: it.name, tip2: a + (a === 1 ? " day" : " days") + " with the client" + (vipRow ? " · corporate" : "") });
        reg.set("ep:" + it.id, g); person(g, x + 0.85, y + 0.75, 0.75, shade(c, .55), it.id, Math.PI);
        lab(a + "d", x + .85, y + .75, 3.1, "bub", { "data-ep": it.id, style: "--c:" + c, title: it.name }, 80); }
    }
    if (reg2.length > 24) fz(SR, 50, 24.3, 0, 8, 1, TX(0, .8, .75, "+" + (reg2.length - 24) + " more in review", "#F6B64A"));
    bx(SR, 49.2, 18.8, 0, .35, .35, 1.5, "#C9A23A", { m: { metalness: .7, roughness: .3 } }); bx(SR, 62.9, 18.8, 0, .35, .35, 1.5, "#C9A23A", { m: { metalness: .7, roughness: .3 } });
    { const cu = new THREE.QuadraticBezierCurve3(new THREE.Vector3(49.4, 1.35, 19 + yo), new THREE.Vector3(56.2, 0.7, 19 + yo), new THREE.Vector3(63.1, 1.35, 19 + yo)); const m = new THREE.Mesh(new THREE.TubeGeometry(cu, 30, .07, 8), own(new THREE.MeshStandardMaterial({ color: "#B0102E" }))); m.geometry.userData.own = true; SR.add(m); }
    fz(SR, 50, 25.9, 0, 12, .9, TM(0, .6, .55, "VIP · CORPORATE, OPEN-ENDED REVIEW", "#B7A060", 'letter-spacing=".1"'));
    bx(R, 16, 27.8, 0, 48, 0.3, 1.2, "#2B323E"); glass(R, 16, 27.9, 1.2, 48, .1, 3);

    /* ---------- control room ---------- */
    const CR = group(R, { room: "control", tip: "Control room", tip2: "Capacity, forecast and bottlenecks · click to open" }); reg.set("room:control", CR);
    flat(CR, 16.3, 28.4, 47.4, 17.4, "#161B24", .03);
    const con = group(CR, { room: "control", tip: "Mixing console", tip2: "One channel per editor: load against weekly capacity · click to adjust" });
    bx(con, 21.5, 35, 0, 35, 3.8, 1.25, "#2B3039", { m: { metalness: .3, roughness: .5 } });
    const days = workdaysAhead(10), capDay = EDITORS.reduce((a, [n]) => a + capOf(n), 0) / 5;
    const due = d => active().filter(i => EDIT_STAGES.includes(i.stage) && nextDue(i) === d).reduce((a, i) => a + units(i), 0);
    const inc = d => (S.bookings || []).filter(b => b.arrives === d && b.owner !== "laura").reduce((a, b) => a + b.units, 0);
    const cols = days.map(d => ({ d, due: due(d), inc: inc(d) })), mxv = Math.max(capDay * 1.3, ...cols.map(c => c.due + c.inc), 1), overN = cols.filter(c => c.due + c.inc > capDay).length;
    const BD = group(CR, { room: "board", tip: "On-air board", tip2: "Work landing per working day against team capacity · click for details" }); reg.set("room:board", BD);
    bx(BD, 23.0, 34.6, 1.25, 11.3, 0.3, 4.5, "#0A0C10");
    fy(BD, 23.15, 34.9, 5.6, 10.88, 4.16, `<g transform="scale(.8)"><rect x="0" y="0" width="13.6" height="5.2" fill="#07101A"/>` + TX(.3, .55, .32, "ON-AIR BOARD · NEXT 10 WORKING DAYS", "#7FA9D1", 'font-weight="600" letter-spacing=".02"')
      + TX(10.4, .55, .32, overN ? overN + " over capacity" : "within capacity", overN ? "#FF6B82" : "#3EDC97", 'font-weight="600"')
      + cols.map((c, k) => { const x0 = .5 + k * 1.3, hb = 3.6, b = 4.5, hd = c.due / mxv * hb, hi = c.inc / mxv * hb, over = c.due + c.inc > capDay;
          return `<rect x="${x0}" y="${b - hd}" width=".9" height="${hd}" fill="#FF8F45"/><rect x="${x0}" y="${b - hd - hi}" width=".9" height="${hi}" fill="#3FA9FF"/>` + TX(x0 + .05, 4.95, .3, dayLabel(c.d).split(" ")[0].slice(0, 2) + " " + dayLabel(c.d).split(" ")[1], over ? "#FF6B82" : "#6F8AA6"); }).join("")
      + `<rect x=".4" y="${(4.5 - capDay / mxv * 3.6).toFixed(2)}" width="12.9" height=".05" fill="#EEF3FA" opacity=".7"/></g>`, { ppu: 70 });
    glow(BD, 28.6, 35.6, 3.5, "#3FA9FF", 9, .12);
    const nk = FLOW.map(st => { const gg = active().filter(i => i.stage === st); return { st, n: gg.length, u: gg.reduce((a, i) => a + units(i), 0) }; }), nmax = Math.max(1, ...nk.map(r => r.u)), worst = nk.reduce((a, r) => r.u > a.u ? r : a, nk[0]);
    const NK = group(CR, { room: "necks", tip: "Bottleneck meter", tip2: "Where work is held · click for details" }); reg.set("room:necks", NK);
    bx(NK, 36.2, 34.6, 1.25, 9.1, 0.3, 4.5, "#0A0C10");
    fy(NK, 36.35, 34.9, 5.6, 8.8, 4.16, `<g transform="scale(.8)"><rect x="0" y="0" width="11" height="5.2" fill="#100A12"/>` + TX(.3, .55, .38, "BOTTLENECK METER", "#C9A0B4", 'font-weight="600" letter-spacing=".04"')
      + nk.map((r, k) => `${TX(.3, 1.25 + k * .62, .32, r.st, r === worst ? "#EEF3FA" : "#8C95A8")}<rect x="3.3" y="${.98 + k * .62}" width="${(r.u / nmax * 6.6).toFixed(2)}" height=".36" fill="${stageHex(r.st)}" opacity="${r === worst ? 1 : .7}"/>${TX(10.1, 1.25 + k * .62, .3, String(r.n), "#8C95A8")}`).join("") + `</g>`, { ppu: 70 });
    glow(NK, 40.7, 35.6, 3.5, "#C9A0B4", 8, .1);
    EDITORS.forEach(([n], i) => {
      const s = sm.get(firstName(n).toLowerCase()) || { u: 0, late: 0 }, ratio = s.u / capOf(n), x = 22.4 + i * 3.1;
      flat(con, x, 35.4, 2.4, 3.1, "#262B33", 1.25); flat(con, x + 1.05, 35.6, .3, 2.7, "#0B0D11", 1.27);
      const ky = 35.6 + (1 - Math.min(2, ratio) / 2) * 2.4;
      bx(con, x + .75, ky, 1.3, .9, .45, .28, ratio > 1 ? "#E23A57" : "#C9D0DA", { m: { metalness: .5, roughness: .3 } });
      const led = bx(con, x + 1.9, 37.9, 1.28, .32, .32, .16, s.late ? "#FF4D6A" : "#1B2330", s.late ? { own: true, m: { emissive: "#FF4D6A", emissiveIntensity: .8 } } : {});
      if (s.late) anim.blink.push({ m: led.material, base: .8 });
      fz(con, x + .25, 38.2, 1.29, 1.6, .5, TM(0, .4, .42, initials(n), "#C9D3E2", 'font-weight="600"'));
    });
    bx(con, 21.2, 35.2, 1.25, .9, .9, 1.6, "#15181E"); bx(con, 56.6, 35.2, 1.25, .9, .9, 1.6, "#15181E");
    bx(CR, 38.2, 40.3, 0, 1.6, 1.6, .85, "#252A33"); person(CR, 39, 40.6, .85, "#B0102E", "AG", Math.PI); bx(CR, 38.2, 41.6, .85, 1.6, .28, 1.25, "#2D333D");
    lab("You", 39, 40.6, 3.2, "you", {}, 110);
    fz(CR, 24, 42.6, 0, 14, 1.4, TM(0, 1, .95, "CONTROL ROOM", "#4B5874", 'letter-spacing=".3"'));
    fz(CR, 50, 42.2, 0, 13, 1.2, TX(0, .8, .7, `${fmtU(suites().reduce((a, s) => a + s.u, 0))} of ${EDITORS.reduce((a, [n]) => a + capOf(n), 0)} units/wk in edit`, "#6F7C92"));
    if (!ready) lab(esc(S.error ? "Couldn't read your board" : "Opening the studio…"), 32, 12, 6, "msg", {}, 999);
  }

  /* ---------- camera moves ---------- */
  let tween = null;
  function flyTo(target, pos, ms = 1100) {
    const t1 = new THREE.Vector3(...target), p1 = new THREE.Vector3(...pos);
    if (RM) { controls.target.copy(t1); camera.position.copy(p1); controls.update(); return; }
    tween = { t0: performance.now(), ms, a: controls.target.clone(), b: t1, pa: camera.position.clone(), pb: p1 };
  }
  R3D.view = i => { const v = VIEWS[i]; if (!v) return; flyTo(v[1], v[2]); ui.querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === i)); };
  const offset = () => camera.position.clone().sub(controls.target);
  function turn(rad) { const o = offset().applyAxisAngle(new THREE.Vector3(0, 1, 0), rad); flyTo(controls.target.toArray(), controls.target.clone().add(o).toArray(), 380); }
  function tilt(d) { const s = new THREE.Spherical().setFromVector3(offset()); s.phi = Math.max(0.12, Math.min(controls.maxPolarAngle, s.phi - d * 0.3)); flyTo(controls.target.toArray(), controls.target.clone().add(new THREE.Vector3().setFromSpherical(s)).toArray(), 380); }
  function zoom(d) { const o = offset(), L = Math.max(controls.minDistance, Math.min(controls.maxDistance, o.length() * (d > 0 ? 0.75 : 1.33))); flyTo(controls.target.toArray(), controls.target.clone().add(o.setLength(L)).toArray(), 320); }
  function pan(dx, dz) { const o = offset(), f = new THREE.Vector3(-o.x, 0, -o.z).normalize(), r = new THREE.Vector3(-f.z, 0, f.x), st = Math.max(2, o.length() * 0.12), mv = f.multiplyScalar(dz * st).add(r.multiplyScalar(dx * st)); flyTo(controls.target.clone().add(mv).toArray(), camera.position.clone().add(mv).toArray(), 260); }
  controls.addEventListener("start", () => { tween = null; ui.querySelectorAll("button.on").forEach(b => b.classList.remove("on")); });
  ui.addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) R3D.view(+b.dataset.view); });
  nav.addEventListener("click", e => { const b = e.target.closest("[data-nav]"); if (!b) return; const d = +b.dataset.d; ({ turn: () => turn(d * Math.PI / 8), tilt: () => tilt(d), zoom: () => zoom(d) })[b.dataset.nav](); });
  box3.addEventListener("keydown", e => {
    if (e.target !== box3 || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), act = { arrowleft: () => pan(-1, 0), a: () => pan(-1, 0), arrowright: () => pan(1, 0), d: () => pan(1, 0), arrowup: () => pan(0, 1), w: () => pan(0, 1), arrowdown: () => pan(0, -1), s: () => pan(0, -1), q: () => turn(-Math.PI / 12), e: () => turn(Math.PI / 12), "+": () => zoom(1), "=": () => zoom(1), "-": () => zoom(-1), r: () => tilt(1), f: () => tilt(-1) }[k];
    if (act) { e.preventDefault(); act(); } else if (/^[1-6]$/.test(k)) { e.preventDefault(); R3D.view(+k - 1); }
  });

  /* ---------- picking: hover, click, double-click, drag a guest into a booth ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tipEl = $("tip");
  function hit(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hs = ray.intersectObjects(pickables, false);
    for (const h of hs) { const m = h.object.material; if (m && m.transparent && m.opacity < 0.5) continue; if (!visibleChain(h.object)) continue; return h; }
    return null;
  }
  const visibleChain = o => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
  function info(o) { const r = {}; for (let n = o; n; n = n.parent) { const d = n.userData; if (!r.tip && d.tip) { r.tip = d.tip; r.tip2 = d.tip2; } if (!r.pick && (d.ep || d.gep)) r.pick = d; if (!r.room && d.room) r.room = d.room; if (!r.drop && d.drop) r.drop = n; } return r; }
  const placeTip = (el, e) => { const r = host.getBoundingClientRect(); el.style.left = Math.min(r.width - el.offsetWidth - 8, e.clientX - r.left + 14) + "px"; el.style.top = Math.min(r.height - el.offsetHeight - 8, e.clientY - r.top + 14) + "px"; };
  let down = null, drag = null, hoverT = 0;
  box3.addEventListener("pointerdown", e => {
    if (e.target !== renderer.domElement) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    const h = hit(e.clientX, e.clientY), f = h && info(h.object);
    if (f && f.pick && f.pick.gep && e.button === 0) { controls.enabled = false; drag = { id: f.pick.gep, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, over: null }; }
  }, true);
  window.addEventListener("pointermove", e => {
    if (drag) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      if (!drag.moved) { drag.moved = true; const it = S.items.find(i => i.id === drag.id); drag.ghost = document.createElement("div"); drag.ghost.className = "tip"; drag.ghost.innerHTML = `<b>${esc(it ? it.name : "")}</b><span>Drop in an editor's booth</span>`; host.appendChild(drag.ghost); tipEl.hidden = true; }
      placeTip(drag.ghost, e);
      const h = hit(e.clientX, e.clientY), b = h && info(h.object).drop;
      if (b !== drag.over) { if (drag.over) drag.over.userData.hl.visible = false; drag.over = b || null; if (b) { b.userData.hl.visible = true; drag.ghost.querySelector("span").textContent = "Give to " + firstName(b.userData.drop); } else drag.ghost.querySelector("span").textContent = "Drop in an editor's booth"; }
      return;
    }
    if (e.target !== renderer.domElement || e.buttons) { if (e.target !== renderer.domElement) renderer.domElement.style.cursor = ""; return; }
    const now = performance.now(); if (now - hoverT < 40) return; hoverT = now;
    const h = hit(e.clientX, e.clientY), f = h ? info(h.object) : {};
    renderer.domElement.style.cursor = f.pick && f.pick.gep ? "grab" : f.pick || f.room ? "pointer" : "";
    if (!f.tip) { tipEl.hidden = true; return; }
    tipEl.innerHTML = `<b>${esc(f.tip)}</b>${f.tip2 ? `<span>${esc(f.tip2)}</span>` : ""}`; tipEl.hidden = false; placeTip(tipEl, e);
  });
  renderer.domElement.addEventListener("pointerleave", () => { if (!drag) tipEl.hidden = true; });
  window.addEventListener("pointerup", e => {
    const d = drag, dn = down; drag = null; down = null; controls.enabled = true;
    if (d) {
      if (d.ghost) d.ghost.remove(); if (d.over) d.over.userData.hl.visible = false;
      const it = S.items.find(i => i.id === d.id); if (!it) return;
      if (!d.moved) openEp(it.id); else if (d.over) reassign(it, d.over.userData.drop);
      return;
    }
    if (!dn || e.target !== renderer.domElement || Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 5 || e.button !== 0) return;
    const h = hit(e.clientX, e.clientY); if (!h) return; const f = info(h.object);
    if (f.pick) openEp(f.pick.ep || f.pick.gep); else if (f.room) { S.drawer = f.room; renderDrawer(); }
  });
  renderer.domElement.addEventListener("dblclick", e => {
    const h = hit(e.clientX, e.clientY); if (!h) return;
    const o = offset(), L = Math.min(o.length(), 22); flyTo(h.point.toArray(), h.point.clone().add(o.setLength(L)).toArray(), 700);
  });

  /* ---------- frame loop ---------- */
  const v = new THREE.Vector3(); let occT = 0, W0 = 0, H0 = 0;
  function size() { const w = box3.clientWidth, h = box3.clientHeight; if (!w || !h || (w === W0 && h === H0)) return; W0 = w; H0 = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 640 ? 55 : 42; camera.updateProjectionMatrix(); }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function frame(now) {
    requestAnimationFrame(frame); size();
    if (tween) { const k = Math.min(1, (now - tween.t0) / tween.ms), e = ease(k); controls.target.lerpVectors(tween.a, tween.b, e); camera.position.lerpVectors(tween.pa, tween.pb, e); if (k >= 1) tween = null; }
    controls.update();
    if (!RM) {
      const s = now / 1000;
      anim.cars.forEach(c => { const y = ((c.off + s * c.sp * c.dir) % 130 + 130) % 130 - 36; c.c.position.z = y; });
      if (anim.train) anim.train.position.z = ((s * 3.2) % 130) - 40;
      const b = 0.55 + 0.45 * Math.sin(s * 4.4);
      anim.blink.forEach(x => { if (x.o) x.o.material.opacity = x.base * (0.45 + 0.55 * b); if (x.m) x.m.emissiveIntensity = x.base * b; });
    }
    fades.forEach(f => { const out = (camera.position.x - f.px) * f.nx + (camera.position.z - f.pz) * f.nz > 0; if (out === f.out) return; f.out = out;
      f.meshes.forEach(m => { m.material.transparent = true; m.material.opacity = out ? 0.1 : 1; m.material.depthWrite = !out; m.castShadow = !out; m.material.needsUpdate = true; }); });
    renderer.render(scene, camera);
    /* labels: project, fade with distance, dim when something solid is in front */
    const occ = ++occT % 6 === 0;
    for (const L of labels) {
      v.copy(L.v).project(camera);
      const dist = camera.position.distanceTo(L.v), off = v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1 || dist > L.far;
      if (off !== L.hid) { L.hid = off; L.el.style.display = off ? "none" : ""; }
      if (off) continue;
      const X = Math.round((v.x + 1) / 2 * W0), Y = Math.round((1 - v.y) / 2 * H0);
      if (X !== L.x || Y !== L.y) { L.x = X; L.y = Y; L.el.style.transform = `translate(${X}px,${Y}px) translate(-50%,-100%)`; }
      if (occ) {
        ray.set(camera.position, L.v.clone().sub(camera.position).normalize()); ray.far = dist - 0.8;
        const hs = ray.intersectObjects(pickables, false).filter(h => !(h.object.material.transparent && h.object.material.opacity < .5));
        const o = hs.length > 0; if (o !== L.occ) { L.occ = o; L.el.classList.toggle("occ", o); }
        ray.far = Infinity;
      }
    }
    /* declutter: where tags overlap, the more important one stays (live, late, busy, then the rest) */
    if (occ) {
      const shown = labels.filter(L => !L.hid).sort((a, b) => b.pri - a.pri || (a.occ - b.occ)), kept = [];
      for (const L of shown) {
        if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
        const r = { l: L.x - L.w / 2 - 2, r: L.x + L.w / 2 + 2, t: L.y - L.h - 2, b: L.y + 2 };
        const c = kept.some(k => r.l < k.r && r.r > k.l && r.t < k.b && r.b > k.t);
        if (!c) kept.push(r);
        if (c !== L.crowd) { L.crowd = c; L.el.style.visibility = c ? "hidden" : ""; }
      }
    }
  }
  R3D.on = true;
  R3D.build = build;
  /* Test hook: where on screen an object is (keys like "ep:12", "gep:4", "drop:Akssat", "room:studio:Eden"). */
  R3D.where = key => { const o = reg.get(key); if (!o) return null; o.updateWorldMatrix(true, true); camera.updateMatrixWorld(); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height }; };
  R3D.jump = (target, pos) => { tween = null; controls.target.set(...target); camera.position.set(...pos); controls.update(); camera.updateMatrixWorld(); };
  R3D.stats = () => ({ meshes: pickables.length, labels: labels.length, textures: texC.size, calls: renderer.info.render.calls });
  setInterval(() => build(), 60000);
  requestAnimationFrame(frame);
})();
const renderSVG = renderScene;
renderScene = function () { if (R3D.on) R3D.build(); else renderSVG(); };
