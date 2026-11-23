import * as THREE from 'three';
import { toon } from './art.js';
import { NO_INK } from './post.js';

let scene, camera;
const parts = [], decals = [], puffs = [], debris = [], stars = [];
const pops = document.getElementById('pops');
const partGeo = new THREE.BoxGeometry(1, 1, 1);
const puffGeo = new THREE.IcosahedronGeometry(1, 1);
const basic = new Map();
const bmat = c => { if (!basic.has(c)) basic.set(c, new THREE.MeshBasicMaterial({ color: c })); return basic.get(c); };
const noInk = o => { o.layers.set(NO_INK); return o; };

export function initFx(s, c) { scene = s; camera = c; }

// 火花碎屑（不描边）
export function burst(pos, color, n = 10, spd = 6, size = 0.1) {
  for (let i = 0; i < n; i++) {
    const m = noInk(new THREE.Mesh(partGeo, bmat(color))); m.scale.setScalar(size * (0.5 + Math.random()));
    m.position.copy(pos); scene.add(m);
    parts.push({ m, v: new THREE.Vector3((Math.random() - .5) * spd, Math.random() * spd * .9, (Math.random() - .5) * spd), t: 0.35 + Math.random() * .35 });
  }
}
// 弹道
const trMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0 });
const trGeo = new THREE.BoxGeometry(1, 1, 1);
export function tracer(a, b, color) {
  const m = noInk(new THREE.Mesh(trGeo, color ? bmat(color) : trMat));
  const len = a.distanceTo(b); m.scale.set(0.025, 0.025, len); m.position.copy(a).lerp(b, .5); m.lookAt(b);
  scene.add(m); parts.push({ m, v: null, t: 0.045, line: true });
}
// 烟团（描边，美漫味）
export function smoke(pos, n = 4, size = 0.6, color = 0xe9e2d2, rise = 1.5) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, toon(i % 3 === 2 ? 0xbdb4a2 : color, null));
    m.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * size, Math.random() * size * .5, (Math.random() - .5) * size));
    scene.add(m);
    puffs.push({ m, t: 0, life: 0.5 + Math.random() * 0.5, s: size * (0.5 + Math.random() * 0.6), v: new THREE.Vector3((Math.random() - .5), rise * (0.5 + Math.random()), (Math.random() - .5)) });
  }
}
// 爆炸星形闪光（面向镜头）
const starGeo = (() => { const s = new THREE.Shape(); for (let i = 0; i < 20; i++) { const r = i % 2 ? 0.45 : 1, a = i / 20 * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); } return new THREE.ShapeGeometry(s); })();
export function flashStar(pos, size = 1.5) {
  for (const [c, k] of [[0xff8a1f, 1], [0xfff1a0, 0.6]]) {
    const m = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, depthTest: true }));
    m.position.copy(pos); m.scale.setScalar(size * k); m.rotation.z = Math.random() * 3; scene.add(m);
    stars.push({ m, t: 0, life: 0.14, s: size * k });
  }
}
// 子弹打到场景：尘土 + 火花
export function impact(p, dir) {
  burst(p.clone().addScaledVector(dir, -0.05), 0xfff1a0, 3, 4, 0.05);
  if (Math.random() < 0.6) smoke(p.clone().addScaledVector(dir, -0.15), 1, 0.18, 0xe6d3a8, 0.6);
}
// 敌人被打爆：零件四散
export function scatter(group, origin, push) {
  group.updateMatrixWorld(true);
  const list = [];
  group.traverse(o => { if (o.isMesh && o.userData.part) list.push(o); });
  for (const o of list) {
    const m = o.clone(); m.material = o.userData.mat || o.material;
    o.matrixWorld.decompose(m.position, m.quaternion, m.scale); scene.add(m);
    const v = m.position.clone().sub(origin); v.y = Math.abs(v.y) + 0.4; v.normalize().multiplyScalar(4 + Math.random() * 5); v.y += 3 + Math.random() * 3;
    if (push) v.addScaledVector(push, 0.6 + Math.random() * 0.8);
    debris.push({ m, v, w: new THREE.Vector3((Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 14), t: 0, life: 2.2 + Math.random(), s0: m.scale.clone() });
  }
  while (debris.length > 90) { const d = debris.shift(); scene.remove(d.m); }
}

// 击杀涂鸦：皇冠/星星/漩涡/叉/笑脸，喷在地上
const GCOL = ['#ffd21f', '#ff4a2a', '#ffb000', '#ff6fb5', '#3ac1ff'];
function gTex(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.lineCap = g.lineJoin = 'round'; draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SYMS = [
  g => { g.beginPath(); g.moveTo(16, 96); g.lineTo(24, 40); g.lineTo(46, 70); g.lineTo(64, 28); g.lineTo(82, 70); g.lineTo(104, 40); g.lineTo(112, 96); g.closePath(); },
  g => { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 54, a = i / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); },
  g => { g.beginPath(); for (let a = 0; a < 18; a += 0.2) g.lineTo(64 + Math.cos(a) * a * 3, 64 + Math.sin(a) * a * 3); },
  g => { g.beginPath(); g.moveTo(24, 24); g.lineTo(104, 104); g.moveTo(104, 24); g.lineTo(24, 104); },
  g => { g.beginPath(); g.arc(64, 64, 46, 0, 7); g.moveTo(44, 54); g.arc(44, 52, 4, 0, 7); g.moveTo(88, 54); g.arc(84, 52, 4, 0, 7); g.moveTo(40, 76); g.quadraticCurveTo(64, 100, 88, 76); },
];
const GTEX = [];
SYMS.forEach((sym, i) => GCOL.forEach((col, k) => {
  if ((i + k) % 2) return;
  GTEX.push(gTex(g => {
    const fill = i < 2; sym(g);
    if (fill) { g.fillStyle = col; g.fill(); g.lineWidth = 7; g.strokeStyle = '#1a1a1a'; g.stroke(); }
    else { g.lineWidth = 16; g.strokeStyle = '#1a1a1a'; g.stroke(); sym(g); g.lineWidth = 9; g.strokeStyle = col; g.stroke(); }
    g.fillStyle = col; for (let j = 0; j < 14; j++) { g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 0, 7); g.fill(); }
  }));
}));
const decGeo = new THREE.PlaneGeometry(1, 1);
export function graffiti(x, z, big = 1) {
  const m = noInk(new THREE.Mesh(decGeo, new THREE.MeshBasicMaterial({ map: GTEX[(Math.random() * GTEX.length) | 0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(x, 0.02 + (decals.length % 50) * 0.0006, z);
  m.scale.setScalar((1.6 + Math.random() * 1.2) * big); scene.add(m);
  decals.push(m); if (decals.length > 160) { const o = decals.shift(); scene.remove(o); }
}
export function clearDecals() { decals.forEach(d => scene.remove(d)); decals.length = 0; }

const _v = new THREE.Vector3();
export function popText(text, worldPos, cls = '') {
  _v.copy(worldPos).project(camera);
  if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) return;
  const el = document.createElement('div'); el.className = 'p ' + cls; el.textContent = text;
  el.style.left = ((_v.x * .5 + .5) * innerWidth) + 'px'; el.style.top = ((-_v.y * .5 + .5) * innerHeight) + 'px';
  pops.appendChild(el); setTimeout(() => el.remove(), 800);
}

export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t -= dt;
    if (!p.line) { p.v.y -= 18 * dt; p.m.position.addScaledVector(p.v, dt); if (p.m.position.y < 0.03) { p.m.position.y = .03; p.v.multiplyScalar(.4); } }
    if (p.t <= 0) { scene.remove(p.m); parts.splice(i, 1); }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.t += dt; const k = p.t / p.life;
    p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-2 * dt));
    p.m.scale.setScalar(p.s * (k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75 * 0.9) + 0.001);
    if (k >= 1) { scene.remove(p.m); puffs.splice(i, 1); }
  }
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i]; s.t += dt; s.m.quaternion.copy(camera.quaternion); s.m.scale.setScalar(s.s * (1 + s.t * 4));
    if (s.t > s.life) { scene.remove(s.m); s.m.material.dispose(); stars.splice(i, 1); }
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.t += dt;
    if (d.m.position.y > 0.12 || d.v.y > 0) {
      d.v.y -= 20 * dt; d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
      if (d.m.position.y < 0.12) { d.m.position.y = 0.12; d.v.y *= -0.35; d.v.x *= 0.5; d.v.z *= 0.5; d.w.multiplyScalar(0.5); if (Math.abs(d.v.y) < 1) d.v.y = 0; }
    }
    if (d.t > d.life) { const k = 1 - (d.t - d.life) / 0.4; if (k <= 0) { scene.remove(d.m); debris.splice(i, 1); } else d.m.scale.copy(d.s0).multiplyScalar(k); }
  }
}
