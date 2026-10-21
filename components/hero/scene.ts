// Kinetic hero: an outline drawing of a ceiling services assembly that assembles,
// pulls apart under the cursor, explodes and lays itself out by trade.
// Ported from the standalone prototype (Three.js r128 + GSAP) with the same
// geometry, shaders and timing. Colours are passed to the shaders unconverted,
// as r128 did, so the render matches the prototype.
import * as THREE from 'three';
import gsap from 'gsap';

export type HeroElements = {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  spark: HTMLElement;
  markTexts: SVGTextElement[];
  tagLines: HTMLElement[];
  cursor: HTMLElement;
  ring: HTMLElement;
  cross: HTMLElement;
  fail: HTMLElement;
  fontFamily: string;
};

type Layout = { q: THREE.Quaternion; len: number; dep: number; hei: number; axis: number };
type Part = {
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial; group: string; cat: string;
  A: THREE.Vector3; qA: THREE.Quaternion; E: THREE.Vector3; rot: THREE.Vector3;
  e0: THREE.Vector3; e1: THREE.Vector3;
  lay: number; w: number; lens: number; lensV: number; flash: number; armed: boolean; on: boolean;
  base: number; ph: number; lo: Layout;
  L: THREE.Vector3; qL: THREE.Quaternion; l0: THREE.Vector3; l1: THREE.Vector3;
  inX: number; layIdx: number;
};
type Cam = { p: number[]; t: number[]; fov: number };

