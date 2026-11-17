import * as THREE from 'three';
import { std, canvasTexture, instanced, rng } from './util.js';

// Grand mosque inspired by the scale of the Sheikh Zayed Grand Mosque (~420 x 290 m),
// white marble, a large main dome, many small domes, four ~107 m minarets,
// a floral courtyard and reflecting pools. Local axis: prayer hall at -x (towards the qibla).
const Y0 = 3; // platform height

function marbleTexture() {
  const R = rng(7);
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#f4f2ee'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(160,160,170,.18)';
    for (let i = 0; i < 26; i++) {
      c.lineWidth = R() * 2 + 0.5;
      c.beginPath();
      let x = R() * w, y = R() * h; c.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 120; y += (R() - 0.3) * 80; c.lineTo(x, y); }
      c.stroke();
    }
  }, { repeat: [6, 6] });
}

function courtyardTexture() {
  const R = rng(11);
  return canvasTexture(1024, 1024, (c, w, h) => {
    c.fillStyle = '#f6f4f0'; c.fillRect(0, 0, w, h);
    // flowing vines + flowers, like the famous floral marble mosaic
    const cols = ['#c94f6d', '#e8a33d', '#3f8f5f', '#5a7fc9', '#9b5fc0'];
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = '#6f9f6a'; c.lineWidth = 6;
      c.beginPath();
      let x = R() * w, y = 0; c.moveTo(x, y);
      while (y < h) { const nx = x + (R() - 0.5) * 220, ny = y + 120; c.quadraticCurveTo(x + (R() - .5) * 200, y + 60, nx, ny); x = nx; y = ny; }
      c.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = R() * w, y = R() * h, s = 10 + R() * 18, col = cols[Math.floor(R() * cols.length)];
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        c.fillStyle = col;
        c.beginPath(); c.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.7, s * 0.35, a, 0, 7); c.fill();
      }
      c.fillStyle = '#e8c26a'; c.beginPath(); c.arc(x, y, s * 0.4, 0, 7); c.fill();
    }
  }, { repeat: [3, 2] });
}

function carpetTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#1f5a3e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d9b35c'; c.lineWidth = 3;
    for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    c.fillStyle = 'rgba(217,179,92,.35)';
    for (let x = 32; x < w; x += 64) for (let y = 40; y < h; y += 128) { c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x + 18, y); c.lineTo(x, y + 30); c.lineTo(x - 18, y); c.fill(); }
  }, { repeat: [20, 30] });
}

function dome(r, mat, stretch = 1.25) {
  // onion-ish dome: lathe profile
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const ang = t * Math.PI / 2;
    let x = Math.cos(ang) * r * (1 + 0.08 * Math.sin(t * Math.PI));
    const y = Math.sin(ang) * r * stretch;
    if (t > 0.85) x *= 1 - (t - 0.85) * 2.5;
    pts.push(new THREE.Vector2(Math.max(x, 0.01), y));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat);
}

function finial(h, gold) {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * h, 0.25 * h, h, 8), gold);
  rod.position.y = h / 2; g.add(rod);
  [0.35, 0.6].forEach(f => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.45 * h * 0.6, 12, 8), gold); b.position.y = h * f; g.add(b); });
  const cres = new THREE.Mesh(new THREE.TorusGeometry(0.45 * h, 0.08 * h, 6, 20, Math.PI * 1.4), gold);
  cres.position.y = h * 1.25; cres.rotation.z = Math.PI * 0.8; g.add(cres);
  return g;
}

