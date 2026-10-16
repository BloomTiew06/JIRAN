import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Site } from '../api.ts';

/**
 * A toy-like 3D model of one Adira street, built from the real site-plan
 * coordinates (1 unit = 1 foot). Both sides of your street are modelled as
 * double-storey terraces; the rows behind are simpler blocks for context.
 */

export type Lot = Site['lots'][number];
type Road = Site['roads'][number];

const INK = '#2B2340';
const WALLS = ['#FFF8EE', '#FBF1E2', '#F7EEE4', '#FFF4E6'];
const CAR = ['#5B6EE1', '#E8452C', '#9AA0AE', '#F4F4F4', '#2B2340', '#2FA59A'];
const GLASS = '#A9D8F0';
const UNJOINED_ROOF = '#B9AA99';
const VACANT_ROOF = '#D9D2C7';

export interface StreetModel {
  street: string;
  road: Road;
  lots: Lot[];
  backLots: Lot[];
  me: Lot;
  bounds: { x0: number; x1: number; z0: number; z1: number };
}

/** Pick your street segment: both sides of the road, in your column of the site plan. */
export function streetModel(site: Site): StreetModel | null {
  const me = site.lots.find((l) => l.id === site.myUnitId);
  if (!me) return null;
  const road = site.roads.find((r) => r.name === me.street && !r.vertical);
  if (!road) return null;
  const west = me.x < 240;
  const inCol = (l: Lot) => (west ? l.x < 240 : l.x >= 240);
  const lots = site.lots.filter((l) => l.street === me.street && inCol(l));
  const ids = new Set(lots.map((l) => l.id));
  const backLots = site.lots.filter((l) => inCol(l) && !ids.has(l.id) && l.y > road.y - 160 && l.y < road.y + road.h + 85);
  const xs = lots.map((l) => [l.x, l.x + l.w]).flat();
  return { street: me.street, road, lots, backLots, me, bounds: { x0: Math.min(...xs) - 30, x1: Math.max(...xs) + 30, z0: road.y - 170, z1: road.y + road.h + 170 } };
}

// ------------------------------------------------------------------ materials

