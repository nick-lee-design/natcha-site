'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { View } from '@/lib/beta/building';
import type { Box, Element, Model } from '@/lib/beta/model';

export type Tone = 'base' | 'focus' | 'alert' | 'warn' | 'ok' | 'info' | 'ghost' | 'hidden';
export type Overlay = { box: Box; colour: string; dashed?: boolean };
export type Pin = { id: string; at: [number, number, number]; label: string; tone?: 'alert' | 'warn' | 'ok' | 'info'; onClick?: () => void };

export type ModelHandle = { getView(): View; setView(v: View): void };
export type Frame = { ids?: number[]; box?: Box };

type Props = {
  model: Model;
  tones?: Map<number, Tone>;
  rest?: Tone; // for elements not in `tones`
  colourOf?: (e: Element) => string | null; // overrides the layer colour
  frame?: Frame | null; // flies here whenever frameKey changes
  frameKey?: string;
  overlays?: Overlay[];
  pins?: Pin[];
  selected?: number | null;
  onPick?: (i: number | null) => void;
  className?: string;
};

const LAYER: Record<string, string> = {
  'A-WALL': '#6B7480', 'I-WALL': '#8C8678', 'M-HVAC-DUCT': '#4C8FD6', 'P-PIPE': '#3FAE6A', 'E-CABL-TRAY': '#E08A2E',
  'E-LITE': '#D9B21A', 'E-LITE-EQPM': '#C9A227', 'E-ELEC-FIXT': '#B39DDB', 'Q-SPCQ': '#7A7F87',
};
const TONE: Partial<Record<Tone, string>> = { alert: '#FF5A5F', warn: '#FFB224', ok: '#46C37B', info: '#8EC5FF' };
const SELECTED = '#F4F1EA';

