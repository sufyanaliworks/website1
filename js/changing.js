import * as THREE from 'three';
import { std, canvasTexture, instanced } from './util.js';

// Underground dressing rooms below the south stand, inspired by modern
// Bernabéu-style rooms: personal lockers, central crest, hydrotherapy, tunnel.
export const ROOMS_Y = -40;

function shirtTexture(num, name, main, trim) {
  return canvasTexture(256, 300, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = main;
    c.beginPath();
    c.moveTo(70, 10); c.lineTo(186, 10); c.lineTo(250, 60); c.lineTo(220, 110); c.lineTo(196, 92);
    c.lineTo(196, 290); c.lineTo(60, 290); c.lineTo(60, 92); c.lineTo(36, 110); c.lineTo(6, 60); c.closePath(); c.fill();
    c.fillStyle = trim; c.fillRect(60, 280, 136, 10);
    c.beginPath(); c.arc(128, 10, 26, 0, Math.PI); c.fill();
    c.fillStyle = trim; c.textAlign = 'center';
    c.font = '700 26px Outfit, sans-serif'; c.fillText(name, 128, 80);
    c.font = '800 120px Outfit, sans-serif'; c.fillText(String(num), 128, 210);
  }, { srgb: true });
}

function crestTexture(text, col) {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
    c.strokeStyle = col; c.lineWidth = 14;
    c.beginPath(); c.arc(256, 256, 230, 0, 7); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.arc(256, 256, 200, 0, 7); c.stroke();
    c.fillStyle = col; c.textAlign = 'center';
    c.font = '800 64px Outfit, sans-serif'; c.fillText(text, 256, 240);
    c.font = '700 60px Amiri, serif'; c.fillText('الياسمين', 256, 320);
    c.font = '600 28px Outfit, sans-serif'; c.fillText('AJMAN · UAE', 256, 380);
  });
}

function tacticsTexture() {
  return canvasTexture(800, 500, (c, w, h) => {
    c.fillStyle = '#1f6b34'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.strokeRect(20, 20, w - 40, h - 40);
    c.beginPath(); c.moveTo(w / 2, 20); c.lineTo(w / 2, h - 20); c.stroke();
    c.beginPath(); c.arc(w / 2, h / 2, 60, 0, 7); c.stroke();
    const f = [[80, 250], [200, 110], [190, 210], [190, 290], [200, 390], [320, 170], [320, 330], [300, 250], [450, 120], [450, 380], [500, 250]];
    f.forEach(([x, y], i) => { c.fillStyle = '#e8c26a'; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill(); c.fillStyle = '#111'; c.font = '700 18px Outfit'; c.textAlign = 'center'; c.fillText(i + 1, x, y + 6); });
    c.strokeStyle = '#ff5c5c'; c.lineWidth = 5; c.setLineDash([12, 10]);
    c.beginPath(); c.moveTo(320, 170); c.quadraticCurveTo(420, 60, 560, 160); c.stroke();
    c.beginPath(); c.moveTo(300, 250); c.lineTo(600, 250); c.stroke();
  });
}

function buildRoom({ x, title, main, trim, wallCol, accent, players }) {
  const g = new THREE.Group();
  const W = 34, D = 22, H = 5.5;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), std(wallCol, { side: THREE.BackSide, roughness: 0.6 }));
  shell.position.y = H / 2; g.add(shell);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x2a2522, { roughness: 0.35, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; g.add(floor);
  // carpet oval with crest
  const oval = new THREE.Mesh(new THREE.CircleGeometry(6, 64), std(accent, { roughness: 1 }));
  oval.scale.set(1.6, 1, 1); oval.rotation.x = -Math.PI / 2; oval.position.y = 0.02; g.add(oval);
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ map: crestTexture(title.toUpperCase(), trim), transparent: true }));
  crest.rotation.x = -Math.PI / 2; crest.position.y = 0.03; g.add(crest);

  // ceiling light strips
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dd, emissiveIntensity: 1.6 });
  const strips = [];
  for (let i = -2; i <= 2; i++) strips.push({ x: i * 6, y: H - 0.05, z: 0 });
  g.add(instanced(new THREE.BoxGeometry(0.4, 0.06, D - 6), lightMat, strips));
  const oc = new THREE.Mesh(new THREE.TorusGeometry(7, 0.18, 8, 64), lightMat); oc.scale.set(1.6, 1, 1); oc.rotation.x = Math.PI / 2; oc.position.y = H - 0.1; g.add(oc);
  [-8, 8].forEach(lx => { const pl = new THREE.PointLight(0xfff0dc, 30, 30, 1.6); pl.position.set(lx, H - 0.8, 0); g.add(pl); });

  // lockers on 3 walls with shirts hanging and benches
  const lockerMat = std(0x3b2c22, { roughness: 0.4 });
  const trimMat = std(trim, { metalness: 0.9, roughness: 0.3 });
  const benchMat = std(main === '#ffffff' ? 0xf3f3f3 : 0x1b2c58, { roughness: 0.6 });
  let n = 0;
  const place = (px, pz, ry) => {
    const lk = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 3.2, 0.7), lockerMat); box.position.y = 1.6; lk.add(box);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.72), trimMat); plate.position.y = 3.2; lk.add(plate);
    const p = players[n % players.length];
    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.12), new THREE.MeshStandardMaterial({ map: shirtTexture(p[0], p[1], main, trim), transparent: true, side: THREE.DoubleSide }));
    shirt.position.set(0, 2.1, 0.37); lk.add(shirt);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.6), benchMat); seat.position.set(0, 0.5, 0.75); lk.add(seat);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.3), std(accent)); bag.position.set(0.2, 0.18, 0.2); lk.add(bag);
    lk.position.set(px, 0, pz); lk.rotation.y = ry; g.add(lk); n++;
  };
  for (let i = 0; i < 12; i++) place(-W / 2 + 4 + i * 2.35, -D / 2 + 0.4, 0);
  for (let i = 0; i < 6; i++) place(-W / 2 + 0.4, -D / 2 + 3 + i * 1.6 * 1.3, Math.PI / 2);
  for (let i = 0; i < 6; i++) place(W / 2 - 0.4, -D / 2 + 3 + i * 1.6 * 1.3, -Math.PI / 2);

  // tactics board + TV on the front wall
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4), new THREE.MeshStandardMaterial({ map: tacticsTexture(), emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: null }));
  board.position.set(-6, 2.8, D / 2 - 0.05); board.rotation.y = Math.PI; g.add(board);
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.9), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2a6fd8, emissiveIntensity: 0.7 }));
  tv.position.set(6, 2.9, D / 2 - 0.05); tv.rotation.y = Math.PI; g.add(tv);
  // massage / physio tables
  [-3, 3].forEach(tz => { const t = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.8), std(0x111111)); t.position.set(13, 0.6, tz + 5); g.add(t); });

  g.position.set(x, ROOMS_Y, 0);
  return g;
}

