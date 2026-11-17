import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, std, canvasTexture, rrPerimeter, rrPoint, rrRingGeometry, rrWallGeometry, instanced } from './util.js';

// Bowl geometry is measured from an inner rounded rectangle just outside the pitch.
export const BOWL = { a: 59.5, b: 41, r: 12 };
const ROW_DEPTH = 0.85;
const SEAT_PITCH = 0.56;

// Three tiers like the Bernabéu: steep upper tier overhanging the lower ones.
const TIERS = [
  { id: 1, d0: 0, y0: 1.1, rows: 26, rise: 0.40, sections: 24 },
  { id: 2, d0: 20, y0: 15.0, rows: 14, rise: 0.52, sections: 28 },
  { id: 3, d0: 30, y0: 26.0, rows: 28, rise: 0.60, sections: 32 },
];

export const CATEGORIES = {
  vip:       { name: 'VIP Club (Tier 2 sideline)', price: 750, color: '#b07cff' },
  lowSide:   { name: 'Lower Sideline',             price: 450, color: '#e8c26a' },
  mid:       { name: 'Middle Tier',                price: 320, color: '#4fc3ff' },
  lowCorner: { name: 'Lower Corner',               price: 300, color: '#ff8a5c' },
  lowEnd:    { name: 'Lower Behind Goal',          price: 200, color: '#ff5c8a' },
  upSide:    { name: 'Upper Sideline',             price: 180, color: '#3f7cff' },
  upEnd:     { name: 'Upper Ends & Corners',       price: 95,  color: '#d7dde6' },
};
export const SELECTED_COLOR = new THREE.Color('#22e07a');
export const SOLD_COLOR = new THREE.Color('#3a3f47');
export const HOVER_COLOR = new THREE.Color('#ffffff');

function categoryFor(tier, p, a, r) {
  const onLong = Math.abs(p.nz) > 0.98 && Math.abs(p.x) < a - r;
  const onShort = Math.abs(p.nx) > 0.98;
  if (tier === 1) return onLong ? 'lowSide' : onShort ? 'lowEnd' : 'lowCorner';
  if (tier === 2) return onLong ? 'vip' : 'mid';
  return onLong ? 'upSide' : 'upEnd';
}

function seatGeometry() {
  const base = new THREE.BoxGeometry(0.46, 0.08, 0.42); base.translate(0, 0.42, 0.02);
  const back = new THREE.BoxGeometry(0.46, 0.46, 0.06); back.translate(0, 0.66, -0.2);
  const leg = new THREE.BoxGeometry(0.08, 0.4, 0.3); leg.translate(0, 0.2, 0);
  return mergeGeometries([base, back, leg]);
}