export function startKineticHero(el: HeroElements): () => void {
  const { stage, canvas } = el;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const calls: gsap.core.Tween[] = [];

  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
  catch { el.fail.style.display = 'grid'; return () => ac.abort(); }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(new THREE.Color(0.5, 0.5, 0), 0);

  /* ---------- palette (shader side) ---------- */
  const raw = (hex: string) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
  const C = {
    silver: raw('#d7dce3'),
    blue: raw('#3d8bff'),
    bg0: raw('#161b22'),
    bg1: raw('#0a0c0f'),
  };

  /* ---------- seeded random ---------- */
  let seed = 20261021;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rr = (a: number, b: number) => a + (b - a) * rnd();
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 120);

  const PART_VS = `
varying vec3 vN;
void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const PART_FS = `
uniform float uBlue; uniform float uEmph; varying vec3 vN;
void main(){ vec3 n = normalize(vN); gl_FragColor = vec4(n.xy*0.5+0.5, uBlue, uEmph); }`;
  const partMat = new THREE.ShaderMaterial({ uniforms: { uBlue: { value: 0 }, uEmph: { value: 0.5 } }, vertexShader: PART_VS, fragmentShader: PART_FS });

  /* ---------- geometry helpers (every part is authored with its long axis on local X) ---------- */
  function cylX(r: number, len: number, seg?: number) { const g = new THREE.CylinderGeometry(r, r, len, seg || 18, 1, false); g.rotateZ(Math.PI / 2); return g; }
  function cylY(r: number, len: number, seg?: number) { return new THREE.CylinderGeometry(r, r, len, seg || 16, 1, false); }
  function box(x: number, y: number, z: number) { return new THREE.BoxGeometry(x, y, z); }
  function merge(list: THREE.BufferGeometry[]) {
    const gs = list.map(g => g.index ? g.toNonIndexed() : g);
    let n = 0; gs.forEach(g => n += g.attributes.position.count);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    gs.forEach(g => { pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); o += g.attributes.position.count; });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return out;
  }
  const Q_ID = new THREE.Quaternion();
  const Q_X2Y = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2);
  const Q_X2Z = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -Math.PI / 2);

  function layOrient(size: THREE.Vector3): Layout {
    const d = [size.x, size.y, size.z];
    const idx = [0, 1, 2].sort((i, j) => d[j] - d[i]);
    const a = idx[0], b = idx[1], c = idx[2];
    const img: THREE.Vector3[] = []; img[a] = V(1, 0, 0); img[c] = V(0, 1, 0); img[b] = V(0, 0, 1);
    const m = new THREE.Matrix4().makeBasis(img[0], img[1], img[2]);
    if (m.determinant() < 0) { img[b] = V(0, 0, -1); m.makeBasis(img[0], img[1], img[2]); }
    return { q: new THREE.Quaternion().setFromRotationMatrix(m), len: d[a], dep: d[b], hei: d[c], axis: a };
  }

  const parts: Part[] = [];
  const CAT: Record<string, string> = {
    beam: 'structure', rod: 'supports', trapeze: 'supports',
    duct: 'ductwork', flange: 'ductwork', round: 'ductwork', roundc: 'ductwork',
    refrig: 'pipework', pipe: 'pipework', coupling: 'pipework', valve: 'pipework', drop: 'pipework',
    tray: 'electrical', cable: 'electrical', trunk: 'electrical', sprMain: 'sprinklers', spr: 'sprinklers',
  };
  const SX = 0.16; // exploded spread along runs

  function addPart(geo: THREE.BufferGeometry, pos: THREE.Vector3, quat: THREE.Quaternion, group: string, off: THREE.Vector3, opt: { dim?: boolean; rot?: number } = {}) {
    geo.computeBoundingBox();
    const c = new THREE.Vector3(); geo.boundingBox!.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z); geo.computeBoundingBox(); geo.computeBoundingSphere();
    const size = new THREE.Vector3(); geo.boundingBox!.getSize(size);
    const A = pos.clone().add(c.clone().applyQuaternion(quat));
    const mat = partMat.clone();
    const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; scene.add(mesh);
    const lay = layOrient(size);
    const dims = [size.x, size.y, size.z];
    const ax = [V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)][lay.axis].applyQuaternion(quat).multiplyScalar(dims[lay.axis] / 2);
    const p: Part = {
      mesh, mat, group, cat: CAT[group], A, qA: quat.clone(),
      E: A.clone().add(off), rot: V(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(opt.rot ?? 0.05),
      e0: A.clone().sub(ax), e1: A.clone().add(ax),
      lay: 0, w: 0, lens: 0, lensV: 0, flash: 0, armed: false, on: false,
      base: (opt.dim ? 0.26 : 0.5) + ((parts.length * 5) % 9) / 255, ph: rnd() * 6.283, lo: lay,
      L: new THREE.Vector3(), qL: lay.q, l0: new THREE.Vector3(), l1: new THREE.Vector3(),
      inX: A.x, layIdx: 0,
    };
    parts.push(p);
    return p;
  }

  /* ---------- the assembly ---------- */
  const XS: number[] = []; for (let i = 0; i <= 10; i++) XS.push(-12 + i * 2.4);
  const ZA = -3.6, ZB = 2.0, ZMID = (ZA + ZB) / 2, SLAB = 3.1;
  const TIER = [1.5, 0.1, -1.3];
  const TY = [2.7, 0, -2.7];
  const SEGB: number[] = []; for (let x = -13.2; x <= 13.21; x += 2.4) SEGB.push(+x.toFixed(2));
  const dz = (z: number) => (z - ZMID) * 0.32;

  // structure
  [-10.8, -6, -1.2, 3.6, 8.4, 13.2].forEach(x => {
    addPart(box(8.4, 0.55, 0.4), V(x, SLAB + 0.275, ZMID), Q_X2Z, 'beam', V(x * SX, 5.0, 0), { dim: true, rot: 0.02 });
  });
  [ZA - 0.55].forEach(z => [[-13.4, -0.2], [-0.2, 13.4]].forEach(([a, b]) => {
    addPart(box(b - a - 0.04, 0.8, 0.5), V((a + b) / 2, SLAB + 0.4, z), Q_ID, 'beam', V((a + b) / 2 * SX, 5.6, Math.sign(z - ZMID) * 1.2), { dim: true, rot: 0.015 });
  }));

  // hanger rods with nuts at each trapeze
  const rodTop = SLAB, rodBot = TIER[2] - 0.38, rodLen = rodTop - rodBot, rodMid = (rodTop + rodBot) / 2;
  XS.forEach(x => [ZA, ZB].forEach(z => {
    const list: THREE.BufferGeometry[] = [cylX(0.024, rodLen, 8)];
    TIER.forEach(ty => {
      [ty - 0.135, ty + 0.03].forEach(ny => { const n = new THREE.CylinderGeometry(0.052, 0.052, 0.045, 6); n.rotateZ(Math.PI / 2); n.translate(ny - rodMid, 0, 0); list.push(n); });
    });
    addPart(merge(list), V(x, rodMid, z), Q_X2Y, 'rod', V(x * SX, 3.6, Math.sign(z - ZMID) * 1.6), { rot: 0.03 });
  }));

  // unistrut trapezes (C channel)
  TIER.forEach((ty, ti) => XS.forEach(x => {
    const L = (ZB - ZA) + 0.5;
    const g = merge([
      box(L, 0.012, 0.085).translate(0, 0.044, 0),
      box(L, 0.1, 0.012).translate(0, 0, -0.037),
      box(L, 0.1, 0.012).translate(0, 0, 0.037),
      box(L, 0.012, 0.02).translate(0, -0.044, -0.03),
      box(L, 0.012, 0.02).translate(0, -0.044, 0.03),
    ]);
    addPart(g, V(x, ty - 0.05, ZMID), Q_X2Z, 'trapeze', V(x * SX, TY[ti], 0), { rot: 0.03 });
  }));

  function runSegments(step: number, phase: number) {
    const out: [number, number][] = []; let a = -13.2;
    let b = -13.2 + step - phase; if (b <= a + 0.6) b += step;
    while (a < 13.2) { out.push([a, Math.min(b, 13.2)]); a = b; b += step; }
    return out;
  }

  // top tier: rectangular ducts with flanges
  [[1.1, 0.62, -2.35, 0.75], [0.72, 0.44, -0.7, 1.35]].forEach(([w, h, z, lift]) => {
    const y = TIER[0] + h / 2;
    for (let i = 0; i < SEGB.length - 1; i++) {
      const a = SEGB[i], b = SEGB[i + 1], cx = (a + b) / 2;
      addPart(box(b - a - 0.03, h, w), V(cx, y, z), Q_ID, 'duct', V(cx * SX, TY[0] + lift, dz(z)));
      if (i > 0) addPart(box(0.05, h + 0.12, w + 0.12), V(a, y, z), Q_ID, 'flange', V(a * SX, TY[0] + lift, dz(z)), { rot: 0.08 });
    }
  });
  // spiral duct
  {
    const r = 0.27, z = 0.75, y = TIER[0] + r;
    for (let i = 0; i < SEGB.length - 1; i++) {
      const a = SEGB[i], b = SEGB[i + 1], cx = (a + b) / 2;
      addPart(cylX(r, b - a - 0.03, 26), V(cx, y, z), Q_ID, 'round', V(cx * SX, TY[0] + 1.9, dz(z)));
      if (i > 0) addPart(cylX(r + 0.03, 0.11, 26), V(a, y, z), Q_ID, 'roundc', V(a * SX, TY[0] + 1.9, dz(z)), { rot: 0.1 });
    }
  }
  // refrigerant pair
  runSegments(4.8, 0.8).forEach(([a, b]) => {
    const cx = (a + b) / 2, L = b - a - 0.04;
    addPart(merge([cylX(0.03, L, 10).translate(0, 0, -0.09), cylX(0.03, L, 10).translate(0, 0, 0.09)]), V(cx, TIER[0] + 0.03, 1.55), Q_ID, 'refrig', V(cx * SX, TY[0] + 2.4, dz(1.55)));
  });

  // middle tier: service pipes, couplings, valves, drops
  const PIPES = [[0.16, -3.0], [0.11, -2.45], [0.11, -2.05], [0.2, -1.3], [0.08, -0.68], [0.08, -0.42], [0.13, 0.3], [0.1, 0.95], [0.06, 1.5]];
  PIPES.forEach(([r, z], k) => {
    const y = TIER[1] + r;
    const lift = 0.55 + k * 0.1;
    runSegments(4.8, (k % 3) * 1.6).forEach(([a, b], i) => {
      const cx = (a + b) / 2;
      addPart(cylX(r, b - a - 0.02, 20), V(cx, y, z), Q_ID, 'pipe', V(cx * SX, TY[1] + lift, dz(z)));
      if (i > 0) addPart(cylX(r * 1.32, 0.13, 20), V(a, y, z), Q_ID, 'coupling', V(a * SX, TY[1] + lift, dz(z)), { rot: 0.1 });
    });
  });
  function valve(x: number, r: number, z: number) {
    const y = TIER[1] + r;
    const top = r * 1.25;
    const wheel = new THREE.TorusGeometry(0.2, 0.022, 8, 28); wheel.rotateX(Math.PI / 2); wheel.translate(0, top + 0.36, 0);
    const spoke1 = box(0.4, 0.02, 0.02).translate(0, top + 0.36, 0), spoke2 = box(0.02, 0.02, 0.4).translate(0, top + 0.36, 0);
    const g = merge([box(0.46, r * 2.5, r * 2.5), cylY(0.055, 0.34, 12).translate(0, top + 0.17, 0), wheel, spoke1, spoke2,
      cylX(r * 1.45, 0.06, 20).translate(-0.26, 0, 0), cylX(r * 1.45, 0.06, 20).translate(0.26, 0, 0)]);
    addPart(g, V(x, y, z), Q_ID, 'valve', V(x * SX, TY[1] + 1.7, dz(z)), { rot: 0.12 });
  }
  valve(-6.0, 0.2, -1.3); valve(4.8, 0.13, 0.3); valve(-1.2, 0.16, -3.0);
  function drop(x: number, r: number, z: number) {
    const y = TIER[1] + r, L = y + 5.2;
    const g = merge([cylX(r * 1.3, r * 3.4, 18), cylY(r * 1.3, r * 2.2, 18).translate(0, -r * 1.1, 0), cylY(r, L, 18).translate(0, -L / 2, 0)]);
    addPart(g, V(x, y, z), Q_ID, 'drop', V(x * SX, -3.4, dz(z)), { rot: 0.03 });
  }
  drop(-8.4, 0.08, -0.68); drop(9.6, 0.13, 0.3); drop(2.4, 0.1, 0.95);

  // bottom tier: ladder trays, cables, trunking, sprinklers
  [[0.7, -2.6, 0.6], [0.5, -1.3, 0.95]].forEach(([w, z, lift]) => {
    const y = TIER[2] + 0.06;
    for (let i = 0; i < SEGB.length - 1; i++) {
      const a = SEGB[i], b = SEGB[i + 1], cx = (a + b) / 2, L = b - a - 0.03;
      const list: THREE.BufferGeometry[] = [box(L, 0.12, 0.025).translate(0, 0, -w / 2), box(L, 0.12, 0.025).translate(0, 0, w / 2)];
      for (let rx = -L / 2 + 0.15; rx < L / 2; rx += 0.3) list.push(box(0.035, 0.022, w).translate(rx, -0.048, 0));
      addPart(merge(list), V(cx, y, z), Q_ID, 'tray', V(cx * SX, TY[2] + lift, dz(z)));
    }
    runSegments(4.8, 2.0).forEach(([a, b]) => {
      const cx = (a + b) / 2, L = b - a - 0.05, list: THREE.BufferGeometry[] = [];
      const n = Math.round(w / 0.14);
      for (let k = 0; k < n; k++) { const oz = -w / 2 + 0.09 + k * ((w - 0.18) / (n - 1)); list.push(cylX(0.026, L, 10).translate(0, (k % 2) * 0.03, oz)); }
      addPart(merge(list), V(cx, TIER[2] + 0.04, z), Q_ID, 'cable', V(cx * SX, TY[2] + lift + 0.55, dz(z)));
    });
  });
  for (let i = 0; i < SEGB.length - 1; i++) {
    const a = SEGB[i], b = SEGB[i + 1], cx = (a + b) / 2, L = b - a - 0.03;
    addPart(merge([box(L, 0.15, 0.22), box(L, 0.02, 0.25).translate(0, 0.085, 0)]), V(cx, TIER[2] + 0.075, -0.1), Q_ID, 'trunk', V(cx * SX, TY[2] + 0.8, dz(-0.1)));
  }
  runSegments(4.8, 1.2).forEach(([a, b]) => {
    const cx = (a + b) / 2;
    addPart(cylX(0.055, b - a - 0.03, 14), V(cx, TIER[2] + 0.055, 1.4), Q_ID, 'sprMain', V(cx * SX, TY[2] + 0.7, dz(1.4)));
  });
  XS.forEach(x0 => {
    const x = x0 + 1.2; if (x > 13) return;
    const g = merge([cylY(0.022, 0.9, 10).translate(0, -0.45, 0), new THREE.CylinderGeometry(0.02, 0.05, 0.07, 14).translate(0, -0.93, 0), cylY(0.075, 0.012, 18).translate(0, -0.98, 0)]);
    addPart(g, V(x, TIER[2] + 0.055, 1.4), Q_ID, 'spr', V(x * SX, TY[2] - 1.3, dz(1.4)), { rot: 0.04 });
  });

  const N = parts.length;

  /* ---------- laydown: pack every part flat by trade ---------- */
  const CATS = ['structure', 'supports', 'ductwork', 'pipework', 'electrical', 'sprinklers'];
  const GORDER = ['beam', 'rod', 'trapeze', 'duct', 'flange', 'round', 'roundc', 'refrig', 'pipe', 'coupling', 'valve', 'drop', 'tray', 'cable', 'trunk', 'sprMain', 'spr'];
  const FLOOR = -1.6, XMIN = -17.5, XMAX = 17.5;
  {
    let z = 0;
    CATS.forEach(key => {
      const list = parts.filter(p => p.cat === key).sort((a, b) => (GORDER.indexOf(a.group) - GORDER.indexOf(b.group)) || (b.lo.len - a.lo.len) || (b.lo.dep - a.lo.dep));
      let x = XMIN, rowD = 0, lastG: string | null = null;
      list.forEach(p => {
        const o = p.lo;
        const gap = (lastG && lastG !== p.group) ? 0.6 : (o.len > 2 ? 0.2 : 0.1);
        if (x > XMIN) x += gap;
        if (x + o.len > XMAX && x > XMIN) { z += rowD + Math.max(0.2, Math.min(0.32, 0.12 + rowD)); x = XMIN; rowD = 0; }
        p.L.set(x + o.len / 2, FLOOR + o.hei / 2, z + o.dep / 2);
        x += o.len; rowD = Math.max(rowD, o.dep); lastG = p.group;
      });
      z += rowD;
      z += 1.05;
    });
    const total = z - 1.05, shift = -total / 2 - 0.6;
    parts.forEach(p => {
      p.L.z += shift;
      const h = V(p.lo.len / 2, 0, 0);
      p.l0.copy(p.L).sub(h); p.l1.copy(p.L).add(h);
    });
  }

  /* ---------- camera states ---------- */
  const CAMS: Cam[] = [
    { p: [14.5, 3.9, 11.0], t: [-2.6, 0.3, -1.0], fov: 38 },
    { p: [25.5, 10.5, 21.5], t: [-1.6, 0.9, -1.0], fov: 38 },
    { p: [1.2, 22.5, 12.5], t: [0.0, FLOOR, -0.3], fov: 34 },
  ];
  (function fitLaydown() {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    parts.forEach(p => { x0 = Math.min(x0, p.l0.x); x1 = Math.max(x1, p.l1.x); z0 = Math.min(z0, p.L.z - p.lo.dep / 2); z1 = Math.max(z1, p.L.z + p.lo.dep / 2); });
    const ctr = V((x0 + x1) / 2, FLOOR, (z0 + z1) / 2);
    const dir = V(0.05, 1.0, 0.5).normalize();
    const c = new THREE.PerspectiveCamera(26, 16 / 9, 0.5, 200);
    const pts = [V(x0, FLOOR, z0), V(x1, FLOOR, z0), V(x0, FLOOR, z1), V(x1, FLOOR, z1), V(x0, FLOOR + 1, z0), V(x1, FLOOR + 1, z0)];
    let d = 8;
    for (; d < 140; d += 0.25) {
      c.position.copy(ctr).addScaledVector(dir, d); c.lookAt(ctr); c.updateMatrixWorld(); c.updateProjectionMatrix();
      let ok = true;
      for (const q of pts) { const v = q.clone().project(c); if (Math.abs(v.x) > 0.9 || v.y > 0.76 || v.y < -0.84) { ok = false; break; } }
      if (ok) break;
    }
    const pos = ctr.clone().addScaledVector(dir, d);
    CAMS[2] = { p: [pos.x, pos.y, pos.z], t: [ctr.x, ctr.y - 0.4, ctr.z], fov: 26 };
  })();
  const cam = { px: CAMS[0].p[0] + 6, py: CAMS[0].p[1] + 5, pz: CAMS[0].p[2] + 7, tx: CAMS[0].t[0], ty: CAMS[0].t[1], tz: CAMS[0].t[2], fov: CAMS[0].fov, par: 1 };

  /* ---------- post: outline, glow, finish ---------- */
  const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const OUTLINE_FS = `
