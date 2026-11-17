import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ease, clamp } from './util.js';
import { buildStadium, CATEGORIES, SELECTED_COLOR, SOLD_COLOR, HOVER_COLOR } from './stadium.js';
import { buildMosque } from './mosque.js';
import { buildDistrict, addPalms } from './district.js';
import { buildChangingRooms, ROOMS_Y } from './changing.js';

const $ = s => document.querySelector(s);
const loadbar = $('#loadbar');
const step = async (pct) => { loadbar.style.width = pct + '%'; await new Promise(r => setTimeout(r, 30)); };

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const container = $('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
container.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 30000);
camera.position.set(2600, 1600, 2800);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2;
controls.maxDistance = 6000;
controls.zoomSpeed = 1.1;

// ---------------------------------------------------------------------------
// Sky, sun, lights, stars
// ---------------------------------------------------------------------------
const sky = new Sky();
sky.scale.setScalar(25000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 4;
skyU.rayleigh.value = 1.4;
skyU.mieCoefficient.value = 0.004;
skyU.mieDirectionalG.value = 0.8;

const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -1300; sc.right = 1300; sc.top = 1300; sc.bottom = -1300; sc.near = 10; sc.far = 4000;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
sun.target.position.set(150, 0, -100);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xb89a6a, 0.9);
scene.add(hemi);

