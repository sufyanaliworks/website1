import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { std, canvasTexture, instanced, rng } from './util.js';

// ---------------------------------------------------------------------------
// Shared pieces: trees, palms, cars, road ribbons
// ---------------------------------------------------------------------------
export function palmGeometries() {
  const trunk = new THREE.CylinderGeometry(0.25, 0.45, 9, 7); trunk.translate(0, 4.5, 0);
  const fronds = [];
  for (let i = 0; i < 8; i++) {
    const f = new THREE.BoxGeometry(0.6, 0.08, 4.2); f.translate(0, 0, 2.1);
    f.rotateX(0.45); f.rotateY((i / 8) * Math.PI * 2); f.translate(0, 9, 0);
    fronds.push(f);
  }
  return { trunk, crown: mergeGeometries(fronds) };
}

export function addPalms(group, list, scaleRand = rng(3)) {
  const { trunk, crown } = palmGeometries();
  const items = list.map(p => ({ x: p.x, y: p.y || 0, z: p.z, ry: scaleRand() * 6, s: 0.8 + scaleRand() * 0.5 }));
  group.add(instanced(trunk, std(0x8a6a48), items, { castShadow: true }));
  group.add(instanced(crown, std(0x3f7f35, { side: THREE.DoubleSide }), items, { castShadow: true }));
}

function addTrees(group, list) {
  const trunk = new THREE.CylinderGeometry(0.3, 0.45, 4, 6); trunk.translate(0, 2, 0);
  const crown = new THREE.IcosahedronGeometry(3.2, 1); crown.translate(0, 6, 0);
  const R = rng(9);
  const items = list.map(p => ({ x: p.x, z: p.z, ry: R() * 6, s: 0.7 + R() * 0.8, color: new THREE.Color().setHSL(0.24 + R() * 0.08, 0.45, 0.25 + R() * 0.12) }));
  group.add(instanced(trunk, std(0x6b4f35), items));
  group.add(instanced(crown, std(0xffffff, { flatShading: true }), items, { castShadow: true }));
}

export function carGeometry() {
  const body = new THREE.BoxGeometry(1.8, 0.7, 4.3); body.translate(0, 0.55, 0);
  const cab = new THREE.BoxGeometry(1.6, 0.6, 2.2); cab.translate(0, 1.15, -0.2);
  return mergeGeometries([body, cab]);
}
const CAR_COLORS = ['#f2f2f2', '#ffffff', '#1b1b1b', '#8a9099', '#c0c4ca', '#7d1f1f', '#1f3d7d', '#c9b48a', '#2c2c34'];

function roadTexture(lanes) {
  return canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#2b2e33'; c.fillRect(0, 0, w, h);
    const R = rng(lanes);
    for (let i = 0; i < 1200; i++) { c.fillStyle = `rgba(255,255,255,${R() * 0.04})`; c.fillRect(R() * w, R() * h, 2, 2); }
    c.fillStyle = '#f5f5f5';
    c.fillRect(4, 0, 4, h); c.fillRect(w - 8, 0, 4, h);
    for (let l = 1; l < lanes; l++) {
      const x = (l / lanes) * w;
      if (lanes >= 6 && l === lanes / 2) { c.fillStyle = '#e8c26a'; c.fillRect(x - 4, 0, 8, h); c.fillStyle = '#f5f5f5'; }
      else c.fillRect(x - 2, 0, 4, h * 0.45);
    }
  }, { aniso: 8 });
}