export function buildMosque() {
  const group = new THREE.Group();
  group.name = 'mosque';
  const marble = std(0xffffff, { map: marbleTexture(), roughness: 0.35, metalness: 0.02 });
  const marbleDS = marble.clone(); marbleDS.side = THREE.DoubleSide;
  const gold = std(0xd8ab4a, { metalness: 1, roughness: 0.25 });
  const nightMats = [
    { mat: marble, emissive: new THREE.Color(0x5b7fd6), intensity: 0.32 },
    { mat: marbleDS, emissive: new THREE.Color(0x5b7fd6), intensity: 0.32 },
    { mat: gold, emissive: new THREE.Color(0xffb84a), intensity: 0.35 },
  ];

  // Platform
  const plat = new THREE.Mesh(new THREE.BoxGeometry(440, Y0, 320), marble);
  plat.position.y = Y0 / 2; plat.receiveShadow = true; group.add(plat);

  // Courtyard (floral mosaic) — capacity area
  const court = new THREE.Mesh(new THREE.PlaneGeometry(240, 190), std(0xffffff, { map: courtyardTexture(), roughness: 0.4 }));
  court.rotation.x = -Math.PI / 2; court.position.set(45, Y0 + 0.02, 0); court.receiveShadow = true; group.add(court);
  nightMats.push({ mat: court.material, emissive: new THREE.Color(0x3a4f88), intensity: 0.22 });

  // Reflecting pools along the long sides
  const water = new THREE.MeshStandardMaterial({ color: 0x1b4f8f, metalness: 0.9, roughness: 0.05 });
  [-1, 1].forEach(s => {
    const pool = new THREE.Mesh(new THREE.BoxGeometry(400, 0.6, 30), water);
    pool.position.set(0, Y0 + 0.05, s * 140); group.add(pool);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(404, 0.8, 34), marble);
    rim.position.set(0, Y0 - 0.1, s * 140); group.add(rim);
  });

  // Arcades (riwaq) around courtyard with columns and small domes
  const arcadeH = 12;
  const columns = [], smallDomes = [];
  const slabs = [
    { x: 45, z: -107, w: 270, d: 24 }, { x: 45, z: 107, w: 270, d: 24 }, { x: 177, z: 0, w: 24, d: 190 },
  ];
  slabs.forEach(s => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(s.w, 2.4, s.d), marble);
    slab.position.set(s.x, Y0 + arcadeH + 1.2, s.z); slab.castShadow = true; group.add(slab);
    const back = new THREE.Mesh(new THREE.BoxGeometry(s.w === 24 ? 2 : s.w, arcadeH, s.w === 24 ? s.d : 2), marble);
    back.position.set(s.x + (s.w === 24 ? 11 : 0), Y0 + arcadeH / 2, s.z + (s.w === 24 ? 0 : Math.sign(s.z) * 11)); group.add(back);
    const along = s.w > s.d ? 'x' : 'z';
    const L = Math.max(s.w, s.d);
    for (let t = -L / 2 + 4; t <= L / 2 - 4; t += 8) {
      for (const off of [-8, 0]) {
        const inward = along === 'x' ? -Math.sign(s.z) : -1;
        const x = along === 'x' ? s.x + t : s.x + inward * (-off - 4) + (inward > 0 ? 0 : 0);
        const z = along === 'x' ? s.z + inward * (-off - 4) : s.z + t;
        columns.push({ x, y: Y0 + arcadeH / 2, z });
      }
      if (Math.abs(t) % 16 < 1) smallDomes.push({ x: along === 'x' ? s.x + t : s.x, y: Y0 + arcadeH + 2.4, z: along === 'x' ? s.z : s.z + t, s: 1 });
    }
  });
  const colGeo = new THREE.CylinderGeometry(0.9, 1.1, arcadeH, 12);
  group.add(instanced(colGeo, marble, columns, { castShadow: true }));
  const capGeo = new THREE.CylinderGeometry(1.5, 0.9, 1.2, 12);
  group.add(instanced(capGeo, gold, columns.map(c => ({ ...c, y: Y0 + arcadeH - 0.6 }))));
  const sdGeo = dome(4.2, marble, 1.3).geometry;
  group.add(instanced(sdGeo, marble, smallDomes, { castShadow: true }));
  const sfGeo = new THREE.ConeGeometry(0.3, 3, 6);
  group.add(instanced(sfGeo, gold, smallDomes.map(d => ({ ...d, y: d.y + 5.6 + 1.5 }))));

  // Main prayer hall
  const hall = new THREE.Group();
  const HX0 = -205, HX1 = -80, HZ = 110, HH = 32;
  const hallW = HX1 - HX0, hallCX = (HX0 + HX1) / 2;
  const wall = (w, h, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), marbleDS); m.position.set(x, Y0 + h / 2, z); m.rotation.y = ry; m.castShadow = true; hall.add(m); };
  wall(hallW, HH, hallCX, -HZ, 0); wall(hallW, HH, hallCX, HZ, Math.PI);
  wall(2 * HZ, HH, HX0, 0, Math.PI / 2); wall(2 * HZ, HH, HX1, 0, -Math.PI / 2);
  // roof with an opening under the main dome
  const rs = new THREE.Shape();
  rs.moveTo(HX0, -HZ); rs.lineTo(HX1, -HZ); rs.lineTo(HX1, HZ); rs.lineTo(HX0, HZ); rs.lineTo(HX0, -HZ);
  const hole = new THREE.Path(); hole.absarc(hallCX, 0, 20, 0, Math.PI * 2, true); rs.holes.push(hole);
  const roofGeo = new THREE.ExtrudeGeometry(rs, { depth: 2, bevelEnabled: false, curveSegments: 48 });
  roofGeo.rotateX(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, marbleDS); roof.position.y = Y0 + HH + 2; roof.castShadow = true; hall.add(roof);
  // drum + main dome (≈ 32 m wide, top ≈ 85 m)
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 12, 48, 1, true), marbleDS);
  drum.position.set(hallCX, Y0 + HH + 8, 0); hall.add(drum);
  const windows = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; windows.push({ x: hallCX + Math.cos(a) * 20.2, y: Y0 + HH + 8, z: Math.sin(a) * 20.2, ry: -a + Math.PI / 2 }); }
  const winMat = new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0xffd58a, emissiveIntensity: 0 });
  nightMats.push({ mat: winMat, emissive: new THREE.Color(0xffd58a), intensity: 1.4 });
  hall.add(instanced(new THREE.PlaneGeometry(2.2, 6), winMat, windows));
  const mainDome = dome(20, marbleDS, 1.6); mainDome.position.set(hallCX, Y0 + HH + 14, 0); mainDome.castShadow = true; hall.add(mainDome);
  const mf = finial(7, gold); mf.position.set(hallCX, Y0 + HH + 14 + 32, 0); hall.add(mf);
  // secondary domes on the hall
  [[-35, -55], [-35, 55], [35, -55], [35, 55], [0, -80], [0, 80]].forEach(([dx, dz], i) => {
    const r = i < 4 ? 11 : 8;
    const d = dome(r, marble, 1.4); d.position.set(hallCX + dx, Y0 + HH + 2, dz); d.castShadow = true; hall.add(d);
    const f = finial(3, gold); f.position.set(hallCX + dx, Y0 + HH + 2 + r * 1.4, dz); hall.add(f);
    const dr = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 32), marble); dr.position.set(hallCX + dx, Y0 + HH + 0.5 + 2, dz); hall.add(dr);
  });
  // hall facade arches (gold-trimmed portals on the courtyard side)
  const portalMat = std(0x0e1a2c, { roughness: 0.6 });
  for (let i = -4; i <= 4; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 18), portalMat);
    p.position.set(HX1 + 0.2, Y0 + 9, i * 22); p.rotation.y = Math.PI / 2; hall.add(p);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(5, 0.6, 8, 24, Math.PI), gold);
    arch.position.set(HX1 + 0.4, Y0 + 18, i * 22); arch.rotation.y = Math.PI / 2; hall.add(arch);
  }
  // Interior: carpet, column grid, chandelier, mihrab
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(hallW - 2, 2 * HZ - 2), std(0xffffff, { map: carpetTexture(), roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(hallCX, Y0 + 0.05, 0); hall.add(carpet);
  const inCols = [];
  for (let x = HX0 + 15; x < HX1 - 5; x += 18) for (let z = -HZ + 15; z < HZ - 5; z += 18) {
    if (Math.hypot(x - hallCX, z) < 26) continue;
    inCols.push({ x, y: Y0 + HH / 2, z, sy: HH / arcadeH });
  }
  hall.add(instanced(colGeo, marble, inCols));
  const chand = new THREE.Group();
  const chMat = new THREE.MeshStandardMaterial({ color: 0xd8ab4a, metalness: 1, roughness: 0.2, emissive: 0x553300, emissiveIntensity: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c1, emissive: 0xffd68a, emissiveIntensity: 2 });
  [10, 7, 4].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 8, 48), chMat); ring.rotation.x = Math.PI / 2; ring.position.y = -i * 3.2; chand.add(ring);
    const bulbs = [];
    for (let k = 0; k < 16 + i * -4; k++) { const a = (k / (16 - i * 4)) * Math.PI * 2; bulbs.push({ x: Math.cos(a) * r, y: -i * 3.2 + 0.6, z: Math.sin(a) * r }); }
    chand.add(instanced(new THREE.SphereGeometry(0.55, 10, 8), bulbMat, bulbs));
  });
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 30, 6), chMat); chain.position.y = 15; chand.add(chain);
  chand.position.set(hallCX, Y0 + 26, 0); hall.add(chand);
  const hallLight = new THREE.PointLight(0xffd9a0, 1.0, 180, 1.2); hallLight.position.set(hallCX, Y0 + 20, 0); hall.add(hallLight);
  const mihrab = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), std(0xd8ab4a, { metalness: 1, roughness: 0.3, emissive: 0x442a00, emissiveIntensity: 0.6 }));
  mihrab.position.set(HX0 + 0.3, Y0 + 8, 0); mihrab.rotation.y = Math.PI / 2; hall.add(mihrab);
  const mihrabArch = new THREE.Mesh(new THREE.CircleGeometry(5, 32, 0, Math.PI), mihrab.material);
  mihrabArch.position.set(HX0 + 0.3, Y0 + 16, 0); mihrabArch.rotation.y = Math.PI / 2; hall.add(mihrabArch);
  group.add(hall);

  // East entrance gate
  const gate = new THREE.Mesh(new THREE.BoxGeometry(14, 30, 60), marble);
  gate.position.set(200, Y0 + 15, 0); gate.castShadow = true; group.add(gate);
  const gateArch = new THREE.Mesh(new THREE.PlaneGeometry(22, 20), portalMat);
  gateArch.position.set(207.2, Y0 + 10, 0); gateArch.rotation.y = Math.PI / 2; group.add(gateArch);
  const gd = dome(9, marble, 1.4); gd.position.set(200, Y0 + 30, 0); group.add(gd);
  const gf = finial(3, gold); gf.position.set(200, Y0 + 30 + 12.6, 0); group.add(gf);

  // Four minarets (~107 m)
  [[-212, -152], [-212, 152], [212, -152], [212, 152]].forEach(([x, z]) => {
    const m = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 34, 10), marble); base.position.y = 17; m.add(base);
    const oct = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 36, 8), marble); oct.position.y = 34 + 18; m.add(oct);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 24, 20), marble); cyl.position.y = 70 + 12; m.add(cyl);
    [70, 94].forEach(y => {
      const bal = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4, 2, 20), marble); bal.position.y = y; m.add(bal);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.25, 6, 24), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y + 1; m.add(ring);
    });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 4, 16), gold); lantern.position.y = 96; m.add(lantern);
    const top = dome(2.8, gold, 1.6); top.position.y = 98; m.add(top);
    const f = finial(3.5, gold); f.position.y = 102.5; m.add(f);
    m.position.set(x, Y0, z);
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    group.add(m);
  });

  // ---- Visitor facilities (outside the platform) ----
  const facilities = { wudu: [], washrooms: [], water: [] };
  const roofMat = std(0xf1ede6, { roughness: 0.5 });
  const tapMat = std(0xc9ccd2, { metalness: 0.9, roughness: 0.2 });
  const stoolMat = std(0x8a6b45);
  // Wudu pavilions: open-sided, rows of taps with stools
  [{ z: -205, label: 'Wudu area · Men', taps: 0 }, { z: 205, label: 'Wudu area · Women', taps: 0 }, { x: 150, z: -205, label: 'Wudu area · Men (East)' }, { x: 150, z: 205, label: 'Wudu area · Women (East)' }].forEach(w => {
    const x0 = w.x ?? -60, W = 90, D = 32;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 1, D), roofMat); roof.position.set(x0, 7, w.z); roof.castShadow = true; group.add(roof);
    const pc = [];
    for (let x = -W / 2 + 3; x <= W / 2 - 3; x += 10) for (const z of [-D / 2 + 2, D / 2 - 2]) pc.push({ x: x0 + x, y: 3.5, z: w.z + z });
    group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 7, 10), marble, pc));
    const taps = [], stools = [], basins = [];
    for (let row = -1; row <= 1; row += 2) {
      for (let x = -W / 2 + 4; x <= W / 2 - 4; x += 1.4) {
        taps.push({ x: x0 + x, y: 1.3, z: w.z + row * 3.2, rx: row * Math.PI / 2 * 0.0 });
        stools.push({ x: x0 + x, y: 0.25, z: w.z + row * 4.4 });
      }
      basins.push({ x: x0, y: 0.6, z: w.z + row * 2.4, sx: 1 });
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(W - 6, 2.2, 1.2), marble); wall.position.set(x0, 1.1, w.z); group.add(wall);
    group.add(instanced(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), tapMat, taps));
    group.add(instanced(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), stoolMat, stools));
    group.add(instanced(new THREE.BoxGeometry(W - 6, 0.3, 1.6), std(0x3d7fb8, { metalness: 0.6, roughness: 0.15 }), basins));
    facilities.wudu.push({ pos: new THREE.Vector3(x0, 10, w.z), label: w.label, taps: taps.length });
  });
  // Washroom blocks
  const wcMat = std(0xe9e4da, { roughness: 0.7 });
  const wcSignMat = new THREE.MeshStandardMaterial({ color: 0x1f6fb8, emissive: 0x1f6fb8, emissiveIntensity: 0.4 });
  const wcList = [], wcSigns = [];
  for (const x of [-180, -120, 0, 90]) for (const z of [-232, 232]) { wcList.push({ x, y: 3, z }); wcSigns.push({ x, y: 6.4, z: z - Math.sign(z) * 6.1, ry: z > 0 ? Math.PI : 0 }); }
  for (const z of [-90, 90]) { wcList.push({ x: 262, y: 3, z }); wcSigns.push({ x: 262 - 6.1, y: 6.4, z, ry: -Math.PI / 2 }); }
  group.add(instanced(new THREE.BoxGeometry(24, 6, 12), wcMat, wcList, { castShadow: true }));
  group.add(instanced(new THREE.PlaneGeometry(4, 1.6), wcSignMat, wcSigns));
  wcList.forEach(w => facilities.washrooms.push(new THREE.Vector3(w.x, 8, w.z)));
  // Drinking water stalls
  const kioskMat = std(0xffffff), kioskRoof = new THREE.MeshStandardMaterial({ color: 0x18a0d8, emissive: 0x18a0d8, emissiveIntensity: 0.2 });
  const kiosks = [];
  for (let x = -200; x <= 200; x += 50) for (const z of [-178, 178]) kiosks.push({ x, y: 1.3, z });
  for (const z of [-60, 0, 60]) kiosks.push({ x: 240, y: 1.3, z });
  group.add(instanced(new THREE.BoxGeometry(2.4, 2.6, 2), kioskMat, kiosks));
  group.add(instanced(new THREE.ConeGeometry(2.2, 1.2, 4), kioskRoof, kiosks.map(k => ({ ...k, y: 3.2, ry: Math.PI / 4 }))));
  kiosks.forEach(k => facilities.water.push(new THREE.Vector3(k.x, 5, k.z)));

  // Gardens and palms around the mosque
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(620, 560), std(0x4f8a3a, { roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.y = 0.02; lawn.receiveShadow = true; group.add(lawn);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(580, 30), std(0xe2dccf));
  walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.04, 0); group.add(walk);
  [-178, 178].forEach(z => { const w2 = new THREE.Mesh(new THREE.PlaneGeometry(520, 14), std(0xe2dccf)); w2.rotation.x = -Math.PI / 2; w2.position.set(0, 0.05, z); group.add(w2); });
  const palms = [];
  for (let x = -280; x <= 290; x += 22) for (const z of [-190, -168, 168, 190]) palms.push({ x, z });
  for (let z = -250; z <= 250; z += 22) for (const x of [-268, 288]) palms.push({ x, z });

  return { group, nightMats, facilities, palms, hallLight, hallCenter: new THREE.Vector3(hallCX, Y0, 0), Y0 };
}