const starGeo = new THREE.BufferGeometry();
{
  const p = [];
  for (let i = 0; i < 4000; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 14000;
    const y = Math.abs(u) * r, rr = Math.sqrt(1 - u * u) * r;
    p.push(Math.cos(th) * rr, y, Math.sin(th) * rr);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
scene.add(stars);
scene.fog = new THREE.Fog(0xcfd8e3, 3000, 14000);

const pmrem = new THREE.PMREMGenerator(renderer);
function envFromSky() {
  const s = new THREE.Scene();
  const sk = new Sky(); sk.scale.setScalar(1000);
  Object.keys(skyU).forEach(k => { sk.material.uniforms[k].value = skyU[k].value?.clone ? skyU[k].value.clone() : skyU[k].value; });
  s.add(sk);
  return pmrem.fromScene(s).texture;
}

// ---------------------------------------------------------------------------
// Build world
// ---------------------------------------------------------------------------
let stadium, mosque, district, rooms;
const nightMats = [];
const labelObjs = [];

function addLabel({ text, pos, group, go, small, onClick }) {
  const el = document.createElement('div');
  el.className = 'label3d' + (small ? ' small' : '');
  el.innerHTML = text;
  if (go || onClick) el.addEventListener('click', e => { e.stopPropagation(); onClick ? onClick() : goTo(go); });
  const obj = new CSS2DObject(el);
  obj.position.copy(pos);
  scene.add(obj);
  labelObjs.push({ obj, el, group, main: !!go });
}

const sunPos = new THREE.Vector3();
let envDay, envNight;

async function build() {
  await document.fonts.ready.catch(() => {});
  await step(10);
  stadium = buildStadium();
  scene.add(stadium.group);
  nightMats.push(...stadium.nightMats);
  await step(40);

  mosque = buildMosque();
  addPalms(mosque.group, mosque.palms);
  mosque.group.position.set(-60, 0, -700);
  mosque.group.rotation.y = 0.26; // prayer hall faces the qibla (west-south-west from Ajman)
  scene.add(mosque.group);
  mosque.group.updateMatrixWorld(true);
  nightMats.push(...mosque.nightMats);
  await step(60);

  district = buildDistrict(scene);
  scene.add(district.group);
  nightMats.push(...district.nightMats);
  await step(80);

  rooms = buildChangingRooms();
  rooms.group.position.set(0, 0, 60);
  scene.add(rooms.group);
  await step(88);

  // Labels
  addLabel({ text: '🏟 Al Yasmeen Stadium', pos: new THREE.Vector3(0, 82, 0), go: 'stadium' });
  addLabel({ text: '🕌 Al Yasmeen Grand Mosque', pos: mosque.group.localToWorld(new THREE.Vector3(-140, 125, 0)), go: 'mosque' });
  addLabel({ text: `🅿 Parking · ${district.parking.total.toLocaleString()} spaces`, pos: new THREE.Vector3(-450, 70, 130), go: 'parking' });
  district.labels.forEach(addLabel);
  const W = v => mosque.group.localToWorld(v.clone());
  mosque.facilities.wudu.forEach(w => addLabel({ text: `💧 ${w.label} · ${w.taps} taps`, pos: W(w.pos), group: 'mosque', small: true }));
  mosque.facilities.washrooms.forEach(p => addLabel({ text: '🚻 Washrooms', pos: W(p), group: 'mosque', small: true }));
  mosque.facilities.water.forEach((p, i) => { if (i % 3 === 0) addLabel({ text: '🚰 Drinking water', pos: W(p), group: 'mosque', small: true }); });
  addLabel({ text: '🕌 Main prayer hall', pos: W(new THREE.Vector3(-140, 50, 60)), group: 'mosque', small: true, onClick: () => shot(mosqueShots.hall) });
  addLabel({ text: '✿ Floral courtyard', pos: W(new THREE.Vector3(45, 12, 0)), group: 'mosque', small: true, onClick: () => shot(mosqueShots.courtyard) });
  addLabel({ text: '🚪 Changing rooms (below)', pos: new THREE.Vector3(0, 8, 44), group: 'stadium', small: true, onClick: () => goTo('changing') });
  addLabel({ text: '🎟 Pick seats', pos: new THREE.Vector3(0, 48, 70), group: 'stadium', small: true, onClick: () => goTo('seats') });

  // Day/night environment maps
  setSky(35, 200);
  envDay = envFromSky();
  setSky(-6, 200);
  envNight = envFromSky();
  setSky(35, 200);
  scene.environment = envDay;
  await step(100);
}

function setSky(elevDeg, azDeg) {
  const phi = THREE.MathUtils.degToRad(90 - elevDeg), theta = THREE.MathUtils.degToRad(azDeg);
  sunPos.setFromSphericalCoords(1, phi, theta);
  skyU.sunPosition.value.copy(sunPos);
}

// ---------------------------------------------------------------------------
// Day / night (smooth)
// ---------------------------------------------------------------------------
let night = 0, nightTarget = 0;
const fogDay = new THREE.Color(0xcfd8e3), fogNight = new THREE.Color(0x0b1424);
const tmpC = new THREE.Color();
function applyDayNight() {
  const n = night;
  const elev = THREE.MathUtils.lerp(38, -7, n);
  setSky(elev, 200);
  sun.position.copy(sunPos).multiplyScalar(2000).add(sun.target.position);
  if (n > 0.6) { sun.position.set(800, 1500, 900).add(sun.target.position); }
  sun.intensity = n < 0.6 ? THREE.MathUtils.lerp(3.2, 0.2, n / 0.6) : THREE.MathUtils.lerp(0.2, 0.35, (n - 0.6) / 0.4);
  sun.color.set(n > 0.6 ? 0x9db8ff : 0xfff1dc);
  hemi.intensity = THREE.MathUtils.lerp(0.9, 0.22, n);
  hemi.color.set(0xcfe3ff).lerp(tmpC.set(0x5a6fa8), n);
  skyU.rayleigh.value = THREE.MathUtils.lerp(1.4, 0.6, n);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(0.55, 0.7, n);
  scene.fog.color.copy(fogDay).lerp(fogNight, n);
  stars.material.opacity = clamp((n - 0.5) * 2, 0, 1);
  scene.environment = n > 0.5 ? envNight : envDay;
  scene.environmentIntensity = THREE.MathUtils.lerp(1, 0.35, n);
  nightMats.forEach(e => {
    const k = Math.max(e.keepDay || 0, n);
    if (!e.mat.emissive) return;
    e.mat.emissive.copy(e.emissive);
    e.mat.emissiveIntensity = (e.intensity ?? 1) * k;
  });
}

// ---------------------------------------------------------------------------
// Camera flights (drone)
// ---------------------------------------------------------------------------
let flight = null;
function flyTo(pos, target, dur = 3.2, { arc = true } = {}) {
  flight = {
    p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(),
    t: 0, dur, lift: arc ? Math.min(camera.position.distanceTo(pos) * 0.18, 500) : 0,
  };
  controls.enabled = false;
}
function updateFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / flight.dur);
  const k = ease(flight.t);
  camera.position.lerpVectors(flight.p0, flight.p1, k);
  camera.position.y += Math.sin(Math.PI * k) * flight.lift;
  controls.target.lerpVectors(flight.t0, flight.t1, k);
  if (flight.t >= 1) { flight = null; controls.enabled = true; }
}