function toonRamp() {
  const data = new Uint8Array([90, 170, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

class Kit {
  ramp = toonRamp();
  mats = new Map<string, THREE.Material>();
  geos = new Map<string, THREE.BufferGeometry>();
  edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.5 });
  edgeGeos = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();

  edges(geo: THREE.BufferGeometry) {
    let e = this.edgeGeos.get(geo);
    if (!e) { e = new THREE.EdgesGeometry(geo, 30); this.edgeGeos.set(geo, e); }
    return e;
  }


  mat(color: string, opts: { glow?: boolean; opacity?: number } = {}) {
    const key = `${color}|${opts.glow ? 1 : 0}|${opts.opacity ?? 1}`;
    let m = this.mats.get(key);
    if (!m) {
      m = opts.glow
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshToonMaterial({ color, gradientMap: this.ramp, transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1 });
      this.mats.set(key, m);
    }
    return m;
  }

  box(w: number, h: number, d: number) {
    const key = `box|${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`;
    let g = this.geos.get(key);
    if (!g) { g = new THREE.BoxGeometry(w, h, d); this.geos.set(key, g); }
    return g;
  }

  /** Gable roof: ridge runs along x (parallel to the street), slopes front and back. */
  roof(len: number, base: number, height: number) {
    const key = `roof|${len}|${base}|${height}`;
    let g = this.geos.get(key);
    if (!g) {
      const s = new THREE.Shape();
      s.moveTo(-base / 2, 0); s.lineTo(base / 2, 0); s.lineTo(0, height); s.closePath();
      g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
      g.translate(0, 0, -len / 2);
      g.rotateY(Math.PI / 2);
      this.geos.set(key, g);
    }
    return g;
  }

  dispose() {
    for (const m of this.mats.values()) m.dispose();
    for (const g of this.geos.values()) g.dispose();
    for (const g of this.edgeGeos.values()) g.dispose();
    this.ramp.dispose();
    this.edgeMat.dispose();
  }
}

function mesh(kit: Kit, geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, opts: { edges?: boolean; shadow?: boolean; glow?: boolean } = {}) {
  const m = new THREE.Mesh(geo, kit.mat(color, { glow: opts.glow }));
  m.position.set(x, y, z);
  if (opts.shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
  if (opts.edges) {
    const e = new THREE.LineSegments(kit.edges(geo), kit.edgeMat);
    m.add(e);
  }
  return m;
}

// ------------------------------------------------------------------ house

function house(kit: Kit, l: Lot, detailed: boolean, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.userData.lotId = l.id;
  const r = l.resident;
  const north = l.faces === 'north';
  const w = l.w - 0.4;
  const cx = l.x + l.w / 2;
  const depth = 49;
  const z0 = north ? l.y + 18 : l.y + 8; // body from z0 to z0 + depth
  const toFront = north ? -1 : 1;
  const frontZ = north ? z0 : z0 + depth;
  const wall = WALLS[seed % WALLS.length];
  const roofColor = r ? r.houseColor : l.occupied ? UNJOINED_ROOF : VACANT_ROOF;

  // Ground floor, first floor set back from the front, gable roof.
  g.add(mesh(kit, kit.box(w, 11, depth), wall, cx, 5.5, z0 + depth / 2, { edges: true }));
  g.add(mesh(kit, kit.box(w, 10, depth - 4), wall, cx, 16, z0 + depth / 2 - toFront * 2, { edges: true }));
  const roof = mesh(kit, kit.roof(w + 0.6, depth + 1, 8), roofColor, cx, 21, z0 + depth / 2 - toFront * 2, { edges: true });
  g.add(roof);
  if (!detailed) return g;

  const face = frontZ + toFront * 0.06;
  const faceUp = frontZ - toFront * 2 + toFront * 0.06;
  const plane = (pw: number, ph: number, color: string, x: number, y: number, z: number, glow = false) => {
    const p = mesh(kit, kit.box(pw, ph, 0.12), color, x, y, z, { shadow: false, glow });
    return p;
  };
  // Door, ground-floor window and two upstairs windows with sills.
  g.add(plane(3.4, 7, '#8A5A3C', l.x + 3.6, 3.6, face));
  g.add(plane(w - 9, 5, GLASS, cx + 2.2, 5, face));
  g.add(plane(5.2, 4.4, GLASS, l.x + 5, 16.5, faceUp));
  g.add(plane(5.2, 4.4, GLASS, l.x + l.w - 5, 16.5, faceUp));
  g.add(mesh(kit, kit.box(w - 1, 3, 0.25), '#ECE6DA', cx, 12.8, frontZ - toFront * 2 + toFront * 2.4, { shadow: false }));

  // Car porch canopy on two slim posts, porch floor and the front gate.
  const porchMid = frontZ + toFront * 9;
  g.add(mesh(kit, kit.box(w, 0.8, 9), '#F2ECE0', cx, 10.6, frontZ + toFront * 4.5, { edges: true }));
  g.add(mesh(kit, kit.box(0.6, 10.4, 0.6), '#4B4458', l.x + 1, 5.2, frontZ + toFront * 8.6));
  g.add(mesh(kit, kit.box(0.6, 10.4, 0.6), '#4B4458', l.x + l.w - 1, 5.2, frontZ + toFront * 8.6));
  g.add(mesh(kit, kit.box(l.w - 0.2, 0.2, 18), '#DCD5C9', cx, 0.1, porchMid, { shadow: false }));
  const gateZ = frontZ + toFront * 17.8;
  g.add(mesh(kit, kit.box(l.w - 0.4, 2.4, 0.25), '#6B6478', cx, 1.2, gateZ, { edges: true }));

  // A car in most occupied porches.
  if (l.occupied && seed % 3 !== 0) {
    const car = new THREE.Group();
    const c = CAR[seed % CAR.length];
    car.add(mesh(kit, kit.box(6.2, 2.4, 14), c, 0, 1.9, 0, { edges: true }));
    car.add(mesh(kit, kit.box(5.6, 2, 7.5), c, 0, 4, toFront * -0.8, { edges: true }));
    car.add(mesh(kit, kit.box(5.7, 1.5, 7.6), GLASS, 0, 4.1, toFront * -0.8, { shadow: false }));
    for (const [dx, dz] of [[-3, -4.5], [3, -4.5], [-3, 4.5], [3, 4.5]]) car.add(mesh(kit, kit.box(0.8, 2, 2), '#2B2340', dx, 1, dz));
    car.position.set(cx + (seed % 2 ? 2 : -2), 0, porchMid);
    g.add(car);
  }

  // Decorations the resident has switched on.
  const d = r?.decor;
  if (d?.plants) {
    for (const px of [l.x + 1.6, l.x + l.w - 1.6]) {
      g.add(mesh(kit, new THREE.CylinderGeometry(0.9, 0.7, 1.6, 10), '#C98A55', px, 0.8, frontZ + toFront * 1.5));
      g.add(mesh(kit, new THREE.IcosahedronGeometry(1.4, 0), '#4FAE66', px, 2.6, frontZ + toFront * 1.5));
    }
  }
  if (d?.lights) {
    for (let i = 0; i < 8; i++) {
      const bulb = mesh(kit, new THREE.SphereGeometry(0.35, 8, 6), ['#FFC94A', '#FF7FA3', '#9ED9F1'][i % 3], l.x + 1 + (i * (l.w - 2)) / 7, 10 - Math.sin((i / 7) * Math.PI) * 1.2, frontZ + toFront * 9, { glow: true, shadow: false });
      g.add(bulb);
    }
  }
  if (d?.bunting) {
    for (let i = 0; i < 6; i++) {
      const flag = mesh(kit, new THREE.ConeGeometry(0.8, 1.6, 3), ['#E8452C', '#FFC94A', '#2FA59A', '#8B5CF6'][i % 4], l.x + 2 + (i * (l.w - 4)) / 5, 19.4, faceUp + toFront * 0.4, { shadow: false });
      flag.rotation.x = Math.PI;
      g.add(flag);
    }
  }
  if (d?.porchCat) {
    g.add(mesh(kit, kit.box(1.4, 1.2, 2.2), '#F29A38', l.x + l.w - 3, 0.7, frontZ + toFront * 2));
    g.add(mesh(kit, new THREE.SphereGeometry(0.8, 10, 8), '#F29A38', l.x + l.w - 3, 1.7, frontZ + toFront * 2.9));
  }
  if (d?.festive) {
    // Deepavali: a kolam on the porch floor and a row of pelita lamps along the gate.
    const kolam = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.7, 20), kit.mat('#E8452C', { glow: true }));
    kolam.rotation.x = -Math.PI / 2;
    kolam.position.set(l.x + 4.5, 0.25, frontZ + toFront * 14.5);
    g.add(kolam);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.1, 18), kit.mat('#FFC94A', { glow: true }));
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(l.x + 4.5, 0.27, frontZ + toFront * 14.5);
    g.add(inner);
    for (let i = 0; i < 5; i++) g.add(mesh(kit, new THREE.SphereGeometry(0.45, 8, 6), '#FFB020', l.x + 2 + i * ((l.w - 4) / 4), 3.6, gateZ, { glow: true, shadow: false }));
  }
  if (r?.isNew) {
    // A big ribbon bow on the gate for new arrivals.
    const bow = mesh(kit, new THREE.TorusGeometry(1.4, 0.45, 8, 16), '#FFC94A', cx, 4.6, gateZ + toFront * 0.4, { edges: false });
    g.add(bow);
  }
  return g;
}