export function buildChangingRooms() {
  const group = new THREE.Group();
  group.name = 'changing';
  const homePlayers = [[1, 'AL HASHMI'], [2, 'SAEED'], [3, 'OMAR'], [4, 'KHALIFA'], [5, 'RASHID'], [6, 'YOUSEF'], [7, 'HAMDAN'], [8, 'ALI'], [9, 'ZAYED'], [10, 'FAHAD'], [11, 'MANSOOR'], [14, 'IBRAHIM'], [17, 'SULTAN'], [19, 'MAJID'], [21, 'HAMAD'], [22, 'NASSER'], [23, 'SAIF'], [30, 'BILAL'], [33, 'AHMED'], [44, 'KHALID'], [77, 'JASSIM'], [88, 'ADEL'], [99, 'TARIQ'], [25, 'SALEM']];
  const awayPlayers = homePlayers.map(([n], i) => [n, ['GUEST', 'VISITOR', 'AWAY'][i % 3]]);
  const home = buildRoom({ x: -22, title: 'Al Yasmeen', main: '#ffffff', trim: '#c9a24a', wallCol: 0xf2efe8, accent: 0x6b2a8a, players: homePlayers });
  const away = buildRoom({ x: 22, title: 'Visitors', main: '#1b2c58', trim: '#ffffff', wallCol: 0xd9dee7, accent: 0x1b2c58, players: awayPlayers });
  group.add(home, away);

  // Hydrotherapy suite between rooms (ice bath, hot pool, showers)
  const spa = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(10, 5.5, 22), std(0x0f2a3a, { side: THREE.BackSide })); shell.position.y = 2.75; spa.add(shell);
  const tiles = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#d9e4ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9fb5c2'; c.lineWidth = 3; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); } }, { repeat: [5, 11] });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 22), std(0xffffff, { map: tiles, roughness: 0.3 })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; spa.add(fl);
  [[-5, 0x7fd6ff, 'ice'], [3, 0xffb27a, 'hot']].forEach(([z, col]) => {
    const pool = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 5), std(0xe9eef2)); pool.position.set(0, 0.45, z); spa.add(pool);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.4), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.85 }));
    w.rotation.x = -Math.PI / 2; w.position.set(0, 0.92, z); spa.add(w);
  });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25, roughness: 0.05 });
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.4, 1.6), glass); p.position.set(-4.2 + 0, 1.2, 7 + i * 1.6 - 1); spa.add(p);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), std(0xcccccc, { metalness: 1 })); head.position.set(-4.6, 2.6, 7.8 + i * 1.6 - 1); spa.add(head);
  }
  const spaLight = new THREE.PointLight(0x9fdcff, 20, 22, 1.5); spaLight.position.set(0, 4.6, 0); spa.add(spaLight);
  spa.position.set(0, ROOMS_Y, 0);
  group.add(spa);

  // Players' tunnel (corridor toward the pitch)
  const tunnel = new THREE.Group();
  const tShell = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 60), std(0x15171c, { side: THREE.BackSide })); tShell.position.y = 2.25; tunnel.add(tShell);
  const tFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), std(0x2b5c34)); tFloor.rotation.x = -Math.PI / 2; tFloor.position.y = 0.01; tunnel.add(tFloor);
  const wallLeds = [];
  for (let z = -28; z <= 28; z += 4) for (const s of [-1, 1]) wallLeds.push({ x: s * 3.95, y: 2.2, z, ry: s * -Math.PI / 2 });
  tunnel.add(instanced(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xc9a24a, emissiveIntensity: 0.8, side: THREE.DoubleSide }), wallLeds));
  const exitGlow = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshBasicMaterial({ color: 0xfff6dd }));
  exitGlow.position.set(0, 2.25, 29.9); exitGlow.rotation.y = Math.PI; tunnel.add(exitGlow);
  const tl = new THREE.PointLight(0xffe2a8, 18, 40, 1.4); tl.position.set(0, 3.8, 0); tunnel.add(tl);
  tunnel.position.set(0, ROOMS_Y, 41);
  group.add(tunnel);

  return { group };
}