const fadeEl = $('#fade');
let underground = false;
function jumpTo(pos, target, ug) {
  return new Promise(res => {
    fadeEl.classList.add('on');
    setTimeout(() => {
      flight = null;
      camera.position.copy(pos); controls.target.copy(target);
      underground = ug;
      controls.update();
      setTimeout(() => { fadeEl.classList.remove('on'); res(); }, 120);
    }, 620);
  });
}
function shot(s) {
  const ug = !!s.underground, inside = !!s.inside;
  const wasSpecial = underground || insideNow;
  insideNow = inside;
  controls.maxPolarAngle = ug || inside ? Math.PI * 0.9 : Math.PI * 0.495;
  controls.minDistance = ug || inside ? 0.5 : 2;
  if (ug !== underground || inside || wasSpecial) return jumpTo(s.pos, s.target, ug);
  flyTo(s.pos, s.target, s.dur || 3.2);
}
let insideNow = false;

// Keyboard drone
const keys = {};
addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT') keys[e.code] = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
function updateDrone(dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const u = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
  if (!f && !r && !u) return;
  stopTour();
  camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  right.crossVectors(fwd, camera.up).normalize();
  const dist = camera.position.distanceTo(controls.target);
  const speed = clamp(dist * 0.9, underground || insideNow ? 4 : 20, 1200);
  move.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r).addScaledVector(camera.up, u).multiplyScalar(speed * dt);
  camera.position.add(move); controls.target.add(move);
}

// ---------------------------------------------------------------------------
// Views & info content
// ---------------------------------------------------------------------------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let mosqueShots, roomShots;
function MW(x, y, z) { return mosque.group.localToWorld(V(x, y, z)); }
function RW(x, y, z) { return rooms.group.localToWorld(V(x, y, z)); }

function defineShots() {
  mosqueShots = {
    overview: { pos: MW(470, 190, 380), target: MW(-40, 20, 0) },
    hall: { pos: MW(-95, 9, 40), target: MW(-200, 14, -10), inside: true },
    courtyard: { pos: MW(150, 24, 70), target: MW(-60, 20, -20) },
    minaret: { pos: MW(330, 70, -300), target: MW(212, 70, -152) },
    wudu: { pos: MW(-60, 26, -270), target: MW(-60, 0, -205) },
    washrooms: { pos: MW(-150, 40, 300), target: MW(-150, 0, 232) },
    water: { pos: MW(60, 18, -150), target: MW(0, 2, -178) },
  };
  roomShots = {
    home: { pos: RW(-12, ROOMS_Y + 2.4, 8), target: RW(-28, ROOMS_Y + 1.6, -8), underground: true },
    away: { pos: RW(32, ROOMS_Y + 2.4, 8), target: RW(16, ROOMS_Y + 1.6, -8), underground: true },
    spa: { pos: RW(3.5, ROOMS_Y + 2.6, 9), target: RW(-1, ROOMS_Y + 0.8, -6), underground: true },
    tunnel: { pos: RW(0, ROOMS_Y + 1.8, 15), target: RW(0, ROOMS_Y + 1.8, 70), underground: true },
  };
}

const fmt = n => n.toLocaleString('en-US');
function stat(v, l) { return `<div class="stat"><b>${v}</b><span>${l}</span></div>`; }