function tree(kit: Kit, x: number, z: number, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(kit, kit.box(0.9 * s, 7 * s, 0.9 * s), '#A86B3C', x, 3.5 * s, z));
  const top = mesh(kit, new THREE.IcosahedronGeometry(4.4 * s, 0), s > 1 ? '#4FAE66' : '#5DBB72', x, 9.4 * s, z, { edges: true });
  g.add(top);
  return g;
}

function lamp(kit: Kit, x: number, z: number) {
  const g = new THREE.Group();
  g.add(mesh(kit, kit.box(0.5, 14, 0.5), '#4B4458', x, 7, z));
  g.add(mesh(kit, new THREE.SphereGeometry(0.9, 10, 8), '#FFE08A', x, 14.4, z, { glow: true, shadow: false }));
  return g;
}

// ------------------------------------------------------------------ scene

export interface StreetScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  houses: Map<string, THREE.Group>;
  rebuild: (site: Site) => void;
  home: (animate?: boolean) => void;
  pick: (clientX: number, clientY: number) => string | null;
  project: (x: number, y: number, z: number) => { x: number; y: number; visible: boolean };
  resize: (w: number, h: number) => void;
  dispose: () => void;
  model: StreetModel;
  atMaxDistance: () => boolean;
}

export function createStreetScene(canvasHost: HTMLElement, site: Site, onChange: () => void, reducedMotion: boolean): StreetScene | null {
  const model0 = streetModel(site);
  if (!model0) return null;
  let model = model0;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#CFE8FF');
  scene.fog = new THREE.Fog('#CFE8FF', 420, 1100);
  const camera = new THREE.PerspectiveCamera(44, 1, 1, 3000);

  scene.add(new THREE.HemisphereLight('#FFFFFF', '#9CCB8E', 1.25));
  const sun = new THREE.DirectionalLight('#FFF4DC', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const kit = new Kit();
  const world = new THREE.Group();
  scene.add(world);
  const houses = new Map<string, THREE.Group>();

  const build = (s: Site) => {
    const m = streetModel(s);
    if (!m) return;
    model = m;
    const shared = new Set<THREE.BufferGeometry>([...kit.geos.values(), ...kit.edgeGeos.values()]);
    for (const c of [...world.children]) {
      c.traverse((o) => {
        const geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        if (geo && !shared.has(geo)) geo.dispose();
      });
      world.remove(c);
    }
    houses.clear();

    const { road, bounds } = m;
    const midX = (bounds.x0 + bounds.x1) / 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), kit.mat('#BFE6B1'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(midX, 0, road.y + road.h / 2);
    ground.receiveShadow = true;
    world.add(ground);

    // Road with kerbs, 5 ft walkways and a dashed centre line.
    const roadLen = bounds.x1 - bounds.x0 + 160;
    const asphalt = new THREE.Mesh(kit.box(roadLen, 0.3, road.h - 10), kit.mat('#8E899B'));
    asphalt.position.set(midX, 0.15, road.y + road.h / 2);
    asphalt.receiveShadow = true;
    world.add(asphalt);
    for (const side of [road.y + 2.5, road.y + road.h - 2.5]) {
      const walk = new THREE.Mesh(kit.box(roadLen, 0.7, 5), kit.mat('#EFE8DA'));
      walk.position.set(midX, 0.35, side);
      walk.receiveShadow = true;
      world.add(walk);
    }
    for (let x = bounds.x0 - 70; x < bounds.x1 + 70; x += 14) {
      world.add(mesh(kit, kit.box(6, 0.1, 0.8), '#FFFFFF', x, 0.36, road.y + road.h / 2, { shadow: false }));
    }
    // Back lanes and other streets as plain paths for context.
    for (const r of s.roads) {
      if (r.name === road.name) continue;
      const len = r.vertical ? r.h : Math.min(r.w, roadLen);
      const p = new THREE.Mesh(kit.box(r.vertical ? r.w : len, 0.25, r.vertical ? len : r.h), kit.mat('#A8A2B4'));
      p.position.set(r.vertical ? r.x + r.w / 2 : midX, 0.12, r.vertical ? r.y + r.h / 2 : r.y + r.h / 2);
      p.receiveShadow = true;
      world.add(p);
    }

    m.lots.forEach((l, i) => {
      const g = house(kit, l, true, l.no * 7 + i);
      houses.set(l.id, g);
      world.add(g);
    });
    m.backLots.forEach((l, i) => world.add(house(kit, l, false, l.no * 5 + i)));

    // Street trees and lamps on the walkways, between every other house.
    const north = m.lots.filter((l) => l.faces === 'south').sort((a, b) => a.x - b.x);
    north.forEach((l, i) => {
      if (i % 2 === 0) world.add(tree(kit, l.x, road.y + 2.5, 0.9));
      else if (i % 4 === 1) world.add(lamp(kit, l.x, road.y + 2.5));
    });
    const south = m.lots.filter((l) => l.faces === 'north').sort((a, b) => a.x - b.x);
    south.forEach((l, i) => {
      if (i % 2 === 1) world.add(tree(kit, l.x, road.y + road.h - 2.5, 0.9));
      else if (i % 4 === 0) world.add(lamp(kit, l.x, road.y + road.h - 2.5));
    });
    // A few big trees at the ends of the street.
    for (const [x, z] of [[bounds.x0 - 18, road.y - 30], [bounds.x0 - 22, road.y + road.h + 40], [bounds.x1 + 20, road.y - 40], [bounds.x1 + 16, road.y + road.h + 30]]) world.add(tree(kit, x, z, 1.5));

    // Flood alert: shallow water over the road.
    if (s.floodAlert) {
      const water = new THREE.Mesh(kit.box(roadLen, 0.4, road.h - 4), kit.mat('#4E8FEA', { opacity: 0.5 }));
      water.position.set(midX, 0.9, road.y + road.h / 2);
      world.add(water);
    }

    sun.position.set(midX - 160, 300, road.y - 120);
    sun.target.position.set(midX, 0, road.y + road.h / 2);
    const cam = sun.shadow.camera;
    cam.left = -260; cam.right = 260; cam.top = 260; cam.bottom = -260; cam.near = 10; cam.far = 900;
    cam.updateProjectionMatrix();
  };

  build(site);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 280;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.32;
  controls.screenSpacePanning = false;
  controls.addEventListener('change', () => {
    const b = model.bounds;
    controls.target.x = Math.min(b.x1, Math.max(b.x0, controls.target.x));
    controls.target.z = Math.min(b.z1, Math.max(b.z0, controls.target.z));
    controls.target.y = Math.min(30, Math.max(2, controls.target.y));
    onChange();
  });

  const homePose = () => {
    const me = model.me;
    const north = me.faces === 'north';
    const front = north ? me.y : me.y + me.h;
    // Aim at your porch, with the camera across the road at a three-quarter angle so
    // your house sits in the middle and the neighbours on both sides recede along the row.
    const target = new THREE.Vector3(me.x + me.w / 2, 9, north ? front + 12 : front - 12);
    const away = north ? -1 : 1;
    const aspect = Math.max(0.45, Math.min(1.6, camera.aspect || 0.5));
    const k = aspect < 1 ? 1 / Math.pow(aspect, 0.5) : 1;
    const side = me.x + me.w / 2 > (model.bounds.x0 + model.bounds.x1) / 2 ? -1 : 1;
    const H = 92 * k;
    const pos = new THREE.Vector3(target.x + side * H * 0.55, 74 * k, target.z + away * H * 0.84);
    return { target, pos };
  };

  let anim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number; dur: number } | null = null;
  const home = (animate = true) => {
    const { target, pos } = homePose();
    if (!animate || reducedMotion) {
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
      onChange();
      return;
    }
    anim = { from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, t0: performance.now(), dur: 1400 };
  };

  // Start high above the street, then fly down to your house.
  const start = homePose();
  camera.position.set(start.target.x + 20, 360, start.target.z + (model.me.faces === 'north' ? -260 : 260));
  controls.target.copy(start.target);
  controls.update();
  home(true);

  let raf = 0;
  const loop = (t: number) => {
    raf = requestAnimationFrame(loop);
    if (anim) {
      const k = Math.min(1, (t - anim.t0) / anim.dur);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(anim.from, anim.to, e);
      controls.target.lerpVectors(anim.tFrom, anim.tTo, e);
      if (k >= 1) anim = null;
      onChange();
    }
    controls.update();
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (clientX: number, clientY: number) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...houses.values()], true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.lotId) o = o.parent;
    return (o?.userData.lotId as string | undefined) ?? null;
  };

  const v = new THREE.Vector3();
  const project = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height, visible: v.z < 1 && v.z > -1 };
  };

  const resize = (w: number, h: number) => {
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    const first = camera.aspect === 1;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (first) home(true);
    onChange();
  };

  return {
    renderer, scene, camera, controls, houses, home, pick, project, resize,
    get model() { return model; },
    rebuild: (s: Site) => { build(s); onChange(); },
    atMaxDistance: () => camera.position.distanceTo(controls.target) >= controls.maxDistance - 2,
    dispose: () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      scene.traverse((o) => { const geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; if (geo) geo.dispose(); });
      kit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