uniform sampler2D tN; uniform sampler2D tD;
uniform vec2 uRes; uniform float uPx; uniform float uNear; uniform float uFar;
uniform vec3 uSilver; uniform vec3 uBlueC; uniform vec3 uBg0; uniform vec3 uBg1;
uniform float uFogN; uniform float uFogF; uniform float uAspect;
varying vec2 vUv;
float lin(float z){ float n = z*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear-n*(uFar-uNear)); }
vec3 dec(vec2 e){ vec2 xy = e*2.0-1.0; return vec3(xy, sqrt(max(0.0, 1.0-dot(xy,xy)))); }
void main(){
  vec2 px = vec2(uPx) / uRes;
  vec4 c0 = texture2D(tN, vUv); float z0 = texture2D(tD, vUv).x; bool bg0 = z0 > 0.99999; float d0 = bg0 ? 1e4 : lin(z0);
  vec3 n0 = dec(c0.xy);
  float gz = 1.0 / max(n0.z, 0.2);
  vec2 offs[8];
  offs[0]=vec2(1.0,0.0); offs[1]=vec2(-1.0,0.0); offs[2]=vec2(0.0,1.0); offs[3]=vec2(0.0,-1.0);
  offs[4]=vec2(0.7,0.7); offs[5]=vec2(-0.7,0.7); offs[6]=vec2(0.7,-0.7); offs[7]=vec2(-0.7,-0.7);
  float edge = 0.0; vec4 ink = c0; float inkD = d0;
  for (int i=0;i<8;i++){
    vec2 uv = vUv + offs[i]*px;
    vec4 ci = texture2D(tN, uv); float zi = texture2D(tD, uv).x; bool bgi = zi > 0.99999; float di = bgi ? 1e4 : lin(zi);
    float e = 0.0;
    if (bg0 && bgi) e = 0.0;
    else if (bg0 != bgi) e = 1.0;
    else {
      float dd = abs(di-d0)/min(di,d0);
      float de = smoothstep(0.0035*gz, 0.009*gz, dd);
      float ne = smoothstep(0.1, 0.28, 1.0 - dot(n0, dec(ci.xy)));
      float ce = max(step(0.06, abs(ci.z-c0.z)), step(0.0018, abs(ci.w-c0.w)));
      e = max(max(de, ne), ce);
    }
    edge += e;
    if (e > 0.5 && !bgi && di < inkD){ inkD = di; ink = ci; }
  }
  edge = clamp(edge*0.36, 0.0, 1.0);
  float blue = ink.z; float em = ink.w;
  vec3 base = mix(uSilver, uBlueC, blue);
  float bright = mix(0.24, 1.0, clamp(em*2.0, 0.0, 1.0));
  float flash = clamp(em*2.0-1.0, 0.0, 1.0);
  float fog = smoothstep(uFogN, uFogF, inkD);
  vec3 inkC = mix(base*bright, vec3(1.0), flash) * mix(1.0, 0.26, fog);
  vec2 q = (vUv-0.5)*vec2(uAspect,1.0);
  vec3 bg = mix(uBg0, uBg1, smoothstep(0.0, 1.05, length(q)));
  vec3 col = bg;
  float glowFill = 0.0;
  if (!bg0){
    float f0 = smoothstep(uFogN, uFogF, d0);
    vec3 b0 = mix(uSilver, uBlueC, c0.z);
    float shade = (0.035 + 0.05*max(n0.y,0.0) + 0.07*c0.z) * (1.0 - f0*0.75);
    col = bg*0.5 + b0*shade;
    glowFill = c0.z * 0.05 * (1.0 - f0);
  }
  col = mix(col, inkC, edge);
  float glow = edge * (blue*0.5 + flash*0.75) * (1.0 - fog*0.6) + glowFill;
  gl_FragColor = vec4(col, clamp(glow, 0.0, 1.0));
}`;
  const DOWN_FS = `