const VIEWS = {
  overview: {
    shot: () => ({ pos: V(1500, 1050, 1750), target: V(0, 0, -150) }),
    html: () => `
      <div class="kicker">Ajman · Al Yasmeen</div>
      <h2>Al Yasmeen Sports &amp; Faith District</h2>
      <div class="ar">ملعب الياسمين</div>
      <p>A football stadium with more than 60,000 seats, a grand mosque for 60,000 worshippers, a 68-hectare park and over 100,000 parking spaces, all linked to the E311 and E611 highways.</p>
      <div class="stats">${stat(fmt(stadium.totalSeats), 'stadium seats')}${stat('60,000', 'mosque capacity')}${stat(fmt(district.parking.total), 'parking spaces')}${stat('68 ha', 'Al Yasmeen Park')}</div>
      <div class="chips"><button class="chip" data-go="seats">🎟 Pick seats in 3D</button><button class="chip" data-go="mosque">🕌 Explore the mosque</button><button class="chip" id="chipTour">▶ Drone tour</button></div>`,
  },
  stadium: {
    shot: () => ({ pos: V(240, 120, 250), target: V(0, 15, 0) }),
    html: () => `
      <div class="kicker">Football · Inspired by the Bernabéu</div>
      <h2>Al Yasmeen Stadium</h2>
      <p>Three steep tiers wrap close around the pitch. The outside is clad in steel ribbons with a 360° video band. A retractable roof closes over the pitch in minutes.</p>
      <div class="stats">${stat(fmt(stadium.totalSeats), 'seats in 84 sections')}${stat('105 × 68 m', 'hybrid grass pitch')}${stat('3 tiers', 'lower · VIP club · upper')}${stat('2 + spa', 'changing rooms')}</div>
      <div class="chips">
        <button class="chip" data-shot="pitch">⚽ Pitch level</button>
        <button class="chip" data-shot="roof">🏗 Roof view</button>
        <button class="chip" data-shot="facade">✨ Facade</button>
        <button class="chip" data-go="changing">🚪 Changing rooms</button>
        <button class="chip" data-go="seats">🎟 Pick seats</button>
      </div>`,
    shots: {
      pitch: { pos: V(30, 4, 30), target: V(-40, 8, -10) },
      roof: { pos: V(0, 170, 60), target: V(0, 20, 0) },
      facade: { pos: V(-210, 18, 190), target: V(-60, 30, 60) },
    },
  },
  seats: {
    shot: () => ({ pos: V(0, 185, 165), target: V(0, 0, 0) }),
    html: () => `
      <div class="kicker">Tickets · Matchday (demo fixture)</div>
      <h2>Al Yasmeen FC vs Gulf Stars</h2>
      <p>The roof fades away so you can drone over the bowl. Hover a seat to see whether it's <b>selected</b> or <b>not selected</b> and what it costs. Click to select it. Grey seats are sold.</p>
      <div class="stats">${stat(fmt(stadium.totalSeats), 'seats')}${stat(fmt(countFree()), 'still available')}</div>`,
  },
  changing: {
    shot: () => roomShots.home,
    html: () => `
      <div class="kicker">Below the south stand</div>
      <h2>Changing Rooms</h2>
      <p>The home and away dressing rooms sit on each side of a shared hydrotherapy suite, like a modern Bernabéu layout. Each has 24 personal lockers with benches, a tactics board, physio tables and a lit oval with the club crest. The players' tunnel leads straight up to the pitch.</p>
      <div class="chips">
        <button class="chip" data-room="home">🏠 Home room</button>
        <button class="chip" data-room="away">✈ Away room</button>
        <button class="chip" data-room="spa">❄ Ice bath &amp; showers</button>
        <button class="chip" data-room="tunnel">➡ Players' tunnel</button>
        <button class="chip" data-go="stadium">⬆ Back to the pitch</button>
      </div>`,
  },
  mosque: {
    shot: () => mosqueShots.overview,
    html: () => {
      const taps = mosque.facilities.wudu.reduce((s, w) => s + w.taps, 0);
      return `
      <div class="kicker">Open to visitors · no tickets needed</div>
      <h2>Al Yasmeen Grand Mosque</h2>
      <div class="ar">جامع الياسمين الكبير</div>
      <p>Built at the scale of the Sheikh Zayed Grand Mosque: white marble, a floral courtyard, reflecting pools, many domes and four minarets. The prayer hall faces the qibla. This part of the district is for visiting and prayer only.</p>
      <div class="stats">${stat('60,000', 'worshippers (hall + courtyard)')}${stat('4 × 107 m', 'minarets')}${stat(fmt(taps), 'wudu taps in 4 areas')}${stat(mosque.facilities.washrooms.length + ' blocks', 'washrooms')}${stat(mosque.facilities.water.length, 'drinking water stations')}${stat('~88 m', 'main dome height')}</div>
      <div class="chips">
        <button class="chip" data-mshot="hall">🕌 Inside the prayer hall</button>
        <button class="chip" data-mshot="courtyard">✿ Courtyard</button>
        <button class="chip" data-mshot="wudu">💧 Wudu area</button>
        <button class="chip" data-mshot="washrooms">🚻 Washrooms</button>
        <button class="chip" data-mshot="water">🚰 Drinking water</button>
        <button class="chip" data-mshot="minaret">🗼 Minaret</button>
      </div>`;
    },
  },
  park: {
    shot: () => ({ pos: V(1250, 420, 420), target: V(720, 0, -180) }),
    html: () => `
      <div class="kicker">Green heart of the district</div>
      <h2>Al Yasmeen Park</h2>
      <p>A large park east of the stadium with a lake and island pavilion, about 2,600 shade trees, palm-lined shores, a 2.5 km jogging track, a kids' playground, picnic lawns and an open-air amphitheatre.</p>
      <div class="stats">${stat('68 ha', 'park area')}${stat('2.5 km', 'jogging loop')}${stat('2,600+', 'trees')}${stat('1', 'lake with island')}</div>`,
  },
  parking: {
    shot: () => ({ pos: V(250, 520, 1150), target: V(-180, 0, 300) }),
    html: () => {
      const p = district.parking;
      return `
      <div class="kicker">Park &amp; walk</div>
      <h2>${fmt(p.total)} parking spaces</h2>
      <p>Eight multi-storey garages and four huge surface lots ring the stadium. Every space is less than a 10-minute walk from the gates, with direct exits onto the ring boulevard.</p>
      <div class="stats">${stat(p.garages.length + ' × ' + fmt(p.garages[0].spots), 'garages P1–P8 (8 levels)')}${stat(p.lots.length + ' × ' + fmt(p.lots[0].spots), 'surface lots P9–P12')}${stat(fmt(p.total), 'total spaces')}${stat(fmt(p.parkedCars), 'cars parked right now')}</div>`;
    },
  },
  roads: {
    shot: () => ({ pos: V(-450, 420, 1750), target: V(-1050, 0, 1150) }),
    html: () => `
      <div class="kicker">Getting here</div>
      <h2>Highways &amp; Roads</h2>
      <p>The district sits between Sheikh Mohammed Bin Zayed Road (E311) and Emirates Road (E611), joined by a cloverleaf interchange. Two link roads feed an Al Yasmeen ring boulevard with street lights that reaches every garage and lot.</p>
      <div class="stats">${stat('2', 'highways (8 lanes)')}${stat('1', 'cloverleaf interchange')}${stat('7 km', 'ring boulevard')}${stat('Live', 'moving traffic')}</div>`,
  },
};

