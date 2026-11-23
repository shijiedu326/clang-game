import * as THREE from 'three';
import { box, cyl, toon, PAL } from './art.js';

// 第一人称枪模：独立场景，叠在世界之上（描边后处理同样作用于它）
export const vmScene = new THREE.Scene();
export const vmCam = new THREE.PerspectiveCamera(54, 1, 0.05, 300);
vmScene.add(new THREE.HemisphereLight(0xfff3d6, 0x8a6a48, 2.0));
const dl = new THREE.DirectionalLight(0xffffff, 2.4); dl.position.set(-1, 2, 1.5); vmScene.add(dl);

const GLOVE = 0x3b2f2a, SLEEVE = 0xc8642c, SKIN = 0xe9a877, GUNMETAL = 0x4a5258, OLIVE = 0x6b7a3e, WOOD = 0xa0603a;
function add(g, m, x, y, z, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; }

// 手：手套 + 手腕 + 袖口
function hand(g, x, y, z, rx = 0, ry = 0, rz = 0, mirror = 1) {
  const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.set(rx, ry, rz); g.add(h);
  add(h, box(0.085, 0.095, 0.11, GLOVE, 0, 'plain'), 0, 0, 0);
  add(h, box(0.03, 0.03, 0.08, GLOVE, 0, 'plain'), -0.05 * mirror, 0.035, -0.03, 0, 0.2 * mirror);
  for (let i = 0; i < 3; i++) add(h, box(0.022, 0.02, 0.03, GLOVE, 0, 'plain'), 0.045 * mirror, 0.02 - i * 0.026, -0.04);
  add(h, box(0.07, 0.07, 0.06, SKIN, 0, 'plain'), 0, -0.01, 0.075);
  const sl = cyl(0.058, 0.064, 0.3, SLEEVE, 0, 10, 'metal'); sl.rotation.x = Math.PI / 2; sl.position.set(0, -0.01, 0.24); h.add(sl);
  add(h, cyl(0.066, 0.066, 0.05, 0x7a3a1a, 0, 10, 'metal'), 0, -0.01, 0.11, Math.PI / 2);
  return h;
}