// Flat road strip following points (Vector3), optional y on points.
export function ribbon(points, width, mat, vRepeat = 12) {
  const pos = [], uv = [], idx = [];
  let dist = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[Math.min(i + 1, points.length - 1)], o = points[Math.max(i - 1, 0)];
    const dir = new THREE.Vector3().subVectors(q, o).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
    if (i > 0) dist += p.distanceTo(points[i - 1]);
    pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z);
    uv.push(0, dist / vRepeat, 1, dist / vRepeat);
    if (i < points.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
export function buildDistrict(scene) {
  const group = new THREE.Group();
  const labels = [];
  const R = rng(42);

  // ---- Ground (desert sand) ----
  const sand = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#d8c39a'; c.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 9000; i++) { const v = r(); c.fillStyle = v > 0.5 ? 'rgba(255,240,210,.25)' : 'rgba(150,120,80,.18)'; c.fillRect(r() * w, r() * h, 2, 2); }
  }, { repeat: [120, 120] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), std(0xffffff, { map: sand, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);

  // District landscaping base (lighter paved/green zone)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2300), std(0xc9c0ad, { roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.set(-50, 0.01, 100); base.receiveShadow = true; group.add(base);

  // ---- Big park (east) ----
  const PARK = { x: 720, z: -180, w: 680, d: 1000 };
  const grassTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#4c8a3c'; c.fillRect(0, 0, w, h);
    const r = rng(8);
    for (let i = 0; i < 3000; i++) { c.fillStyle = r() > 0.5 ? 'rgba(120,180,80,.25)' : 'rgba(30,70,30,.25)'; c.fillRect(r() * w, r() * h, 3, 3); }
  }, { repeat: [60, 90] });
  const park = new THREE.Mesh(new THREE.PlaneGeometry(PARK.w, PARK.d), std(0xffffff, { map: grassTex, roughness: 1 }));
  park.rotation.x = -Math.PI / 2; park.position.set(PARK.x, 0.03, PARK.z); park.receiveShadow = true; group.add(park);

  // Lake (organic shape)
  const lakeShape = new THREE.Shape();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rr = 1 + 0.18 * Math.sin(a * 3) + 0.1 * Math.cos(a * 5);
    const x = Math.cos(a) * 150 * rr, y = Math.sin(a) * 210 * rr;
    i ? lakeShape.lineTo(x, y) : lakeShape.moveTo(x, y);
  }
  const lakeGeo = new THREE.ShapeGeometry(lakeShape, 4); lakeGeo.rotateX(-Math.PI / 2);
  const lakeMat = new THREE.MeshStandardMaterial({ color: 0x2a6fa8, metalness: 0.85, roughness: 0.08 });
  const lake = new THREE.Mesh(lakeGeo, lakeMat); lake.position.set(PARK.x + 40, 0.1, PARK.z - 80); group.add(lake);
  const shore = new THREE.Mesh(lakeGeo, std(0xe4d7b5)); shore.scale.set(1.08, 1, 1.06); shore.position.set(PARK.x + 40, 0.06, PARK.z - 80); group.add(shore);
  // little island with a pavilion
  const island = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 1.2, 32), std(0x5c9a45)); island.position.set(PARK.x + 40, 0.5, PARK.z - 80); group.add(island);
  const pav = new THREE.Mesh(new THREE.ConeGeometry(9, 5, 8), std(0xd8ab4a, { metalness: 0.6, roughness: 0.3 })); pav.position.set(PARK.x + 40, 7, PARK.z - 80); group.add(pav);
  const pavCols = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pavCols.push({ x: PARK.x + 40 + Math.cos(a) * 7, y: 3, z: PARK.z - 80 + Math.sin(a) * 7 }); }
  group.add(instanced(new THREE.CylinderGeometry(0.3, 0.3, 5, 8), std(0xffffff), pavCols));
  // bridge to island
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(110, 1, 5), std(0x9a7a55)); bridge.position.set(PARK.x - 60, 1.1, PARK.z - 80); group.add(bridge);

  // Jogging track (red loop) + paths
  const trackMat = std(0xb5503c, { roughness: 0.95 });
  const loop = [];
  for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; loop.push(new THREE.Vector3(PARK.x + Math.cos(a) * 300, 0.12, PARK.z + Math.sin(a) * 470)); }
  group.add(ribbon(loop, 6, trackMat));
  const pathMat = std(0xe8dfcb, { roughness: 1 });
  const paths = [
    [[PARK.x - 340, -300], [PARK.x - 150, -260], [PARK.x - 60, -80], [PARK.x - 120, 150], [PARK.x - 300, 260]],
    [[PARK.x - 340, 120], [PARK.x - 200, 80], [PARK.x - 120, 150], [PARK.x + 60, 260], [PARK.x + 300, 300]],
    [[PARK.x + 340, -500], [PARK.x + 220, -420], [PARK.x + 200, -200], [PARK.x + 240, 60]],
  ];
  paths.forEach(p => {
    const curve = new THREE.CatmullRomCurve3(p.map(([x, z]) => new THREE.Vector3(x, 0.11, z + PARK.z + 180)));
    group.add(ribbon(curve.getPoints(120), 5, pathMat));
  });
  // Playground (colourful)
  const play = new THREE.Group();
  const pc = ['#ff5c5c', '#ffc83d', '#3dc7ff', '#7d5cff'];
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 0.3, 40), std(0x3d6fb0)); play.add(pad);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(4 + R() * 4, 2 + R() * 4, 4 + R() * 4), std(pc[i % 4]));
    const a = R() * 6.28, rr = 8 + R() * 24; m.position.set(Math.cos(a) * rr, 2, Math.sin(a) * rr); m.rotation.y = R() * 3; play.add(m);
  }
  const slide = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 10, 16), std(pc[1])); slide.position.y = 5; play.add(slide);
  const top = new THREE.Mesh(new THREE.ConeGeometry(4.5, 4, 16), std(pc[0])); top.position.y = 12; play.add(top);
  play.position.set(PARK.x + 200, 0.15, PARK.z + 330); group.add(play);
  // Amphitheatre lawn
  const amph = new THREE.Mesh(new THREE.CylinderGeometry(60, 70, 4, 40, 1, false, 0, Math.PI), std(0xd9d2c2)); amph.position.set(PARK.x - 200, 2, PARK.z - 380); group.add(amph);
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 1.5, 32), std(0xffffff)); stage.position.set(PARK.x - 200, 0.8, PARK.z - 380); group.add(stage);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16, 0, Math.PI, 0, Math.PI / 2), std(0xffffff, { side: THREE.DoubleSide })); shell.position.set(PARK.x - 200, 1, PARK.z - 395); group.add(shell);

  // Trees across the park (avoiding the lake)
  const trees = [];
  while (trees.length < 2600) {
    const x = PARK.x + (R() - 0.5) * PARK.w * 0.96, z = PARK.z + (R() - 0.5) * PARK.d * 0.96;
    const lx = (x - PARK.x - 40) / 175, lz = (z - PARK.z + 80) / 245;
    if (lx * lx + lz * lz < 1) continue;
    if (Math.hypot(x - PARK.x - 200, z - PARK.z - 330) < 45) continue;
    if (Math.hypot(x - PARK.x + 200, z - PARK.z + 380) < 80) continue;
    trees.push({ x, z });
  }
  addTrees(group, trees);
  const palmRing = [];
  for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; palmRing.push({ x: PARK.x + 40 + Math.cos(a) * 180, z: PARK.z - 80 + Math.sin(a) * 250 }); }
  addPalms(group, palmRing);

  labels.push({ group: 'park', text: '🌳 Al Yasmeen Park', pos: new THREE.Vector3(PARK.x, 40, PARK.z + 200), go: 'park' });
  labels.push({ group: 'park', text: '💧 Yasmeen Lake', pos: new THREE.Vector3(PARK.x + 40, 18, PARK.z - 80), small: true });
  labels.push({ group: 'park', text: '🏃 Jogging track 2.5 km', pos: new THREE.Vector3(PARK.x + 300, 8, PARK.z), small: true });
  labels.push({ group: 'park', text: '🛝 Kids playground', pos: new THREE.Vector3(PARK.x + 200, 20, PARK.z + 330), small: true });
  labels.push({ group: 'park', text: '🎭 Amphitheatre', pos: new THREE.Vector3(PARK.x - 200, 26, PARK.z - 380), small: true });

  // ---- Parking: 8 multi-storey garages + 4 surface lots ----
  const parking = { garages: [], lots: [], total: 0 };
  const slabMat = std(0xa8adb5, { roughness: 0.9 });
  const levelH = 3.4, levels = 8, GW = 180, GD = 170, PER_LEVEL = 1200;
  const slabs = [], gcols = [], ramps = [];
  const garagePos = [];
  for (const x of [-345, -560]) for (const z of [-170, 30, 230, 430]) garagePos.push({ x, z });
  garagePos.forEach((g, i) => {
    for (let l = 0; l <= levels; l++) slabs.push({ x: g.x, y: l * levelH + 0.4, z: g.z });
    for (let cx = -GW / 2 + 5; cx <= GW / 2 - 5; cx += 28) for (let cz = -GD / 2 + 5; cz <= GD / 2 - 5; cz += 32) gcols.push({ x: g.x + cx, y: (levels * levelH) / 2, z: g.z + cz });
    ramps.push({ x: g.x + GW / 2 - 12, y: (levels * levelH) / 2, z: g.z, sy: 1 });
    const name = `P${i + 1}`;
    parking.garages.push({ name, x: g.x, z: g.z, spots: PER_LEVEL * levels });
    labels.push({ group: 'parking', text: `🅿 ${name} · ${(PER_LEVEL * levels).toLocaleString()} spaces`, pos: new THREE.Vector3(g.x, levels * levelH + 12, g.z), small: true });
  });
  group.add(instanced(new THREE.BoxGeometry(GW, 0.8, GD), slabMat, slabs, { castShadow: true, receiveShadow: true }));
  group.add(instanced(new THREE.BoxGeometry(1, levels * levelH, 1), slabMat, gcols));
  group.add(instanced(new THREE.CylinderGeometry(10, 10, levels * levelH, 24, 1, true), std(0x8d939c, { side: THREE.DoubleSide }), ramps));
  // garage facade stripes (green brand colour)
  const finMat = std(0x1fb58a, { roughness: 0.6 });
  const fins = [];
  garagePos.forEach(g => {
    for (let t = -GW / 2; t <= GW / 2; t += 6) for (const s of [-1, 1]) fins.push({ x: g.x + t, y: (levels * levelH) / 2, z: g.z + s * (GD / 2 + 0.3) });
  });
  group.add(instanced(new THREE.BoxGeometry(0.6, levels * levelH, 0.3), finMat, fins));

  // Surface lots with painted bays (texture tile = 25 m x 16 m = 20 bays)
  const bayTex = canvasTexture(250, 160, (c, w, h) => {
    c.fillStyle = '#34373c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9e9e9';
    for (let i = 0; i <= 10; i++) { c.fillRect(i * 25 - 1, 0, 2, 50); c.fillRect(i * 25 - 1, 110, 2, 50); }
    c.fillRect(0, 49, w, 2); c.fillRect(0, 109, w, 2);
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (let x = 10; x < w; x += 40) c.fillRect(x, 79, 18, 2);
  });
  const lots = [
    { x: -5, z: 420, w: 350, d: 400 }, { x: 355, z: 420, w: 350, d: 400 },
    { x: -5, z: 830, w: 350, d: 400 }, { x: 355, z: 830, w: 350, d: 400 },
  ];
  const carGeo = carGeometry();
  const cars = [];
  lots.forEach((l, i) => {
    const t = bayTex.clone(); t.needsUpdate = true; t.repeat.set(l.w / 25, l.d / 16);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.d), std(0xffffff, { map: t, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.position.set(l.x, 0.06, l.z); m.receiveShadow = true; group.add(m);
    const spots = Math.floor(l.w / 25) * 10 * Math.floor(l.d / 16) * 2;
    const name = `P${9 + i}`;
    parking.lots.push({ name, ...l, spots });
    labels.push({ group: 'parking', text: `🅿 ${name} · ${spots.toLocaleString()} spaces`, pos: new THREE.Vector3(l.x, 14, l.z), small: true });
    // cars: busier near the stadium
    const xW = l.x - l.w / 2, zS = l.z + l.d / 2;
    const tiles = Math.floor(l.d / 16);
    for (let k = 0; k < tiles; k++) for (const rowOff of [2.5, 13.5]) for (let s = 0; s < Math.floor(l.w / 2.5); s++) {
      const fill = i < 2 ? 0.55 : 0.18;
      if (R() > fill) continue;
      cars.push({ x: xW + 1.25 + s * 2.5, y: 0.05, z: zS - 16 * k - rowOff, ry: rowOff < 5 ? Math.PI : 0, color: CAR_COLORS[Math.floor(R() * CAR_COLORS.length)] });
    }
  });
  // cars on garage top decks
  garagePos.forEach(g => {
    for (let x = -GW / 2 + 4; x < GW / 2 - 24; x += 2.6) for (let z = -GD / 2 + 6; z < GD / 2 - 4; z += 8) {
      if (R() > 0.5) continue;
      cars.push({ x: g.x + x, y: levels * levelH + 0.8, z: g.z + z, ry: Math.PI / 2 * (R() > 0.5 ? 1 : -1) * 0 , color: CAR_COLORS[Math.floor(R() * CAR_COLORS.length)] });
    }
  });
  group.add(instanced(carGeo, std(0xffffff, { metalness: 0.5, roughness: 0.4 }), cars, { castShadow: false }));
  parking.total = parking.garages.reduce((s, g) => s + g.spots, 0) + parking.lots.reduce((s, l) => s + l.spots, 0);
  parking.parkedCars = cars.length;

  // ---- Roads & highways ----
  const hwMat = std(0xffffff, { map: roadTexture(8), roughness: 0.9 });
  const rdMat = std(0xffffff, { map: roadTexture(4), roughness: 0.9 });
  const traffic = [];
  const addRoad = (pts, width, mat, carCount, laneOffsets, speed) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const pointsArr = curve.getSpacedPoints(Math.max(40, Math.floor(curve.getLength() / 10)));
    group.add(ribbon(pointsArr, width, mat, width * 1.2));
    traffic.push({ curve, len: curve.getLength(), carCount, laneOffsets, speed });
    return curve;
  };
  const V = (x, z, y = 0.15) => new THREE.Vector3(x, y, z);
  // E311 — Sheikh Mohammed Bin Zayed Road (north–south, west of the district), with flyover
  addRoad([V(-1050, -4000), V(-1050, 900), V(-1050, 1080, 4), V(-1050, 1200, 9), V(-1050, 1320, 4), V(-1050, 1500), V(-1050, 4000)], 36, hwMat, 260, [-15, -10.5, -6, -1.8, 1.8, 6, 10.5, 15], 30);
  // E611 — Emirates Road (east–west, south of the district)
  addRoad([V(-4000, 1200), V(4000, 1200)], 36, hwMat, 260, [-15, -10.5, -6, -1.8, 1.8, 6, 10.5, 15], 32);
  // Flyover deck supports
  const piers = [];
  for (let z = 1100; z <= 1300; z += 25) piers.push({ x: -1050, y: 4.5, z, sy: 1 });
  group.add(instanced(new THREE.BoxGeometry(24, 9, 2), std(0xb9b4aa), piers));
  // Interchange loops
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
    const cx = -1050 + sx * 95, cz = 1200 + sz * 95, pts = [];
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 1.5 + (sx > 0 ? (sz > 0 ? Math.PI : -Math.PI / 2) : (sz > 0 ? Math.PI / 2 : 0)); pts.push(V(cx + Math.cos(a) * 65, cz + Math.sin(a) * 65, 0.13)); }
    group.add(ribbon(pts, 10, rdMat, 12));
  });
  // Al Yasmeen ring boulevard around the district + links to highways
  const ring = [V(-760, -1150), V(1150, -1150), V(1150, 1120), V(-760, 1120)];
  const ringPts = [];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4];
    for (let t = 0; t < 1; t += 0.02) ringPts.push(a.clone().lerp(b, t));
  }
  ringPts.push(ring[0].clone());
  const ringCurve = new THREE.CatmullRomCurve3(ringPts, true, 'catmullrom', 0.05);
  group.add(ribbon(ringCurve.getSpacedPoints(800), 20, rdMat, 24));
  traffic.push({ curve: ringCurve, len: ringCurve.getLength(), carCount: 160, laneOffsets: [-7, -2.5, 2.5, 7], speed: 16 });
  addRoad([V(-1032, 0), V(-760, 0)], 20, rdMat, 30, [-7, -2.5, 2.5, 7], 14);
  addRoad([V(-1032, -600), V(-760, -600)], 20, rdMat, 30, [-7, -2.5, 2.5, 7], 14);
  addRoad([V(200, 1182), V(200, 1120)], 20, rdMat, 6, [-5, 5], 10);
  addRoad([V(-760, -300), V(-200, -300), V(300, -300), V(355, -360), V(355, -700), V(355, -1150)], 20, rdMat, 60, [-7, -2.5, 2.5, 7], 14);
  addRoad([V(-200, -300), V(-200, 600), V(-200, 1120)], 18, rdMat, 40, [-5, -2, 2, 5], 12);
  addRoad([V(1060, 380), V(1150, 380)], 14, rdMat, 4, [-3, 3], 8);
  // Street lights along the boulevards
  const poles = [], lamps = [];
  ringCurve.getSpacedPoints(160).forEach((p, i) => { poles.push({ x: p.x, y: 6, z: p.z }); lamps.push({ x: p.x, y: 12.2, z: p.z }); });
  group.add(instanced(new THREE.CylinderGeometry(0.15, 0.2, 12, 6), std(0x777d86, { metalness: 0.8 }), poles));
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffd28a, emissiveIntensity: 0 });
  group.add(instanced(new THREE.SphereGeometry(0.6, 8, 6), lampMat, lamps));

  labels.push({ group: 'roads', text: '🛣 E311 · Sheikh Mohammed Bin Zayed Rd', pos: new THREE.Vector3(-1050, 30, -300), go: 'roads' });
  labels.push({ group: 'roads', text: '🛣 E611 · Emirates Road', pos: new THREE.Vector3(400, 30, 1200), go: 'roads' });
  labels.push({ group: 'roads', text: '🔀 Al Yasmeen Interchange', pos: new THREE.Vector3(-1050, 40, 1200), small: true });
  labels.push({ group: 'roads', text: 'Al Yasmeen Ring Boulevard', pos: new THREE.Vector3(1150, 16, 100), small: true });

  // Moving traffic (instanced, updated every frame)
  const totalCars = traffic.reduce((s, t) => s + t.carCount, 0);
  const trafficMesh = new THREE.InstancedMesh(carGeo, std(0xffffff, { metalness: 0.5, roughness: 0.35 }), totalCars);
  trafficMesh.frustumCulled = false;
  const carState = [];
  let ci = 0;
  traffic.forEach(t => {
    for (let k = 0; k < t.carCount; k++) {
      const lane = t.laneOffsets[k % t.laneOffsets.length];
      const dirSign = lane > 0 ? 1 : -1;
      carState.push({ t, u: R(), lane, dirSign, v: (t.speed * (0.8 + R() * 0.4)) / t.len });
      trafficMesh.setColorAt(ci++, new THREE.Color(CAR_COLORS[Math.floor(R() * CAR_COLORS.length)]));
    }
  });
  group.add(trafficMesh);
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3(), dummy = new THREE.Object3D();
  function updateTraffic(dt) {
    carState.forEach((c, i) => {
      c.u = (c.u + c.v * dt * c.dirSign + 1) % 1;
      c.t.curve.getPointAt(c.u, tmpP);
      c.t.curve.getTangentAt(c.u, tmpT);
      const sx = -tmpT.z, sz = tmpT.x;
      const l = Math.hypot(sx, sz) || 1;
      dummy.position.set(tmpP.x + (sx / l) * c.lane, tmpP.y, tmpP.z + (sz / l) * c.lane);
      dummy.rotation.set(0, Math.atan2(tmpT.x, tmpT.z) + (c.dirSign < 0 ? Math.PI : 0), 0);
      dummy.updateMatrix();
      trafficMesh.setMatrixAt(i, dummy.matrix);
    });
    trafficMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- Ajman city backdrop (low-rise + towers beyond the highways) ----
  const bld = [];
  const BR = rng(77);
  while (bld.length < 1400) {
    const x = (BR() - 0.5) * 8000, z = (BR() - 0.5) * 8000;
    if (x > -1250 && x < 1450 && z > -1300 && z < 1400) continue;
    if (Math.abs(x + 1050) < 60 || Math.abs(z - 1200) < 60) continue;
    const far = Math.hypot(x, z);
    const tall = BR() < (z < -1500 && x < 0 ? 0.35 : 0.08);
    const h = tall ? 60 + BR() * 180 : 8 + BR() * 18;
    const w = tall ? 30 + BR() * 20 : 20 + BR() * 30;
    bld.push({ x, y: h / 2, z, sx: w, sy: h, sz: w * (0.6 + BR() * 0.8), ry: 0, color: new THREE.Color().setHSL(0.09, 0.15 + BR() * 0.2, 0.62 + BR() * 0.2 - far / 40000) });
  }
  const bMesh = instanced(new THREE.BoxGeometry(1, 1, 1), std(0xffffff, { roughness: 0.85 }), bld);
  group.add(bMesh);
  const windowMat = bMesh.material;

  return {
    group, labels, parking, updateTraffic, lampMat, windowMat,
    park: PARK,
    nightMats: [{ mat: lampMat, emissive: new THREE.Color(0xffd28a), intensity: 3 }, { mat: windowMat, emissive: new THREE.Color(0x3a2a10), intensity: 0.6 }],
  };
}