let mode = 'overview';
const infoEl = $('#info'), infoBody = $('#infoBody');
function renderInfo() {
  infoEl.classList.add('swap');
  setTimeout(() => {
    infoBody.innerHTML = VIEWS[mode].html();
    infoEl.classList.remove('swap');
  }, 250);
}
infoBody.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  stopTour();
  if (b.id === 'chipTour') return startTour();
  if (b.dataset.go) return goTo(b.dataset.go);
  if (b.dataset.shot) return shot(VIEWS.stadium.shots[b.dataset.shot]);
  if (b.dataset.mshot) return shot(mosqueShots[b.dataset.mshot]);
  if (b.dataset.room) return shot(roomShots[b.dataset.room]);
});

function goTo(m, { fromTour = false } = {}) {
  if (!fromTour) stopTour();
  mode = m;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.go === m));
  document.body.classList.toggle('seat-mode', m === 'seats');
  $('#seatPanel').classList.toggle('hidden', m !== 'seats');
  stadium.roof.targetOpacity = m === 'seats' ? 0.0 : 1;
  if (m !== 'seats') hideTooltip();
  shot(VIEWS[m].shot());
  renderInfo();
  updateLabels();
}
document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => goTo(b.dataset.go)));

let labelsOn = true;
function updateLabels() {
  labelObjs.forEach(l => {
    const show = !underground && ((l.main && mode !== 'seats' && mode !== 'changing') || l.group === mode);
    l.el.classList.toggle('dim', !show);
  });
}
$('#btnLabels').addEventListener('click', e => {
  labelsOn = !labelsOn;
  document.body.classList.toggle('labels-off', !labelsOn);
  e.target.textContent = 'Labels: ' + (labelsOn ? 'on' : 'off');
});
$('#btnRoof').addEventListener('click', e => {
  stadium.roof.setClosed(!stadium.roof.closed);
  e.target.textContent = stadium.roof.closed ? 'Open roof' : 'Close roof';
});
$('#btnDay').addEventListener('click', e => {
  nightTarget = nightTarget ? 0 : 1;
  e.target.textContent = nightTarget ? '☀ Day' : '☾ Night';
});