uniform sampler2D tS; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec4 a = texture2D(tS, vUv + uTexel*vec2(-1.0,-1.0));
  vec4 b = texture2D(tS, vUv + uTexel*vec2( 1.0,-1.0));
  vec4 c = texture2D(tS, vUv + uTexel*vec2(-1.0, 1.0));
  vec4 d = texture2D(tS, vUv + uTexel*vec2( 1.0, 1.0));
  vec3 g = (a.rgb*a.a + b.rgb*b.a + c.rgb*c.a + d.rgb*d.a) * 0.25;
  gl_FragColor = vec4(g, 1.0);
}`;
  const COPY_FS = `uniform sampler2D tS; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tS, vUv); }`;
  const BLUR_FS = `
uniform sampler2D tS; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tS, vUv).rgb * 0.2270270;
  s += (texture2D(tS, vUv + uDir*1.3846154).rgb + texture2D(tS, vUv - uDir*1.3846154).rgb) * 0.3162162;
  s += (texture2D(tS, vUv + uDir*3.2307692).rgb + texture2D(tS, vUv - uDir*3.2307692).rgb) * 0.0702703;
  gl_FragColor = vec4(s, 1.0);
}`;
  const FINAL_FS = `
uniform sampler2D tC; uniform sampler2D tB1; uniform sampler2D tB2;
uniform float uTime; uniform vec2 uRes; uniform float uAspect; uniform float uGlow; uniform float uFade;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tC, vUv).rgb;
  vec3 g = texture2D(tB1, vUv).rgb*1.2 + texture2D(tB2, vUv).rgb*1.7;
  c += g * uGlow;
  vec2 q = (vUv-0.5)*vec2(uAspect,1.0);
  c *= mix(0.5, 1.0, smoothstep(1.2, 0.35, length(q)));
  float n = fract(sin(dot(floor(vUv*uRes) + fract(uTime)*97.0, vec2(12.9898,78.233))) * 43758.5453);
  c += (n - 0.5) * 0.032;
  gl_FragColor = vec4(c * uFade, 1.0);
}`;

  const qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mk = (fs: string, u: Record<string, THREE.IUniform>) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: QUAD_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  const mOutline = mk(OUTLINE_FS, {
    tN: { value: null }, tD: { value: null }, uRes: { value: new THREE.Vector2() }, uPx: { value: 1 }, uNear: { value: camera.near }, uFar: { value: camera.far },
    uSilver: { value: C.silver }, uBlueC: { value: C.blue }, uBg0: { value: C.bg0 }, uBg1: { value: C.bg1 }, uFogN: { value: 18 }, uFogF: { value: 34 }, uAspect: { value: 16 / 9 },
  });
  const mDown = mk(DOWN_FS, { tS: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const mCopy = mk(COPY_FS, { tS: { value: null } });
  const mBlur = mk(BLUR_FS, { tS: { value: null }, uDir: { value: new THREE.Vector2() } });
  const mFinal = mk(FINAL_FS, { tC: { value: null }, tB1: { value: null }, tB2: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uAspect: { value: 16 / 9 }, uGlow: { value: 1 }, uFade: { value: 1 } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mCopy); quad.frustumCulled = false; qScene.add(quad);

  type Targets = { n: THREE.WebGLRenderTarget; c: THREE.WebGLRenderTarget; g1a: THREE.WebGLRenderTarget; g1b: THREE.WebGLRenderTarget; g2a: THREE.WebGLRenderTarget; g2b: THREE.WebGLRenderTarget };
  let RT: Targets | null = null;
  function makeTargets(w: number, h: number) {
    if (RT) Object.values(RT).forEach(t => { t.depthTexture?.dispose(); t.dispose(); });
    const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    const n = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) });
    const q4 = [Math.max(1, w >> 2), Math.max(1, h >> 2)], q8 = [Math.max(1, w >> 3), Math.max(1, h >> 3)];
    RT = {
      n, c: new THREE.WebGLRenderTarget(w, h, lin),
      g1a: new THREE.WebGLRenderTarget(q4[0], q4[1], lin), g1b: new THREE.WebGLRenderTarget(q4[0], q4[1], lin),
      g2a: new THREE.WebGLRenderTarget(q8[0], q8[1], lin), g2b: new THREE.WebGLRenderTarget(q8[0], q8[1], lin),
    };
  }
  function pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); }

  /* ---------- sizing ---------- */
  let SW = 1920, SH = 1080, PR = 1, PW = 1920, PH = 1080, K = 1, QUALITY = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    SW = Math.max(1, r.width); SH = Math.max(1, r.height); K = SW / 1920;
    PR = Math.min(window.devicePixelRatio || 1, 2) * QUALITY;
    if (SW * PR > 2560) PR = 2560 / SW;
    PW = Math.round(SW * PR); PH = Math.round(SH * PR);
    renderer.setPixelRatio(1); renderer.setSize(PW, PH, false);
    makeTargets(PW, PH);
    camera.aspect = SW / SH; camera.updateProjectionMatrix();
    mOutline.uniforms.uRes.value.set(PW, PH);
    mOutline.uniforms.uPx.value = Math.max(1.0, 1.15 * PR * Math.max(K, 0.6));
    mOutline.uniforms.uAspect.value = SW / SH; mFinal.uniforms.uAspect.value = SW / SH;
    mFinal.uniforms.uRes.value.set(PW, PH);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  /* ---------- pointer ---------- */
  const ptr = { x: SW / 2, y: SH / 2, nx: 0, ny: 0, sx: 0, sy: 0, in: false, down: false, vx: 0, vy: 0 };
  const { cursor: cursorEl, ring: ringEl, cross: crossEl } = el;
  const curX = gsap.quickTo(cursorEl, 'x', { duration: 0.35, ease: 'power3.out' });
  const curY = gsap.quickTo(cursorEl, 'y', { duration: 0.35, ease: 'power3.out' });
  let lastPX = 0, lastPY = 0, lastPT = performance.now();
  function setPtr(e: PointerEvent | MouseEvent) {
    const r = stage.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    ptr.nx = (ptr.x / SW) * 2 - 1; ptr.ny = (ptr.y / SH) * 2 - 1;
    const now = performance.now(), dtp = Math.max(8, now - lastPT);
    ptr.vx = (ptr.x - lastPX) / dtp; ptr.vy = (ptr.y - lastPY) / dtp;
    lastPX = ptr.x; lastPY = ptr.y; lastPT = now;
    curX(ptr.x); curY(ptr.y);
  }
  stage.addEventListener('pointermove', e => { setPtr(e); if (!ptr.in) { ptr.in = true; ringShow(); } }, on);
  stage.addEventListener('pointerenter', e => { setPtr(e); gsap.set(cursorEl, { x: ptr.x, y: ptr.y }); ptr.in = true; ringShow(); }, on);
  stage.addEventListener('pointerleave', () => { ptr.in = false; ringShow(); }, on);
  stage.addEventListener('pointerdown', e => { setPtr(e); ptr.down = true; gsap.to(crossEl, { rotate: 45, scale: 0.7, duration: 0.35, ease: 'power3.out' }); if (e.pointerType !== 'mouse') { ptr.in = true; } }, on);
  window.addEventListener('pointerup', e => {
    ptr.down = false; gsap.to(crossEl, { rotate: 0, scale: 1, duration: 0.6, ease: 'expo.out' });
    if (e.pointerType !== 'mouse') { calls.push(gsap.delayedCall(0.9, () => { ptr.in = false; })); }
  }, on);
  stage.addEventListener('click', e => {
    if ((e.target as Element).closest('button')) return;
    setPtr(e); go((state + 1) % 3, { x: ptr.x, y: ptr.y });
  }, on);
  function ringShow() {
    const sc = state === 2 ? 0.28 : (state === 1 ? 0.8 : 1);
    gsap.to(ringEl, { scale: ptr.in && lensGate.v > 0.5 ? sc : 0.15, opacity: ptr.in && lensGate.v > 0.5 ? 1 : 0, duration: 0.7, ease: 'expo.out' });
  }

  // Keys only act while the hero has focus, so the rest of the page scrolls and types normally.
  stage.addEventListener('keydown', e => {
    if (e.key === '1' || e.key === '2' || e.key === '3') go(+e.key - 1, { x: SW / 2, y: SH / 2 });
    if (e.key === ' ') { e.preventDefault(); go((state + 1) % 3, { x: SW / 2, y: SH / 2 }); }
  }, on);

  /* ---------- wordmark ---------- */
  const markTexts = el.markTexts;
  const DASH = 1900;
  markTexts.forEach(t => { t.style.strokeDasharray = `${DASH} ${DASH}`; t.style.strokeDashoffset = String(DASH); });
  const markObj = { v: 0 };
  function markApply() { markTexts.forEach((t, i) => { t.style.strokeDashoffset = String(DASH * (1 - markObj.v)); t.style.opacity = String(i === 0 ? 0.85 * markObj.v : Math.min(1, markObj.v * 3)); }); }
  markApply();
  const tagLines = el.tagLines;
  const CLIP_HIDE = 'inset(-30% 100% -30% -4%)', CLIP_SHOW = 'inset(-30% -4% -30% -4%)';
  gsap.set(tagLines, { opacity: 0, y: 12, clipPath: CLIP_HIDE });
  function showMark(delay = 0) {
    gsap.to(markObj, { v: 1, duration: REDUCE ? 0.4 : 2.2, delay, ease: 'power2.inOut', onUpdate: markApply, overwrite: true });
    gsap.to(tagLines, { opacity: 1, y: 0, clipPath: CLIP_SHOW, duration: REDUCE ? 0.4 : 1.3, ease: 'expo.out', stagger: 0.18, delay: delay + (REDUCE ? 0.1 : 1.25), overwrite: true });
  }
  function hideMark() {
    gsap.to(markObj, { v: 0, duration: 0.6, ease: 'power3.in', onUpdate: markApply, overwrite: true });
    gsap.to(tagLines, {
      opacity: 0, y: -8, duration: 0.45, ease: 'power2.in', stagger: 0.05, overwrite: true,
      onComplete: () => { gsap.set(tagLines, { y: 12, clipPath: CLIP_HIDE }); },
    });
  }

  /* ---------- state machine ---------- */
  let state = 0, introDone = false;
  const lensGate = { v: 0 };
  const camTweenTo = (i: number, dur: number) => {
    const c = CAMS[i];
    gsap.to(cam, { px: c.p[0], py: c.p[1], pz: c.p[2], tx: c.t[0], ty: c.t[1], tz: c.t[2], fov: c.fov, par: i === 2 ? 0.35 : 1, duration: REDUCE ? 0.6 : dur, ease: 'power3.inOut', overwrite: 'auto' });
  };
  const tmpS = new THREE.Vector3();
  function screenOf(v: THREE.Vector3) { tmpS.copy(v).project(camera); return { x: (tmpS.x * 0.5 + 0.5) * SW, y: (-tmpS.y * 0.5 + 0.5) * SH }; }

  function go(next: number, origin?: { x: number; y: number }) {
    if (!introDone || next === state) return;
    const prev = state; state = next;
    gsap.killTweensOf(lensGate);
    gsap.to(lensGate, { v: 0, duration: 0.25, onUpdate: ringShow });
    gsap.to(lensGate, { v: 1, duration: 0.6, delay: REDUCE ? 0.5 : 2.0, onStart: ringShow, onUpdate: ringShow });
    if (prev === 0) hideMark();
    if (next === 0) showMark(REDUCE ? 0.4 : 1.7);
    camTweenTo(next, next === 2 || prev === 2 ? 2.6 : 2.0);
    const dmul = REDUCE ? 0 : 1, tmul = REDUCE ? 0.4 : 1;
    const ox = origin ? origin.x : SW / 2, oy = origin ? origin.y : SH / 2;

    parts.forEach(p => {
      const s = screenOf(p.lay > 0.5 ? p.L : p.A);
      const ripple = Math.hypot(s.x - ox, s.y - oy) / SW;
      const order = p.layIdx / N;
      if (prev !== 2 && next !== 2) {
        const toW = next === 1 ? 1 : 0;
        gsap.to(p, {
          w: toW, duration: (next === 1 ? 1.6 : 1.25) * tmul, delay: ripple * 0.9 * dmul,
          ease: next === 1 ? 'expo.out' : 'expo.inOut', overwrite: 'auto',
          onComplete: toW === 0 ? () => { p.flash = 1; } : undefined,
        });
      } else if (next === 2) {
        gsap.to(p, {
          lay: 1, duration: 1.5 * tmul, delay: (order * 1.1 + ripple * 0.25) * dmul, ease: 'power3.inOut', overwrite: 'auto',
          onComplete: () => { p.flash = 0.7; p.w = 0; },
        });
      } else {
        if (next === 1) p.w = 1;
        gsap.to(p, {
          lay: 0, duration: 1.5 * tmul, delay: ((1 - order) * 1.1) * dmul, ease: 'power3.inOut', overwrite: 'auto',
          onComplete: next === 0 ? () => { p.flash = 1; } : undefined,
        });
      }
    });
  }
  // laydown order index (by trade, then by row position)
  parts.slice().sort((a, b) => (a.L.z - b.L.z) || (a.L.x - b.L.x)).forEach((p, i) => p.layIdx = i);

  /* ---------- intro: assemble from the outside in ---------- */
  const INTRO_W = 2.6;
  const ORDER: Record<string, number> = { beam: 0, rod: 1, trapeze: 2, duct: 3, round: 3, refrig: 3.4, pipe: 4, valve: 4.6, drop: 4.5, tray: 5, cable: 5.4, trunk: 5.2, sprMain: 5.3, spr: 5.8, flange: 6.2, roundc: 6.2, coupling: 6.4 };
  function intro() {
    const spark = el.spark;
    if (REDUCE) {
      parts.forEach(p => { p.on = true; p.w = 0; p.mesh.visible = true; });
      cam.px = CAMS[0].p[0]; cam.py = CAMS[0].p[1]; cam.pz = CAMS[0].p[2];
      introDone = true; lensGate.v = 1; ringShow(); showMark(0.2); return;
    }
    gsap.timeline()
      .to(spark, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' })
      .to(spark, { scale: 2.6, duration: 0.18, ease: 'power2.in' })
      .to(spark, { scale: 0, opacity: 0, duration: 0.5, ease: 'expo.out' });
    camTweenTo(0, 6.5);
    let maxEnd = 0;
    parts.forEach(p => {
      p.w = INTRO_W;
      const o = ORDER[p.group];
      const sweep = (p.group === 'rod' || p.group === 'trapeze' || p.group === 'beam') ? Math.abs(p.inX) / 13 : (p.inX + 13) / 26;
      const isFit = o >= 6;
      const delay = 0.45 + o * 0.48 + sweep * (isFit ? 0.6 : 0.85) + rr(0, 0.12);
      const dur = isFit ? 0.55 : 1.15;
      maxEnd = Math.max(maxEnd, delay + dur);
      gsap.to(p, {
        w: 0, duration: dur, delay, ease: isFit ? 'back.out(2.2)' : 'expo.out',
        onStart: () => { p.on = true; p.mesh.visible = true; },
        onComplete: () => { p.flash = isFit ? 1 : 0.8; },
      });
    });
    calls.push(gsap.delayedCall(maxEnd - 0.3, () => showMark(0)));
    calls.push(gsap.delayedCall(maxEnd + 0.4, () => { introDone = true; gsap.to(lensGate, { v: 1, duration: 0.8, onStart: ringShow, onUpdate: ringShow }); }));
  }

  /* ---------- frame loop ---------- */
  const tq = new THREE.Quaternion(), te = new THREE.Euler(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), camR = new THREE.Vector3(), camU = new THREE.Vector3(), camF = new THREE.Vector3();
  const UP = V(0, 1, 0);
  let last = performance.now(), T = 0;
  const R0 = 0.115; // lens radius as a share of stage width

  function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    const L2 = vx * vx + vy * vy; let t = L2 > 0 ? (wx * vx + wy * vy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const dx = ax + vx * t - px, dy = ay + vy * t - py; return Math.sqrt(dx * dx + dy * dy);
  }

  let perfN = 0, perfSum = 0;
  let raf = 0, visible = true;
  function frame(now: number) {
    raf = visible ? requestAnimationFrame(frame) : 0;
    const rawDt = now - last;
    const dt = Math.min(0.033, rawDt / 1000); last = now; T += dt;
    // adaptive resolution: drop render scale if frames run long
    if (introDone && rawDt < 250) { perfSum += rawDt; if (++perfN === 90) { if (perfSum / perfN > 21 && QUALITY > 0.55) { QUALITY *= 0.8; resize(); } perfN = 0; perfSum = 0; } }

    // camera with parallax and slow drift
    const ease = 1 - Math.exp(-dt * 3.2);
    ptr.sx += ((ptr.in ? ptr.nx : 0) - ptr.sx) * ease;
    ptr.sy += ((ptr.in ? ptr.ny : 0) - ptr.sy) * ease;
    camTgt.set(cam.tx, cam.ty, cam.tz);
    camPos.set(cam.px, cam.py, cam.pz);
    camF.subVectors(camTgt, camPos).normalize();
    camR.crossVectors(camF, UP).normalize();
    camU.crossVectors(camR, camF).normalize();
    const drift = REDUCE ? 0 : 1;
    camPos.addScaledVector(camR, (ptr.sx * 1.6 + Math.sin(T * 0.11) * 0.6 * drift) * cam.par);
    camPos.addScaledVector(camU, (-ptr.sy * 0.9 + Math.sin(T * 0.07 + 1.3) * 0.3 * drift) * cam.par);
    camTgt.addScaledVector(camR, ptr.sx * 0.35 * cam.par);
    camera.position.copy(camPos); camera.lookAt(camTgt);
    if (Math.abs(camera.fov - cam.fov) > 1e-3) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    const dist = camPos.distanceTo(camTgt);
    mOutline.uniforms.uFogN.value = dist * 0.8; mOutline.uniforms.uFogF.value = dist * 1.65;

    // lens
    const R = R0 * SW * (state === 2 ? 0.3 : (state === 1 ? 0.8 : 1)) * (1 + Math.min(0.35, Math.hypot(ptr.vx, ptr.vy) * 0.08));
    const lensMode = state;
    const lensSign = lensMode === 0 ? 0.62 : (lensMode === 1 ? -1.0 : 0);
    const active = ptr.in && lensGate.v > 0.01;

    for (let i = 0; i < N; i++) {
      const p = parts[i];
      if (!p.on) continue;
      // lens target from the part's long axis in screen space
      let target = 0;
      if (active) {
        const useL = p.lay > 0.5;
        const a = screenOf(useL ? p.l0 : p.e0), b = screenOf(useL ? p.l1 : p.e1);
        const d = segDist(ptr.x, ptr.y, a.x, a.y, b.x, b.y);
        const f = 1 - Math.min(1, Math.max(0, (d - R * 0.2) / (R * 0.8)));
        target = f * f * (3 - 2 * f) * lensGate.v;
      }
      const acc = 150 * (target - p.lens) - 15 * p.lensV;
      p.lensV += acc * dt; p.lens += p.lensV * dt;
      // flash when a part lands back in place
      if (lensMode === 0) { if (p.lens > 0.3) p.armed = true; else if (p.armed && p.lens < 0.05) { p.armed = false; p.flash = Math.max(p.flash, 0.75); } }
      else if (lensMode === 1) { if (p.lens > 0.85 && !p.armed) { p.armed = true; p.flash = Math.max(p.flash, 0.75); } else if (p.lens < 0.3) p.armed = false; }

      const lensW = lensSign * p.lens * (1 - p.lay);
      const w = p.w + lensW;
      tv.copy(p.A).lerp(p.E, w);
      const pull = lensMode === 0 ? p.lens * (1 - p.lay) : 0;
      if (pull > 0.0005) { tv2.subVectors(camPos, p.A).normalize(); tv.addScaledVector(tv2, pull * 1.25); }
      const wr = w + pull * 3.2;
      te.set(p.rot.x * wr, p.rot.y * wr, p.rot.z * wr); tq.setFromEuler(te);
      p.mesh.quaternion.copy(p.qA).multiply(tq);
      const wc = Math.max(0, Math.min(1, w));
      if (!REDUCE) tv.y += Math.sin(T * 0.9 + p.ph) * 0.05 * wc * (1 - p.lay);
      if (p.lay > 0) {
        const l = p.lay;
        tv.lerp(p.L, l);
        tv.y += Math.sin(Math.PI * l) * 2.2;
        p.mesh.quaternion.slerp(p.qL, l);
        tv.y += 0.42 * (lensMode === 2 ? p.lens : 0) * l;
      }
      p.mesh.position.copy(tv);

      p.flash *= Math.exp(-dt * 3.2);
      const liftBlue = lensMode === 2 ? p.lens * p.lay : 0;
      const blue = Math.min(1, Math.max(wc * 0.82, Math.sin(Math.PI * p.lay) * 0.95, liftBlue, pull * 1.1, w > 1 ? 1 : 0));
      p.mat.uniforms.uBlue.value = blue;
      p.mat.uniforms.uEmph.value = Math.min(1, p.base + p.flash * 0.5);
    }

    // render: normals + depth, then outline, glow, finish
    const rt = RT!;
    renderer.setRenderTarget(rt.n); renderer.render(scene, camera);
    mOutline.uniforms.tN.value = rt.n.texture; mOutline.uniforms.tD.value = rt.n.depthTexture;
    pass(mOutline, rt.c);
    mDown.uniforms.tS.value = rt.c.texture; mDown.uniforms.uTexel.value.set(1 / PW, 1 / PH); pass(mDown, rt.g1a);
    mBlur.uniforms.tS.value = rt.g1a.texture; mBlur.uniforms.uDir.value.set(1 / rt.g1a.width, 0); pass(mBlur, rt.g1b);
    mBlur.uniforms.tS.value = rt.g1b.texture; mBlur.uniforms.uDir.value.set(0, 1 / rt.g1a.height); pass(mBlur, rt.g1a);
    mCopy.uniforms.tS.value = rt.g1a.texture; pass(mCopy, rt.g2a);
    mBlur.uniforms.tS.value = rt.g2a.texture; mBlur.uniforms.uDir.value.set(1.6 / rt.g2a.width, 0); pass(mBlur, rt.g2b);
    mBlur.uniforms.tS.value = rt.g2b.texture; mBlur.uniforms.uDir.value.set(0, 1.6 / rt.g2a.height); pass(mBlur, rt.g2a);
    mFinal.uniforms.tC.value = rt.c.texture; mFinal.uniforms.tB1.value = rt.g1a.texture; mFinal.uniforms.tB2.value = rt.g2a.texture;
    mFinal.uniforms.uTime.value = T;
    pass(mFinal, null);
  }

  // Only render while the hero is on screen.
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(stage);

  /* ---------- go ---------- */
  const fontsReady = document.fonts
    ? Promise.race([document.fonts.load(`800 100px ${el.fontFamily}`), new Promise(r => setTimeout(r, 1500))])
    : Promise.resolve();
  raf = requestAnimationFrame(frame);
  let disposed = false;
  fontsReady.then(() => { if (!disposed) intro(); });

  return () => {
    disposed = true;
    ac.abort();
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    calls.forEach(c => c.kill());
    gsap.killTweensOf([cam, markObj, lensGate, ...parts, ...tagLines, el.spark, cursorEl, ringEl, crossEl]);
    parts.forEach(p => { p.mesh.geometry.dispose(); p.mat.dispose(); });
    [partMat, mOutline, mDown, mCopy, mBlur, mFinal].forEach(m => m.dispose());
    quad.geometry.dispose();
    if (RT) Object.values(RT).forEach(t => { t.depthTexture?.dispose(); t.dispose(); });
    renderer.dispose();
  };
}