// Geometry is built once per model and shared by every view of it
const built = new WeakMap<Model, THREE.BufferGeometry[]>();
function geometries(model: Model) {
  let g = built.get(model);
  if (g) return g;
  const { origin: O, centre: C, step, pos: P, idx } = model;
  g = model.elements.map((d) => {
    const pos = new Float32Array(d.vc * 3);
    for (let k = 0; k < d.vc; k++) {
      const p = (d.vo + k) * 3;
      for (let ax = 0; ax < 3; ax++) pos[k * 3 + ax] = (P[p + ax] * step + O[ax] - C[ax]) / 1000;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx.slice(d.io, d.io + d.ic), 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  });
  built.set(model, g);
  return g;
}

const ModelView = forwardRef<ModelHandle, Props>(function ModelView(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const pinLayer = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;
  const api = useRef<{
    paint(): void; fly(to: Frame): void; overlays(o: Overlay[]): void;
    getView(): View; setView(v: View): void;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    getView: () => api.current!.getView(),
    setView: (v) => api.current?.setView(v),
  }), []);

  useEffect(() => {
    const el = host.current!;
    const { model } = live.current;
    const C = model.centre;
    const toW = (v: number, ax: number) => (v - C[ax]) / 1000;
    const boxW = (b: Box) => new THREE.Box3(new THREE.Vector3(toW(b[0], 0), toW(b[1], 1), toW(b[2], 2)), new THREE.Vector3(toW(b[3], 0), toW(b[4], 1), toW(b[5], 2)));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 1, 0.01, 400);
    cam.up.set(0, 0, 1);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4250, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(0.5, -0.9, 1.2); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-0.7, 0.6, -0.4); scene.add(fill);

    const mats = new Map<string, THREE.Material>();
    const mat = (colour: string, tone: Tone, wall: boolean) => {
      const key = `${colour}|${tone}|${wall}`;
      let m = mats.get(key);
      if (m) return m;
      const ghost = tone === 'ghost';
      const opacity = ghost ? (wall ? 0.035 : 0.07) : wall && tone === 'base' ? 0.13 : 1;
      const lit = tone !== 'base' && tone !== 'ghost';
      m = new THREE.MeshPhongMaterial({
        color: colour, flatShading: true, shininess: 14, side: THREE.DoubleSide,
        transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
        emissive: lit ? new THREE.Color(colour).multiplyScalar(0.45) : new THREE.Color(0),
      });
      mats.set(key, m);
      return m;
    };

    const geos = geometries(model);
    const meshes = model.elements.map((d, k) => {
      const m = new THREE.Mesh(geos[k]);
      m.userData.i = d.i;
      if (d.g === 'WALL') m.renderOrder = 2;
      scene.add(m);
      return m;
    });

    function paint() {
      const { tones, rest = 'base', colourOf, selected } = live.current;
      for (const d of model.elements) {
        const m = meshes[d.i];
        const wall = d.g === 'WALL';
        let tone: Tone = tones?.get(d.i) ?? (wall && rest !== 'hidden' ? 'base' : rest);
        if (selected === d.i) tone = 'focus';
        m.visible = tone !== 'hidden';
        const colour = selected === d.i ? SELECTED : TONE[tone] ?? colourOf?.(d) ?? LAYER[model.layers[d.l]] ?? '#888';
        m.material = mat(colour, tone, wall);
      }
    }

    const extras = new THREE.Group();
    scene.add(extras);
    function overlays(list: Overlay[]) {
      for (const c of [...extras.children]) {
        extras.remove(c);
        (c as THREE.Mesh).geometry.dispose();
        ((c as THREE.Mesh).material as THREE.Material).dispose();
      }
      for (const o of list) {
        const b = boxW(o.box);
        const size = b.getSize(new THREE.Vector3());
        const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
        const fillM = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: o.colour, transparent: true, opacity: 0.16, depthWrite: false }));
        fillM.position.copy(b.getCenter(new THREE.Vector3()));
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
          o.dashed ? new THREE.LineDashedMaterial({ color: o.colour, dashSize: 0.04, gapSize: 0.03 }) : new THREE.LineBasicMaterial({ color: o.colour }));
        edges.position.copy(fillM.position);
        if (o.dashed) edges.computeLineDistances();
        extras.add(fillM, edges);
      }
    }

    /* camera */
    const DIR = new THREE.Vector3(0.45, -0.95, 0.85).normalize();
    function viewFor(box: THREE.Box3, dir = DIR) {
      const c = box.getCenter(new THREE.Vector3());
      const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.35);
      const aspect = (el.clientWidth || 1) / (el.clientHeight || 1);
      const fov = THREE.MathUtils.degToRad(cam.fov / 2);
      const dist = r / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * aspect))) * 1.1;
      return { pos: c.clone().add(dir.clone().multiplyScalar(dist)), target: c };
    }
    let tween: { from: View; to: View; t0: number } | null = null;
    const toView = (v: { pos: THREE.Vector3; target: THREE.Vector3 }): View => ({ pos: v.pos.toArray() as View['pos'], target: v.target.toArray() as View['target'] });
    const current = (): View => toView({ pos: cam.position, target: controls.target });
    function setView(v: View) { tween = { from: current(), to: v, t0: performance.now() }; }
    function fly(to: Frame) {
      const box = to.box ? boxW(to.box) : new THREE.Box3();
      for (const i of to.ids ?? []) box.union(boxW(model.elements[i].b));
      if (box.isEmpty()) return;
      const dir = cam.position.clone().sub(controls.target).normalize();
      setView(toView(viewFor(box, dir.lengthSq() ? dir.lerp(DIR, 0.5).normalize() : DIR)));
    }
    const all = boxW([...model.bmin, ...model.bmax] as Box);
    const start = viewFor(all);
    cam.position.copy(start.pos);
    controls.target.copy(start.target);

    function resize() {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    /* picking and hover */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function hit(ev: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const pickable = meshes.filter((m) => m.visible && model.elements[m.userData.i].g !== 'WALL' && (m.material as THREE.Material).opacity > 0.5);
      return ray.intersectObjects(pickable, false)[0]?.object.userData.i as number | undefined;
    }
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      down = null;
      live.current.onPick?.(hit(e) ?? null);
    };
    let hoverEv: PointerEvent | null = null;
    const onMove = (e: PointerEvent) => { hoverEv = e; };
    const onLeave = () => { hoverEv = null; if (tip.current) tip.current.hidden = true; };
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', onLeave);

    /* loop */
    const v = new THREE.Vector3();
    let raf = 0;
    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      if (tween) {
        const t = Math.min(1, (now - tween.t0) / 700);
        const k = 1 - Math.pow(1 - t, 3);
        cam.position.fromArray(tween.from.pos).lerp(v.fromArray(tween.to.pos), k);
        controls.target.fromArray(tween.from.target).lerp(v.fromArray(tween.to.target), k);
        if (t === 1) tween = null;
      }
      controls.update();
      renderer.render(scene, cam);
      // Pins follow their anchor on screen
      const w = el.clientWidth, h = el.clientHeight;
      for (const p of pinLayer.current?.children ?? []) {
        const n = p as HTMLElement;
        v.set(toW(+n.dataset.x!, 0), toW(+n.dataset.y!, 1), toW(+n.dataset.z!, 2)).project(cam);
        n.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
        n.style.visibility = v.z < 1 ? 'visible' : 'hidden';
      }
      if (hoverEv && tip.current) {
        const i = hit(hoverEv);
        const r = el.getBoundingClientRect();
        cv.style.cursor = i === undefined ? '' : 'pointer';
        tip.current.hidden = i === undefined;
        if (i !== undefined) {
          const d = model.elements[i];
          tip.current.textContent = `${d.m} · ${d.c}`;
          tip.current.style.transform = `translate(${hoverEv.clientX - r.left + 14}px, ${hoverEv.clientY - r.top + 14}px)`;
        }
        hoverEv = null;
      }
    }
    raf = requestAnimationFrame(loop);

    api.current = { paint, fly, overlays, getView: current, setView };
    paint();
    overlays(live.current.overlays ?? []);
    if (live.current.frame) fly(live.current.frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerleave', onLeave);
      overlays([]);
      for (const m of mats.values()) m.dispose();
      renderer.dispose();
      cv.remove();
      api.current = null;
    };
  }, [props.model]);

  useEffect(() => { api.current?.paint(); }, [props.tones, props.rest, props.colourOf, props.selected]);
  useEffect(() => { api.current?.overlays(props.overlays ?? []); }, [props.overlays]);
  useEffect(() => { if (props.frame) api.current?.fly(props.frame); }, [props.frameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={host} className={`mv ${props.className ?? ''}`}>
      <div ref={pinLayer} className="mv-pins">
        {props.pins?.map((p) => (
          <button key={p.id} type="button" className={`mv-pin is-${p.tone ?? 'info'}`} data-x={p.at[0]} data-y={p.at[1]} data-z={p.at[2]} onClick={p.onClick}>
            {p.label}
          </button>
        ))}
      </div>
      <div ref={tip} className="mv-tip" hidden />
    </div>
  );
});

export default ModelView;