// ---------------------------------------------------------------------------
// Drone tour
// ---------------------------------------------------------------------------
let tour = null;
function startTour() {
  const seq = ['overview', 'stadium', 'seats', 'mosque', 'park', 'parking', 'roads', 'overview'];
  let i = 0;
  const next = () => {
    if (!tour) return;
    goTo(seq[i], { fromTour: true });
    i++;
    if (i < seq.length) tour.timer = setTimeout(next, 7000);
    else stopTour();
  };
  tour = { timer: 0 };
  $('#btnTour').textContent = '■ Stop tour';
  next();
}
function stopTour() {
  if (!tour) return;
  clearTimeout(tour.timer); tour = null;
  $('#btnTour').textContent = '▶ Drone tour';
}
$('#btnTour').addEventListener('click', () => (tour ? stopTour() : startTour()));
renderer.domElement.addEventListener('pointerdown', () => { if (!flight) stopTour(); });

// ---------------------------------------------------------------------------
// Seat selection
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const selected = new Map(); // key -> {sec, i}
let hover = null;
const tooltip = $('#tooltip');
const seatCard = $('#seatCard');

function countFree() { return stadium.sections.reduce((s, sec) => s + sec.state.reduce((a, v) => a + (v === 0 ? 1 : 0), 0), 0); }
function seatColor(sec, i) { return sec.state[i] === 2 ? SELECTED_COLOR : sec.state[i] === 1 ? SOLD_COLOR : sec.base; }
function paint(sec, i, c) { sec.mesh.setColorAt(i, c); sec.mesh.instanceColor.needsUpdate = true; }
function seatInfo(sec, i) {
  const s = sec.seats[i], cat = CATEGORIES[sec.cat];
  return { label: `Section ${sec.name} · Row ${s.row} · Seat ${s.num}`, cat, s };
}
function statusHtml(st) {
  return st === 2 ? '<span class="status sel">✔ Selected</span>' : st === 1 ? '<span class="status sold">✖ Sold</span>' : '<span class="status not">○ Not selected</span>';
}
function showCard(sec, i) {
  const { label, cat } = seatInfo(sec, i);
  seatCard.innerHTML = `<div class="where">${label}</div><div class="muted">${cat.name} · Tier ${sec.tier}</div><div class="price">AED ${cat.price}</div>${statusHtml(sec.state[i])}`;
}
function hideTooltip() { tooltip.classList.add('hidden'); if (hover) { paint(hover.sec, hover.i, seatColor(hover.sec, hover.i)); hover = null; } }