function pistol(mirror = 1, color = GUNMETAL, accent = WOOD) {
  const g = new THREE.Group();
  const slide = new THREE.Group(); g.add(slide); g.userData.slide = slide;
  add(slide, box(0.07, 0.075, 0.34, color, 0, 'metal'), 0, 0.045, -0.15);
  for (let i = 0; i < 5; i++) add(slide, box(0.074, 0.05, 0.008, 0x22272b, 0, 'plain'), 0, 0.045, -0.02 - i * 0.018);
  add(slide, box(0.016, 0.02, 0.02, 0x222222, 0, 'plain'), 0, 0.09, -0.3);
  add(slide, box(0.04, 0.02, 0.02, 0x222222, 0, 'plain'), 0, 0.09, -0.01);
  add(slide, box(0.074, 0.012, 0.2, 0x8a959c, 0, 'metal'), 0, 0.085, -0.17);
  add(g, box(0.064, 0.05, 0.3, 0x2a2e33, 0, 'metal'), 0, -0.005, -0.15);
  add(g, cyl(0.016, 0.016, 0.04, 0x111111, 0, 8, 'plain'), 0, 0.045, -0.335, Math.PI / 2);
  add(g, box(0.02, 0.012, 0.09, 0x2a2e33, 0, 'plain'), 0, -0.07, -0.13);
  add(g, box(0.02, 0.06, 0.012, 0x2a2e33, 0, 'plain'), 0, -0.045, -0.175);
  add(g, box(0.012, 0.035, 0.012, 0x111111, 0, 'plain'), 0, -0.04, -0.12, 0.3);
  add(g, box(0.066, 0.17, 0.085, accent, 0, 'wood'), 0, -0.1, -0.03, 0.28);
  add(g, box(0.07, 0.02, 0.09, 0x222222, 0, 'plain'), 0, -0.185, 0.0, 0.28);
  add(g, box(0.03, 0.03, 0.03, 0x222222, 0, 'plain'), 0, 0.06, 0.03, 0.4);
  hand(g, 0, -0.1, -0.015, 0.28, 0, 0, mirror);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.045, -0.37); g.add(mz); g.userData.muzzle = mz;
  return g;
}
function smg() {
  const g = new THREE.Group();
  add(g, box(0.085, 0.11, 0.44, OLIVE, 0, 'rusty'), 0, 0, -0.2);
  add(g, box(0.07, 0.03, 0.36, 0x2a2e33, 0, 'metal'), 0, 0.07, -0.2);
  for (let i = 0; i < 6; i++) add(g, box(0.075, 0.012, 0.025, 0x1a1a1a, 0, 'plain'), 0, 0.088, -0.06 - i * 0.05);
  const sh = add(g, cyl(0.036, 0.036, 0.22, 0x3a4046, 0, 10, 'metal'), 0, 0.01, -0.52, Math.PI / 2);
  for (let i = 0; i < 4; i++) add(g, box(0.074, 0.016, 0.02, 0x111111, 0, 'plain'), 0, 0.02, -0.45 - i * 0.045);
  add(g, cyl(0.016, 0.016, 0.08, 0x111111, 0, 8, 'plain'), 0, 0.01, -0.66, Math.PI / 2);
  add(g, box(0.012, 0.05, 0.012, 0x111111, 0, 'plain'), 0, 0.075, -0.58);
  add(g, box(0.05, 0.03, 0.05, 0x111111, 0, 'plain'), 0, 0.09, -0.02);
  add(g, box(0.05, 0.16, 0.07, 0x2a2e33, 0, 'metal'), 0, -0.13, -0.27, -0.2);
  add(g, box(0.05, 0.12, 0.07, 0x2a2e33, 0, 'metal'), 0, -0.25, -0.31, -0.45);
  add(g, box(0.06, 0.15, 0.075, WOOD, 0, 'wood'), 0, -0.12, -0.04, 0.3);
  add(g, box(0.075, 0.1, 0.26, WOOD, 0, 'wood'), 0, -0.02, 0.14, -0.08);
  add(g, box(0.08, 0.14, 0.04, 0x2a2a2a, 0, 'plain'), 0, -0.04, 0.27, -0.08);
  add(g, box(0.06, 0.1, 0.12, WOOD, 0, 'wood'), 0, -0.09, -0.4);
  add(g, box(0.03, 0.04, 0.05, 0xff4a2a, 0, 'plain'), 0.045, 0.02, -0.12);
  hand(g, 0, -0.12, -0.025, 0.3, 0, 0, 1);
  hand(g, -0.02, -0.14, -0.42, 0.1, 0.25, 0.6, -1);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.01, -0.72); g.add(mz); g.userData.muzzle = mz;
  return g;
}
function shotgun() {
  const g = new THREE.Group();
  add(g, box(0.08, 0.12, 0.3, 0x2a2e33, 0, 'metal'), 0, 0, -0.12);
  add(g, box(0.082, 0.04, 0.18, 0x6d7a82, 0, 'metal'), 0, 0.02, -0.12);
  add(g, cyl(0.026, 0.026, 0.6, 0x3a4046, 0, 10, 'metal'), 0, 0.03, -0.56, Math.PI / 2);
  add(g, cyl(0.022, 0.022, 0.5, 0x2a2e33, 0, 10, 'metal'), 0, -0.025, -0.5, Math.PI / 2);
  add(g, box(0.014, 0.025, 0.014, 0xff4a2a, 0, 'plain'), 0, 0.065, -0.84);
  const pump = new THREE.Group(); pump.position.set(0, -0.025, -0.5); g.add(pump); g.userData.pump = pump;
  add(pump, box(0.075, 0.075, 0.22, WOOD, 0, 'wood'), 0, 0, 0);
  for (let i = 0; i < 4; i++) add(pump, box(0.078, 0.078, 0.012, 0x6a3a20, 0, 'plain'), 0, 0, -0.08 + i * 0.05);
  hand(pump, -0.01, -0.06, 0.02, 0.1, 0.2, 0.55, -1);
  add(g, box(0.065, 0.15, 0.075, WOOD, 0, 'wood'), 0, -0.12, 0.03, 0.35);
  add(g, box(0.08, 0.12, 0.3, WOOD, 0, 'wood'), 0, -0.06, 0.2, -0.12);
  add(g, box(0.085, 0.15, 0.04, 0x2a2a2a, 0, 'plain'), 0, -0.08, 0.36, -0.12);
  add(g, box(0.06, 0.03, 0.03, PAL.yellow, 0, 'plain'), 0, -0.07, 0.02);
  hand(g, 0, -0.12, 0.03, 0.35, 0, 0, 1);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.03, -0.88); g.add(mz); g.userData.muzzle = mz;
  return g;
}

// 枪口火光：八角星，带描边
const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 0.035 : 0.12, a = i / 16 * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); } return s; })();
const flashGeo = new THREE.ShapeGeometry(starShape);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0, side: THREE.DoubleSide });
const flashMat2 = new THREE.MeshBasicMaterial({ color: 0xffa21f, side: THREE.DoubleSide });