// Lofts a closed rounded-rect profile: points [{d, y}] become a solid shell.
function loftBowl(profile, segs = 200) {
  const { a, b, r } = BOWL;
  const pos = [], idx = [];
  profile.forEach(({ d, y }) => {
    const P = rrPerimeter(a + d, b + d, r + d);
    for (let i = 0; i <= segs; i++) {
      const p = rrPoint(a + d, b + d, r + d, (i / segs) * P);
      pos.push(p.x, y, p.z);
    }
  });
  const n = segs + 1;
  for (let j = 0; j < profile.length - 1; j++) {
    for (let i = 0; i < segs; i++) {
      const k = j * n + i;
      idx.push(k, k + n, k + 1, k + 1, k + n, k + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function pitchTexture() {
  // 1 px = 0.1 m. Canvas covers 124 x 86 m (pitch 105 x 68 + run-off)
  return canvasTexture(1240, 860, (c, w, h) => {
    const S = 10, ox = (124 - 105) / 2 * S, oy = (86 - 68) / 2 * S;
    for (let i = 0; i < 18; i++) {
      c.fillStyle = i % 2 ? '#2f8a3a' : '#2a7d34';
      c.fillRect((i * w) / 18, 0, w / 18 + 1, h);
    }
    c.strokeStyle = 'rgba(255,255,255,.92)';
    c.lineWidth = 1.2 * S / 10 * 1.0 + 0.8;
    const L = (x, y, ww, hh) => c.strokeRect(ox + x * S, oy + y * S, ww * S, hh * S);
    L(0, 0, 105, 68);
    c.beginPath(); c.moveTo(ox + 52.5 * S, oy); c.lineTo(ox + 52.5 * S, oy + 68 * S); c.stroke();
    c.beginPath(); c.arc(ox + 52.5 * S, oy + 34 * S, 9.15 * S, 0, Math.PI * 2); c.stroke();
    L(0, 34 - 20.16, 16.5, 40.32); L(105 - 16.5, 34 - 20.16, 16.5, 40.32);
    L(0, 34 - 9.16, 5.5, 18.32); L(105 - 5.5, 34 - 9.16, 5.5, 18.32);
    c.fillStyle = '#fff';
    [[52.5, 34], [11, 34], [94, 34]].forEach(([x, y]) => { c.beginPath(); c.arc(ox + x * S, oy + y * S, 3, 0, 7); c.fill(); });
    c.beginPath(); c.arc(ox + 11 * S, oy + 34 * S, 9.15 * S, -0.93, 0.93); c.stroke();
    c.beginPath(); c.arc(ox + 94 * S, oy + 34 * S, 9.15 * S, Math.PI - 0.93, Math.PI + 0.93); c.stroke();
  }, { repeat: [1, 1] });
}

function bandTexture() {
  return canvasTexture(4096, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#0d1b3d'); g.addColorStop(0.5, '#1d0f3a'); g.addColorStop(1, '#0d1b3d');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) {
      const x0 = k * w / 2;
      c.font = '800 120px Outfit, sans-serif';
      c.fillText('AL YASMEEN STADIUM', x0 + 80, h / 2 + 6);
      c.fillStyle = '#e8c26a';
      c.font = '700 120px Amiri, serif';
      c.fillText('ملعب الياسمين', x0 + 1450, h / 2 + 10);
      c.fillStyle = '#ffffff';
    }
  }, { repeat: [3, 1] });
}

function screenTexture() {
  return canvasTexture(1024, 512, (c, w, h) => {
    c.fillStyle = '#050a16'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8c26a'; c.font = '800 64px Outfit, sans-serif'; c.textAlign = 'center';
    c.fillText('AL YASMEEN FC', w / 2, 110);
    c.fillStyle = '#fff'; c.font = '800 190px Outfit, sans-serif';
    c.fillText('2 - 1', w / 2, 320);
    c.font = '600 54px Outfit, sans-serif'; c.fillStyle = '#9fb0c8';
    c.fillText("GULF STARS  ·  78'", w / 2, 430);
  });
}

export function buildStadium() {
  const group = new THREE.Group();
  group.name = 'stadium';
  const { a, b, r } = BOWL;
  const nightMats = []; // materials that glow at night

  // ---- Pitch & surroundings ----
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(124, 86), std(0xffffff, { map: pitchTexture(), roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.05; pitch.receiveShadow = true;
  group.add(pitch);
  pitch.material.emissiveMap = pitch.material.map;
  nightMats.push({ mat: pitch.material, emissive: new THREE.Color(0xffffff), intensity: 0.32 });

  const apron = new THREE.Mesh(rrRingGeometry(a + 1, b + 1, r + 1, 62, 43, 2), std(0x2b5c34, { roughness: 1 }));
  apron.position.y = 0.04; group.add(apron);

  // Goals
  const postMat = std(0xffffff, { roughness: 0.3 });
  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 });
  [-1, 1].forEach(side => {
    const g = new THREE.Group();
    const post = new THREE.CylinderGeometry(0.07, 0.07, 2.44, 8);
    [-3.66, 3.66].forEach(z => { const m = new THREE.Mesh(post, postMat); m.position.set(0, 1.22, z); g.add(m); });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.32, 8), postMat);
    bar.rotation.x = Math.PI / 2; bar.position.y = 2.44; g.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2, 2.44, 7.32, 4, 4, 10), netMat);
    net.position.set(side * 1, 1.22, 0); g.add(net);
    g.position.x = side * 52.5;
    group.add(g);
  });

  // Dugouts and player tunnel (south side)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, transmission: 0.6, transparent: true, opacity: 0.45, roughness: 0.1 });
  [-12, 12].forEach(x => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 9, 16, 1, true, 0, Math.PI), glass);
    d.rotation.z = Math.PI / 2; d.rotation.y = Math.PI; d.position.set(x, 0.2, 38); group.add(d);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.5, 0.8), std(0x1a2c5a)); bench.position.set(x, 0.4, 38.6); group.add(bench);
  });
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 3), std(0x111318));
  tunnel.position.set(0, 1.6, 41.2); group.add(tunnel);
  const tunnelCover = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 8, 20, 1, true, 0, Math.PI), std(0xe8e8ee, { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.3 }));
  tunnelCover.rotation.x = Math.PI / 2; tunnelCover.rotation.y = Math.PI / 2; tunnelCover.position.set(0, 0, 38); group.add(tunnelCover);

  // ---- Bowl structure (concrete) ----
  const concrete = std(0x9aa1ab, { roughness: 0.9, side: THREE.DoubleSide });
  const t1 = TIERS[0], t2 = TIERS[1], t3 = TIERS[2];
  const end = t => ({ d: t.d0 + t.rows * ROW_DEPTH, y: t.y0 + t.rows * t.rise });
  const e1 = end(t1), e2 = end(t2), e3 = end(t3);
  const shell = [
    loftBowl([{ d: -0.6, y: 0 }, { d: -0.6, y: t1.y0 }, { d: 0, y: t1.y0 }, { d: e1.d, y: e1.y }, { d: e1.d + 0.5, y: e1.y + 1 }, { d: e1.d + 0.5, y: 0 }]),
    loftBowl([{ d: t2.d0 - 0.6, y: t2.y0 - 2 }, { d: t2.d0 - 0.6, y: t2.y0 }, { d: t2.d0, y: t2.y0 }, { d: e2.d, y: e2.y }, { d: e2.d + 0.5, y: e2.y + 1 }, { d: e2.d + 0.5, y: 0 }]),
    loftBowl([{ d: t3.d0 - 0.6, y: t3.y0 - 2 }, { d: t3.d0 - 0.6, y: t3.y0 }, { d: t3.d0, y: t3.y0 }, { d: e3.d, y: e3.y }, { d: e3.d + 0.6, y: e3.y + 1.2 }, { d: e3.d + 0.6, y: 0 }]),
  ];
  shell.forEach(g => { const m = new THREE.Mesh(g, concrete); m.receiveShadow = true; m.castShadow = true; group.add(m); });

  // LED advertising ring on the tier-2 fascia
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 1, emissiveMap: bandTexture() });
  const led = new THREE.Mesh(rrWallGeometry(a + t2.d0 - 0.65, b + t2.d0 - 0.65, r + t2.d0 - 0.65, 1.6, 240), ledMat);
  ledMat.side = THREE.DoubleSide;
  led.position.y = t2.y0 - 1.7; group.add(led);

  // ---- Seats ----
  const seatGeo = seatGeometry();
  const seatMat = std(0xffffff, { roughness: 0.55 });
  const random = rng(2026);
  const sections = [];
  const color = new THREE.Color();
  const dummy = new THREE.Object3D();
  let totalSeats = 0;

  for (const tier of TIERS) {
    for (let k = 0; k < tier.sections; k++) {
      const seats = [];
      for (let row = 0; row < tier.rows; row++) {
        const d = tier.d0 + row * ROW_DEPTH + 0.4;
        const A = a + d, B = b + d, R = r + d;
        const P = rrPerimeter(A, B, R);
        const s0 = ((k - 0.5) / tier.sections) * P + 0.9;
        const s1 = ((k + 0.5) / tier.sections) * P - 0.3;
        const n = Math.floor((s1 - s0) / SEAT_PITCH);
        for (let i = 0; i < n; i++) {
          const p = rrPoint(A, B, R, s0 + (i + 0.5) * SEAT_PITCH);
          seats.push({ row: row + 1, num: i + 1, x: p.x, y: tier.y0 + row * tier.rise, z: p.z, ry: Math.atan2(-p.nx, -p.nz) });
        }
      }
      // section category from its centre on the front row
      const P0 = rrPerimeter(a + tier.d0, b + tier.d0, r + tier.d0);
      const pc = rrPoint(a + tier.d0, b + tier.d0, r + tier.d0, (k / tier.sections) * P0);
      const cat = categoryFor(tier.id, pc, a + tier.d0, r + tier.d0);
      const mesh = new THREE.InstancedMesh(seatGeo, seatMat, seats.length);
      const base = new THREE.Color(CATEGORIES[cat].color);
      const state = new Uint8Array(seats.length); // 0 free, 1 sold, 2 selected
      seats.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(0, s.ry, 0); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        const sold = random() < 0.36;
        state[i] = sold ? 1 : 0;
        mesh.setColorAt(i, sold ? SOLD_COLOR : base);
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = false; mesh.receiveShadow = true;
      const name = `${tier.id}${String(k + 1).padStart(2, '0')}`;
      const mid = seats[Math.floor(seats.length / 2)];
      const sec = { name, tier: tier.id, cat, base, mesh, seats, state, center: new THREE.Vector3(pc.x, tier.y0 + tier.rows * tier.rise * 0.5, pc.z), normal: new THREE.Vector3(pc.nx, 0, pc.nz), mid };
      mesh.userData.section = sec;
      sections.push(sec);
      group.add(mesh);
      totalSeats += seats.length;
    }
  }

  // ---- Bernabéu-style facade: wrapping steel ribbons + skin ----
  const fd = e3.d + 1.5;
  const FA = a + fd, FB = b + fd, FR = r + fd;
  const skin = new THREE.Mesh(rrWallGeometry(FA - 0.8, FB - 0.8, FR - 0.8, 50, 240), std(0x1b2432, { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }));
  group.add(skin);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.9, roughness: 0.28, emissive: 0x000000 });
  nightMats.push({ mat: ribbonMat, emissive: new THREE.Color(0x4a7dff), intensity: 0.55 });
  const PF = rrPerimeter(FA, FB, FR);
  const ribbons = [];
  const nR = Math.floor(PF / 2.2);
  for (let i = 0; i < nR; i++) {
    const p = rrPoint(FA, FB, FR, (i / nR) * PF);
    ribbons.push({ x: p.x, y: 25, z: p.z, ry: Math.atan2(p.nx, p.nz) + 0.35 });
  }
  const ribbonMesh = instanced(new THREE.BoxGeometry(1.5, 50, 0.25), ribbonMat, ribbons, { castShadow: true });
  group.add(ribbonMesh);
  // horizontal bands
  [0.5, 12, 51].forEach(y => {
    const band = new THREE.Mesh(rrWallGeometry(FA + 0.4, FB + 0.4, FR + 0.4, 1.2, 240), std(0xeef1f5, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }));
    band.position.y = y; group.add(band);
  });
  // 360° video screen band around the facade (like the Bernabéu)
  const screenBandMat = new THREE.MeshStandardMaterial({ color: 0x0b0f18, emissive: 0xffffff, emissiveMap: bandTexture(), emissiveIntensity: 0.9, side: THREE.DoubleSide });
  screenBandMat.emissiveMap.repeat.set(4, 1);
  const screenBand = new THREE.Mesh(rrWallGeometry(FA + 0.6, FB + 0.6, FR + 0.6, 7, 260), screenBandMat);
  screenBand.position.y = 36; group.add(screenBand);

  // ---- Roof (fixed ring + retractable panels) ----
  const roofMat = std(0xe9edf2, { metalness: 0.55, roughness: 0.35, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const roofRing = new THREE.Mesh(rrRingGeometry(FA + 1, FB + 1, FR + 1, a - 2, b - 2, Math.max(r - 2, 4), 1.6), roofMat);
  roofRing.position.y = 53; roofRing.castShadow = true; group.add(roofRing);
  const lightStripMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff4d6, emissiveIntensity: 0.0, side: THREE.DoubleSide, transparent: true });
  nightMats.push({ mat: lightStripMat, emissive: new THREE.Color(0xfff4d6), intensity: 2.2, keepDay: 0.2 });
  const lightStrip = new THREE.Mesh(rrWallGeometry(a - 2, b - 2, Math.max(r - 2, 4), 1.4, 200), lightStripMat);
  lightStrip.position.y = 51.4; group.add(lightStrip);
  // ribs on roof
  const ribMat = std(0xb8c0cc, { metalness: 0.7, roughness: 0.3, transparent: true });
  const ribList = [];
  const PR = rrPerimeter(a + 25, b + 25, r + 25);
  for (let i = 0; i < 64; i++) {
    const p = rrPoint(a + 25, b + 25, r + 25, (i / 64) * PR);
    ribList.push({ x: p.x, y: 53.9, z: p.z, ry: Math.atan2(p.nx, p.nz) });
  }
  const ribs = instanced(new THREE.BoxGeometry(0.8, 1.2, 54), ribMat, ribList);
  group.add(ribs);

  const panelMat = std(0xdfe5ee, { metalness: 0.6, roughness: 0.3, transparent: true, side: THREE.DoubleSide });
  const panelGeo = new THREE.BoxGeometry(a + 1, 1, 2 * b + 2, 8, 1, 8);
  const panels = [-1, 1].map(side => {
    const m = new THREE.Mesh(panelGeo, panelMat);
    m.position.set(side * (a / 2 + a), 55, 0); m.castShadow = true;
    m.userData = { side, open: side * (a / 2 + a), closed: side * (a / 2 - 0.5) };
    group.add(m); return m;
  });

  // Hanging video boards at both ends
  const scrMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTexture(), emissiveIntensity: 1 });
  [-1, 1].forEach(side => {
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), scrMat);
    sc.position.set(side * (a - 1), 46, 0); sc.rotation.y = -side * Math.PI / 2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9.8, 18.8), std(0x111111));
    frame.position.set(side * (a - 0.6), 46, 0);
    group.add(frame, sc);
  });

  // ---- Plaza around the stadium ----
  const plaza = new THREE.Mesh(rrRingGeometry(FA + 40, FB + 40, FR + 40, FA - 1, FB - 1, FR - 1), std(0xcfc6b4, { roughness: 0.95 }));
  plaza.position.y = 0.03; plaza.receiveShadow = true; group.add(plaza);

  const roof = {
    mats: [roofMat, panelMat, ribMat],
    panels, opacity: 1, targetOpacity: 1, closed: false,
    setClosed(v) { this.closed = v; },
    update(dt) {
      const k = 1 - Math.exp(-dt * 2.2);
      panels.forEach(p => { p.position.x += ((this.closed ? p.userData.closed : p.userData.open) - p.position.x) * k; });
      this.opacity += (this.targetOpacity - this.opacity) * (1 - Math.exp(-dt * 4));
      const o = this.opacity;
      this.mats.forEach(m => { m.opacity = o; m.depthWrite = o > 0.95; });
      roofRing.visible = ribs.visible = o > 0.02;
      roofRing.castShadow = o > 0.5;
      panels.forEach(p => { p.visible = o > 0.02; p.castShadow = o > 0.5; });
    },
  };

  return { group, sections, totalSeats, roof, nightMats, facade: { FA, FB, FR }, tiers: TIERS, categories: CATEGORIES };
}