function pick(cx, cy) {
  pointer.x = (cx / innerWidth) * 2 - 1;
  pointer.y = -(cy / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = stadium.sections.filter(s => s.mesh.visible).map(s => s.mesh);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  return hit ? { sec: hit.object.userData.section, i: hit.instanceId } : null;
}

let pendingMove = null;
renderer.domElement.addEventListener('pointermove', e => { pendingMove = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerleave', () => { pendingMove = null; hideTooltip(); });
function processHover() {
  if (!pendingMove || mode !== 'seats' || flight) return;
  const { x, y } = pendingMove; pendingMove = null;
  const h = pick(x, y);
  if (hover && (!h || h.sec !== hover.sec || h.i !== hover.i)) { paint(hover.sec, hover.i, seatColor(hover.sec, hover.i)); hover = null; }
  if (!h) { tooltip.classList.add('hidden'); renderer.domElement.style.cursor = ''; return; }
  hover = h;
  paint(h.sec, h.i, HOVER_COLOR);
  const { label, cat } = seatInfo(h.sec, h.i);
  const st = h.sec.state[h.i];
  tooltip.innerHTML = `${label}<br><b>AED ${cat.price}</b> · ${cat.name}<br>${st === 2 ? '✔ <span style="color:#22e07a">Selected</span>' : st === 1 ? '✖ Sold' : '○ Not selected · click to select'}`;
  tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
  tooltip.classList.remove('hidden');
  renderer.domElement.style.cursor = st === 1 ? 'not-allowed' : 'pointer';
  showCard(h.sec, h.i);
}

let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || mode !== 'seats') return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 6) return;
  const h = pick(e.clientX, e.clientY);
  if (!h) return;
  toggleSeat(h.sec, h.i);
});

function toggleSeat(sec, i) {
  const key = sec.name + ':' + i;
  if (sec.state[i] === 1) { showCard(sec, i); return; }
  if (sec.state[i] === 2) { sec.state[i] = 0; selected.delete(key); }
  else { sec.state[i] = 2; selected.set(key, { sec, i }); }
  paint(sec, i, hover && hover.sec === sec && hover.i === i ? HOVER_COLOR : seatColor(sec, i));
  showCard(sec, i);
  if (hover && hover.sec === sec && hover.i === i) {
    const st = sec.state[i]; const { label, cat } = seatInfo(sec, i);
    tooltip.innerHTML = `${label}<br><b>AED ${cat.price}</b> · ${cat.name}<br>${st === 2 ? '✔ <span style="color:#22e07a">Selected</span>' : '○ Not selected · click to select'}`;
  }
  renderBasket();
}

function renderBasket() {
  const list = $('#basketList');
  const items = [...selected.values()];
  list.innerHTML = items.map(({ sec, i }) => {
    const { s, cat } = seatInfo(sec, i);
    return `<li><span>Sec ${sec.name} · R${s.row} · S${s.num}</span><span>AED ${cat.price} <button data-k="${sec.name}:${i}" title="Remove">✕</button></span></li>`;
  }).join('') || '<li class="muted">Nothing selected yet</li>';
  const total = items.reduce((t, { sec }) => t + CATEGORIES[sec.cat].price, 0);
  $('#basketCount').textContent = items.length;
  $('#basketTotal').textContent = 'AED ' + fmt(total);
  ['#btnSeatView', '#btnClear', '#btnCheckout'].forEach(id => ($(id).disabled = !items.length));
}
$('#basketList').addEventListener('click', e => {
  const k = e.target.dataset.k; if (!k) return;
  const { sec, i } = selected.get(k); toggleSeat(sec, i);
});
$('#btnClear').addEventListener('click', () => { [...selected.values()].forEach(({ sec, i }) => toggleSeat(sec, i)); });
$('#btnSeatView').addEventListener('click', () => {
  const items = [...selected.values()];
  const { sec, i } = items[items.length - 1];
  const s = sec.seats[i];
  const eye = V(s.x, s.y + 1.25, s.z);
  stopTour();
  flyTo(eye, V(0, 2, 0).lerp(eye, 0.0).setY(2), 3.5);
});
$('#btnCheckout').addEventListener('click', () => {
  const items = [...selected.values()];
  const total = items.reduce((t, { sec }) => t + CATEGORIES[sec.cat].price, 0);
  $('#modalBody').innerHTML = `<p>${items.length} seat(s) are held for you for this demo:</p><ul>${items.map(({ sec, i }) => { const { label, cat } = seatInfo(sec, i); return `<li>${label}: AED ${cat.price}</li>`; }).join('')}</ul><p><b>Total: AED ${fmt(total)}</b></p><p class="muted">Demo website: no payment is taken.</p>`;
  $('#modal').classList.remove('hidden');
  items.forEach(({ sec, i }) => { sec.state[i] = 1; paint(sec, i, SOLD_COLOR); });
  selected.clear(); renderBasket();
});
$('#modalClose').addEventListener('click', () => $('#modal').classList.add('hidden'));