// 放置：枪身朝向略往左内收，对准准星
const LAYOUT = {
  pistol: { make: () => [pistol()], pos: [[0.3, -0.31, -0.62]], ry: 0.5, rz: -0.12, rx: 0.12 },
  smg: { make: () => [smg()], pos: [[0.26, -0.25, -0.5]], ry: 0.3, rz: -0.08, rx: 0.05 },
  shotgun: { make: () => [shotgun()], pos: [[0.25, -0.26, -0.48]], ry: 0.28, rz: -0.08, rx: 0.06 },
  dual: { make: () => [pistol(1), pistol(-1, 0x8a8f94, 0x3a3a3a)], pos: [[0.33, -0.31, -0.62], [-0.33, -0.31, -0.62]], ry: 0.5, rz: -0.12, rx: 0.12 },
};
let root = null, guns = [], kind = 'pistol', flashT = 0, flashes = [], fireSide = 0;
const st = { recoil: [0, 0], raise: 0, swayX: 0, swayY: 0, pump: 0, bob: 0 };

export function buildVM(k) {
  kind = k; if (root) vmScene.remove(root);
  root = new THREE.Group(); vmScene.add(root);
  const L = LAYOUT[k]; guns = L.make();
  guns.forEach((g, i) => {
    const [x, y, z] = L.pos[i]; g.position.set(x, y, z); g.rotation.y = (i ? -1 : 1) * L.ry; g.rotation.z = (i ? -1 : 1) * L.rz; g.userData.rx = L.rx || 0; g.userData.base = g.position.clone();
    root.add(g);
    const f1 = new THREE.Mesh(flashGeo, flashMat), f2 = new THREE.Mesh(flashGeo, flashMat2);
    f2.scale.setScalar(1.6); f2.position.z = 0.005; f1.visible = f2.visible = false;
    g.userData.muzzle.add(f2); g.userData.muzzle.add(f1); g.userData.flash = [f1, f2];
  });
  st.raise = 1; st.recoil = [0, 0];
}
// 开火：dual 左右交替
export function fireVM(strength = 1) {
  const i = guns.length > 1 ? (fireSide ^= 1) : 0; const g = guns[i];
  st.recoil[i] = Math.min(1.4, st.recoil[i] + strength);
  for (const f of g.userData.flash) { f.visible = true; f.rotation.z = Math.random() * 3; f.scale.setScalar((f === g.userData.flash[1] ? 1.5 : 1) * (0.6 + Math.random() * 0.4) * (kind === 'shotgun' ? 1.25 : 1)); }
  g.userData.flashT = 0.045;
  if (kind === 'shotgun') st.pump = 1;
  return g;
}
// 世界坐标下的枪口位置（给弹道线起点用）——近似：屏幕右下
export function muzzleSide() { return guns.length > 1 ? (fireSide ? -1 : 1) : 1; }

export function updateVM(dt, s) {
  if (!root) return;
  st.bob += dt * (s.moving ? 10 : 1.8);
  st.raise = Math.max(0, st.raise - dt * 4);
  st.swayX += (s.lookDX * 0.012 - st.swayX) * Math.min(1, dt * 10); st.swayY += (s.lookDY * 0.012 - st.swayY) * Math.min(1, dt * 10);
  st.pump = Math.max(0, st.pump - dt * 2.4);
  const amp = s.moving ? 1 : 0.25;
  const rl = s.reload; // 0..1 进度，-1 表示不在换弹
  const rlk = rl >= 0 ? Math.sin(rl * Math.PI) : 0;
  root.position.set(Math.sin(st.bob) * 0.014 * amp - st.swayX, -Math.abs(Math.cos(st.bob)) * 0.012 * amp - st.raise * 0.35 - rlk * 0.12 + st.swayY + (s.air ? 0.02 : 0), 0);
  root.rotation.set(rlk * 0.5 + st.raise * 0.6, 0, rlk * 0.35 + st.swayX * 2);
  guns.forEach((g, i) => {
    const r = st.recoil[i]; st.recoil[i] *= Math.exp(-14 * dt);
    g.position.copy(g.userData.base); g.position.z += r * 0.07; g.position.y += r * 0.015;
    g.rotation.x = g.userData.rx + r * 0.32;
    if (g.userData.slide) g.userData.slide.position.z = Math.min(r, 1) * 0.05;
    if (g.userData.pump) { const p = st.pump > 0.5 ? (1 - st.pump) * 2 : st.pump * 2; g.userData.pump.position.z = -0.5 + p * 0.12; }
    if (g.userData.flashT > 0) { g.userData.flashT -= dt; if (g.userData.flashT <= 0) g.userData.flash.forEach(f => f.visible = false); }
  });
}
