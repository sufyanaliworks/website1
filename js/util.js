import * as THREE from 'three';

// Deterministic random numbers so sold seats / trees are the same on every visit.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Rounded rectangle (stadium bowl) helpers --------------------------------
// Half sizes a (x), b (z), corner radius r. Parameter u in [0,1) walks the loop.
export function rrPerimeter(a, b, r) {
  return 4 * (a - r) + 4 * (b - r) + 2 * Math.PI * r;
}

// Returns {x, z, nx, nz} for position along a rounded rectangle at arc-length s.
export function rrPoint(a, b, r, s) {
  const sx = 2 * (a - r), sz = 2 * (b - r), q = (Math.PI * r) / 2;
  const segs = [sx, q, sz, q, sx, q, sz, q];
  const P = segs.reduce((p, v) => p + v, 0);
  s = ((s % P) + P) % P;
  // start at middle of +z side (south long side), heading +x
  let i = 0;
  // offset so s=0 is the middle of the first straight
  s += sx / 2;
  if (s >= P) s -= P;
  while (s > segs[i]) { s -= segs[i]; i = (i + 1) % 8; }
  const ar = a - r, br = b - r;
  switch (i) {
    case 0: return { x: -ar + s, z: b, nx: 0, nz: 1 };
    case 1: { const t = s / r; return { x: ar + Math.sin(t) * r, z: br + Math.cos(t) * r, nx: Math.sin(t), nz: Math.cos(t) }; }
    case 2: return { x: a, z: br - s, nx: 1, nz: 0 };
    case 3: { const t = s / r; return { x: ar + Math.cos(t) * r, z: -br - Math.sin(t) * r, nx: Math.cos(t), nz: -Math.sin(t) }; }
    case 4: return { x: ar - s, z: -b, nx: 0, nz: -1 };
    case 5: { const t = s / r; return { x: -ar - Math.sin(t) * r, z: -br - Math.cos(t) * r, nx: -Math.sin(t), nz: -Math.cos(t) }; }
    case 6: return { x: -a, z: -br + s, nx: -1, nz: 0 };
    default: { const t = s / r; return { x: -ar - Math.cos(t) * r, z: br + Math.sin(t) * r, nx: -Math.cos(t), nz: Math.sin(t) }; }
  }
}

export function rrShape(a, b, r, shape = new THREE.Shape()) {
  shape.moveTo(-a + r, -b);
  shape.lineTo(a - r, -b);
  shape.absarc(a - r, -b + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(a, b - r);
  shape.absarc(a - r, b - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-a + r, b);
  shape.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-a, -b + r);
  shape.absarc(-a + r, -b + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

export function rrPath(a, b, r) {
  const p = new THREE.Path();
  return rrShape(a, b, r, p);
}

// Ring (rounded rect with a rounded-rect hole) lying flat, top at y = 0
export function rrRingGeometry(a1, b1, r1, a2, b2, r2, depth = 0) {
  const s = rrShape(a1, b1, r1);
  s.holes.push(rrPath(a2, b2, r2));
  const g = depth > 0
    ? new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 24 })
    : new THREE.ShapeGeometry(s, 24);
  g.rotateX(-Math.PI / 2); // faces point up; extrusion goes up
  if (depth > 0) g.translate(0, -depth, 0); // keep top at y = 0
  return g;
}

// Vertical wall following a rounded rectangle, open top/bottom
export function rrWallGeometry(a, b, r, h, segs = 160) {
  const P = rrPerimeter(a, b, r);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const p = rrPoint(a, b, r, (i / segs) * P);
    pos.push(p.x, 0, p.z, p.x, h, p.z);
    uv.push(i / segs, 0, i / segs, 1);
    if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- Canvas textures ---------------------------------------------------------
export function canvasTexture(w, h, draw, { repeat = [1, 1], aniso = 8, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
}

// Place many copies of one geometry. transforms: [{x,y,z, ry, sx,sy,sz, color}]
export function instanced(geo, mat, list, { castShadow = false, receiveShadow = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  const o = new THREE.Object3D();
  const col = new THREE.Color();
  list.forEach((t, i) => {
    o.position.set(t.x || 0, t.y || 0, t.z || 0);
    o.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
    o.scale.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (t.color !== undefined) m.setColorAt(i, col.set(t.color));
  });
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  m.computeBoundingSphere();
  return m;
}