function buildSeatPanel() {
  const counts = {};
  stadium.sections.forEach(s => { counts[s.cat] = (counts[s.cat] || 0) + s.seats.length; });
  $('#legend').innerHTML = Object.entries(CATEGORIES).map(([k, c]) =>
    `<label title="${fmt(counts[k] || 0)} seats"><input type="checkbox" data-cat="${k}" checked><span class="sw" style="background:${c.color}"></span>${c.name}<span class="price">${c.price}</span></label>`).join('') +
    `<label><span class="sw" style="background:#22e07a"></span>Selected</label><label><span class="sw" style="background:#3a3f47"></span>Sold</label>`;
  $('#legend').addEventListener('change', e => {
    const cat = e.target.dataset.cat; if (!cat) return;
    stadium.sections.forEach(s => { if (s.cat === cat) s.mesh.visible = e.target.checked; });
  });
  const jump = $('#sectionJump');
  jump.innerHTML = stadium.sections.map((s, i) => `<button data-i="${i}" title="${CATEGORIES[s.cat].name} · AED ${CATEGORIES[s.cat].price}">${s.name}</button>`).join('');
  jump.addEventListener('click', e => {
    const i = e.target.dataset.i; if (i === undefined) return;
    const s = stadium.sections[+i];
    const target = s.center.clone();
    const pos = s.center.clone().addScaledVector(s.normal, -75).add(V(0, 30, 0));
    stopTour();
    flyTo(pos, target, 2.4);
  });
  renderBasket();
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateFlight(dt);
  updateDrone(dt);
  if (!flight) controls.update();
  stadium.roof.update(dt);
  district.updateTraffic(dt);
  if (Math.abs(night - nightTarget) > 0.001) { night += (nightTarget - night) * (1 - Math.exp(-dt * 1.6)); if (Math.abs(night - nightTarget) < 0.002) night = nightTarget; applyDayNight(); }
  processHover();
  if (underground !== lastUG) { lastUG = underground; updateLabels(); }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (!MANUAL) requestAnimationFrame(frame);
}
let lastUG = false;
const MANUAL = new URLSearchParams(location.search).has('manual'); // used for automated screenshots

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
});

(async () => {
  await build();
  defineShots();
  buildSeatPanel();
  applyDayNight();
  controls.target.set(0, 0, -150);
  mode = 'overview';
  renderInfo();
  updateLabels();
  requestAnimationFrame(frame);
  setTimeout(() => {
    $('#loader').classList.add('done');
    flyTo(VIEWS.overview.shot().pos, VIEWS.overview.shot().target, 4.5);
  }, 300);
  window.__app = { frame, snap(m, sub) { flight = null; if (m) goTo(m); const sh = sub ? sub() : VIEWS[mode].shot(); if (flight) flight = null; underground = !!sh.underground; insideNow = !!sh.inside; camera.position.copy(sh.pos); controls.target.copy(sh.target); controls.enabled = true; controls.update(); updateLabels(); }, shots: () => ({ mosqueShots, roomShots, stadium: VIEWS.stadium.shots }), scene, camera, controls, goTo, shot, stadium, mosque, district, selected, toggleSeat, setNight: v => { nightTarget = v; }, forceNight() { night = nightTarget = 1; applyDayNight(); }, get flight() { return flight; } };
})();
