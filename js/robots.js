import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEX } from './art.js';

// ============ 角色材质：三阶色调 + 暗部网点（美漫 Ben-Day 点） ============
const grad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([80, 150, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const cm = new Map();
export function cmat(color, tex = 'plain') {
  const k = color + tex;
  if (cm.has(k)) return cm.get(k);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: grad, map: tex ? TEX[tex] : null });
  m.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `
      float litC = dot(reflectedLight.directDiffuse, vec3(0.333)) / max(dot(diffuseColor.rgb, vec3(0.333)), 0.02);
      vec2 gq = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 5.5;
      float rr = length(fract(gq) - 0.5);
      float sh = 1.0 - smoothstep(0.26, 0.40, litC);
      float dotR = 0.18 + sh * 0.22;
      float dt = 1.0 - smoothstep(dotR - 0.04, dotR + 0.04, rr);
      outgoingLight *= (1.0 - dt * sh * 0.5) * (1.0 - sh * 0.1);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'halftone';
  cm.set(k, m); return m;
}
const glow = new Map();
const gmat = c => { if (!glow.has(c)) glow.set(c, new THREE.MeshBasicMaterial({ color: c })); return glow.get(c); };

// ============ 几何工具 ============
const rbCache = new Map();
function rbGeo(w, h, d, r) {
  const k = [w, h, d, r].join();
  if (!rbCache.has(k)) rbCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  return rbCache.get(k);
}
const cyCache = new Map();
function cyGeo(rt, rb, h, seg) { const k = [rt, rb, h, seg].join(); if (!cyCache.has(k)) cyCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg)); return cyCache.get(k); }
const sphG = new THREE.SphereGeometry(1, 16, 12);
function put(parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0, part = true) {
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.userData.part = part; parent.add(mesh); return mesh;
}
const RB = (p, w, h, d, c, x, y, z, rx, ry, rz, r = 0.05, tex) => put(p, new THREE.Mesh(rbGeo(w, h, d, r), cmat(c, tex)), x, y, z, rx, ry, rz);
const CY = (p, rt, rb, h, c, x, y, z, rx, ry, rz, seg = 18, tex) => put(p, new THREE.Mesh(cyGeo(rt, rb, h, seg), cmat(c, tex)), x, y, z, rx, ry, rz);
const SP = (p, r, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = put(p, new THREE.Mesh(sphG, cmat(c)), x, y, z); m.scale.set(r * sx, r * sy, r * sz); return m; };
const GL = (p, geo, c, x, y, z, rx = 0, ry = 0, rz = 0) => put(p, new THREE.Mesh(geo, gmat(c)), x, y, z, rx, ry, rz, false);
function pivot(p, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; }
// 两点之间的圆角肢体
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function limb(p, a, b, t, c) {
  _a.set(...a); _b.set(...b);
  const m = new THREE.Mesh(rbGeo(t, t, _a.distanceTo(_b) + t * 0.6, t * 0.45), cmat(c));
  m.position.copy(_a).lerp(_b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _b.clone().sub(_a).normalize());
  m.userData.part = true; p.add(m); return m;
}

// ============ 贴花（徽标、编号、警示条） ============
const dCache = new Map();
function decalTex(key, draw) {
  if (dCache.has(key)) return dCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.lineJoin = g.lineCap = 'round'; draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; dCache.set(key, t); return t;
}
const star = (g, cx, cy, R, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); };
const DECAL = {
  star: () => decalTex('star', g => { star(g, 64, 66, 56, 24); g.fillStyle = '#fff6e2'; g.fill(); g.lineWidth = 9; g.strokeStyle = '#1b1715'; g.stroke(); }),
  num: (n, bg, fg) => decalTex('n' + n + bg, g => { g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = '#1b1715'; g.stroke(); g.fillStyle = fg; g.font = '900 64px Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 64, 68); }),
  tag: (txt, bg, fg) => decalTex('t' + txt, g => { g.fillStyle = bg; g.fillRect(4, 34, 120, 60); g.lineWidth = 7; g.strokeStyle = '#1b1715'; g.strokeRect(4, 34, 120, 60); g.fillStyle = fg; g.font = '900 40px Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 66); }),
  hazard: () => decalTex('hz', g => { g.fillStyle = '#f5c518'; g.fillRect(0, 40, 128, 48); g.fillStyle = '#1b1715'; for (let x = -48; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 88); g.lineTo(x + 16, 88); g.lineTo(x + 64, 40); g.lineTo(x + 48, 40); g.fill(); } g.lineWidth = 6; g.strokeRect(0, 40, 128, 48); }),
};
const decGeo = new THREE.PlaneGeometry(1, 1);
const decMats = new Map();
function decal(p, tex, w, h, x, y, z, ry = 0, rz = 0) {
  if (!decMats.has(tex)) decMats.set(tex, new THREE.MeshToonMaterial({ map: tex, gradientMap: grad, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -4 }));
  const m = new THREE.Mesh(decGeo, decMats.get(tex)); m.scale.set(w, h, 1);
  return put(p, m, x, y, z, 0, ry, rz);
}
// 发光的圆眼：奶白眼白 + 黑框 + 红瞳
const eyeRingG = new THREE.CylinderGeometry(1, 1, 1, 24);
function eye(p, r, x, y, z, pupil = 0xff3b2f) {
  const g = pivot(p, x, y, z);
  put(g, new THREE.Mesh(eyeRingG, cmat(0x1b1715)), 0, 0, 0, Math.PI / 2).scale.set(r * 1.18, r * 0.5, r * 1.18);
  GL(g, eyeRingG, 0xfff3d8, 0, 0, -r * 0.2, Math.PI / 2).scale.set(r, r * 0.3, r);
  const pu = GL(g, eyeRingG, pupil, 0, 0, -r * 0.32, Math.PI / 2); pu.scale.set(r * 0.5, r * 0.2, r * 0.5);
  GL(g, eyeRingG, 0xffffff, r * 0.2, r * 0.22, -r * 0.4, Math.PI / 2).scale.set(r * 0.14, r * 0.1, r * 0.14);
  g.userData.pupil = pu; return g;
}

const RED = 0xd8432a, BLK = 0x2b2626, CRM = 0xf2e2bf, STL = 0x7d8a91, TEAL = 0x2f7f9a, YEL = 0xf0a51c, ORG = 0xff8a1f;

// ============ 拾荒机：垃圾桶独眼兵，大手拖地 ============
function grunt() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(g, s * 0.2, 0.6, 0); legs.push(hip);
    RB(hip, 0.2, 0.3, 0.22, BLK, 0, -0.14, 0, 0, 0, 0, 0.07);
    CY(hip, 0.08, 0.08, 0.2, STL, 0, -0.34, 0, 0, 0, 0, 10, 'metal');
    RB(hip, 0.3, 0.2, 0.44, RED, 0, -0.5, -0.05, 0, 0, 0, 0.08, 'rusty');
    RB(hip, 0.32, 0.06, 0.46, BLK, 0, -0.58, -0.05, 0, 0, 0, 0.02);
  }
  RB(body, 0.6, 0.18, 0.42, BLK, 0, 0.66, 0, 0, 0, 0, 0.06);
  CY(body, 0.44, 0.4, 0.78, RED, 0, 1.08, 0, 0, 0, 0, 22, 'rusty');
  CY(body, 0.455, 0.455, 0.1, CRM, 0, 1.38, 0, 0, 0, 0, 22);
  CY(body, 0.42, 0.42, 0.07, BLK, 0, 0.74, 0, 0, 0, 0, 22);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; SP(body, 0.025, STL, Math.sin(a) * 0.46, 1.38, Math.cos(a) * 0.46); }
  // 桶盖当脑袋
  const head = pivot(body, 0, 1.44, 0);
  CY(head, 0.3, 0.47, 0.16, BLK, 0, 0.08, 0, 0, 0, 0, 22, 'metal');
  RB(head, 0.3, 0.07, 0.08, STL, 0, 0.2, 0, 0, 0, 0, 0.03);
  CY(head, 0.012, 0.012, 0.36, BLK, 0.17, 0.32, 0.08, 0, 0, -0.2, 6);
  GL(head, sphG, 0xff3b2f, 0.21, 0.5, 0.08).scale.setScalar(0.055);
  // 独眼 + 凶眉
  eye(body, 0.19, 0, 1.12, -0.4);
  RB(body, 0.44, 0.08, 0.1, BLK, -0.02, 1.32, -0.42, 0.2, 0, 0.18, 0.03);
  decal(body, DECAL.num('07', '#f2e2bf', '#1b1715'), 0.22, 0.22, 0.322, 0.94, -0.312, 2.34);
  CY(body, 0.445, 0.445, 0.11, 0xffffff, 0, 0.86, 0, 0, 0, 0, 22, 'hazard');
  // 长臂大钳子
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(body, s * 0.5, 1.22, 0); arms.push(sh);
    SP(sh, 0.14, BLK, 0, 0, 0);
    RB(sh, 0.13, 0.36, 0.13, STL, s * 0.02, -0.22, 0, 0, 0, 0, 0.05, 'metal');
    RB(sh, 0.21, 0.32, 0.21, RED, s * 0.03, -0.52, -0.02, 0, 0, 0, 0.07, 'rusty');
    RB(sh, 0.23, 0.06, 0.23, CRM, s * 0.03, -0.37, -0.02, 0, 0, 0, 0.02);
    const hand = pivot(sh, s * 0.03, -0.72, -0.04);
    RB(hand, 0.06, 0.24, 0.08, CRM, 0.06, -0.08, -0.04, 0.25, 0, 0.25, 0.025);
    RB(hand, 0.06, 0.24, 0.08, CRM, -0.06, -0.08, -0.04, 0.25, 0, -0.25, 0.025);
    RB(hand, 0.06, 0.2, 0.08, CRM, 0, -0.06, 0.08, -0.4, 0, 0, 0.025);
  }
  RB(body, 0.16, 0.34, 0.12, BLK, 0, 1.0, 0.44, 0, 0, 0, 0.04);
  CY(body, 0.05, 0.05, 0.3, STL, 0.12, 1.42, 0.38, 0, 0, 0, 8, 'metal');
  return { g, body, legs, arms, head, kind: 'grunt', eyeLocal: new THREE.Vector3(0, 1.12, -0.45) };
}

// ============ 远射机：反关节鸟腿 + 大镜头 + 狙击枪 ============
function spotter() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(g, s * 0.17, 1.16, 0); legs.push(hip);
    SP(hip, 0.09, BLK, 0, 0, 0);
    limb(hip, [0, 0, 0], [0, -0.5, -0.24], 0.19, TEAL);
    RB(hip, 0.2, 0.12, 0.2, CRM, 0, -0.2, -0.1, 0.45, 0, 0, 0.04);
    SP(hip, 0.1, STL, 0, -0.5, -0.24);
    limb(hip, [0, -0.5, -0.24], [0, -0.98, 0.1], 0.12, BLK);
    for (const a of [-0.5, 0, 0.5]) RB(hip, 0.08, 0.07, 0.28, BLK, Math.sin(a) * 0.1, -1.11, 0.0 - Math.cos(a) * 0.1, 0, a, 0, 0.03);
    RB(hip, 0.08, 0.07, 0.14, BLK, 0, -1.11, 0.17, 0, 0, 0, 0.03);
  }
  RB(body, 0.56, 0.58, 0.44, TEAL, 0, 1.4, 0.02, -0.15, 0, 0, 0.14, 'rusty');
  RB(body, 0.4, 0.34, 0.06, CRM, 0, 1.42, -0.21, -0.15, 0, 0, 0.03);
  decal(body, DECAL.tag('SPOT', '#f5c518', '#1b1715'), 0.3, 0.3, 0, 1.42, -0.246, Math.PI, 0);
  for (const s of [-1, 1]) RB(body, 0.2, 0.14, 0.3, CRM, s * 0.33, 1.66, 0.0, 0, 0, s * 0.3, 0.05);
  RB(body, 0.3, 0.42, 0.18, BLK, 0, 1.42, 0.26, -0.15, 0, 0, 0.05);
  CY(body, 0.01, 0.01, 0.7, BLK, -0.1, 1.85, 0.3, 0, 0, 0, 6);
  GL(body, sphG, 0xff3b2f, -0.1, 2.2, 0.3).scale.setScalar(0.04);
  CY(body, 0.12, 0.02, 0.06, STL, 0.1, 1.7, 0.32, 0.6, 0, 0, 12, 'metal');
  CY(body, 0.07, 0.08, 0.14, BLK, 0, 1.68, 0, 0, 0, 0, 10);
  // 相机头
  const head = pivot(body, 0, 1.9, 0); head.scale.setScalar(1.3);
  RB(head, 0.38, 0.3, 0.34, CRM, 0, 0, 0.04, 0, 0, 0, 0.09);
  RB(head, 0.4, 0.1, 0.36, TEAL, 0, 0.16, 0.04, 0, 0, 0, 0.04);
  CY(head, 0.17, 0.19, 0.24, BLK, 0, -0.01, -0.22, Math.PI / 2, 0, 0, 20);
  CY(head, 0.2, 0.2, 0.05, STL, 0, -0.01, -0.33, Math.PI / 2, 0, 0, 20, 'metal');
  const lens = GL(head, eyeRingG, 0xff3b2f, 0, -0.01, -0.36, Math.PI / 2); lens.scale.set(0.13, 0.02, 0.13);
  GL(head, eyeRingG, 0xffd0c0, 0, -0.01, -0.37, Math.PI / 2).scale.set(0.05, 0.02, 0.05);
  GL(head, eyeRingG, 0xffffff, 0.05, 0.05, -0.375, Math.PI / 2).scale.set(0.025, 0.02, 0.025);
  CY(head, 0.05, 0.05, 0.08, BLK, 0.15, 0.08, -0.17, Math.PI / 2, 0, 0, 10);
  // 狙击枪：右手平端
  const arm = pivot(body, 0.3, 1.46, -0.05);
  SP(arm, 0.08, BLK, 0, 0, 0);
  limb(arm, [0, 0, 0], [-0.05, -0.18, -0.25], 0.08, TEAL);
  const gun = pivot(arm, -0.08, -0.16, -0.3);
  RB(gun, 0.08, 0.13, 0.62, BLK, 0, 0, -0.1, 0, 0, 0, 0.03, 'metal');
  RB(gun, 0.07, 0.16, 0.24, RED, 0, -0.04, 0.3, 0, 0, 0, 0.03, 'rusty');
  CY(gun, 0.026, 0.026, 0.8, STL, 0, 0.02, -0.8, Math.PI / 2, 0, 0, 8, 'metal');
  CY(gun, 0.04, 0.04, 0.08, BLK, 0, 0.02, -1.2, Math.PI / 2, 0, 0, 8);
  CY(gun, 0.042, 0.042, 0.28, BLK, 0, 0.11, -0.1, Math.PI / 2, 0, 0, 10);
  GL(gun, eyeRingG, 0xff3b2f, 0, 0.11, -0.245, Math.PI / 2).scale.set(0.03, 0.01, 0.03);
  RB(gun, 0.06, 0.12, 0.06, BLK, 0, -0.1, -0.02, 0, 0, 0, 0.02);
  const arm2 = pivot(body, -0.3, 1.46, -0.05);
  SP(arm2, 0.08, BLK, 0, 0, 0);
  limb(arm2, [0, 0, 0], [0.18, -0.16, -0.42], 0.075, TEAL);
  return { g, body, legs, arms: [], head, lens, kind: 'spotter', eyeLocal: new THREE.Vector3(0, 1.89, -0.5) };
}

// ============ 重装机：黄色方头推土机，凶眼大铲，背后红色散热口是弱点 ============
function hauler() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0);
  const tracks = [];
  for (const s of [-1, 1]) {
    const t = pivot(g, s * 0.88, 0.34, 0.05); tracks.push(t);
    RB(t, 0.44, 0.62, 2.2, BLK, 0, 0, 0, 0, 0, 0, 0.22);
    for (const z of [-0.72, 0, 0.72]) CY(t, 0.22, 0.22, 0.46, STL, 0, 0, z, 0, 0, Math.PI / 2, 14, 'metal');
    for (const z of [-0.72, 0, 0.72]) CY(t, 0.08, 0.08, 0.48, YEL, 0, 0, z, 0, 0, Math.PI / 2, 10);
    const lugs = pivot(t, 0, 0, 0); t.userData.lugs = lugs;
    for (let i = 0; i < 10; i++) RB(lugs, 0.46, 0.06, 0.1, 0x1a1616, 0, 0.32, -1.0 + i * 0.22, 0, 0, 0, 0.02);
  }
  RB(body, 1.5, 0.72, 2.0, YEL, 0, 0.92, 0.05, 0, 0, 0, 0.14, 'rusty');
  RB(body, 1.56, 0.12, 2.06, BLK, 0, 0.6, 0.05, 0, 0, 0, 0.04);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) RB(body, 0.05, 0.34, 0.13, BLK, s * 0.76, 0.95, 0.35 + i * 0.22, 0, 0, 0, 0.05);
    decal(body, DECAL.star(), 0.42, 0.42, s * 0.756, 0.98, -0.42, s * Math.PI / 2);
  }
  decal(body, DECAL.num('05', '#1b1715', '#f5c518'), 0.3, 0.3, -0.42, 1.0, -0.962, Math.PI);
  // 上半身驾驶舱 + 凶眼
  const head = pivot(body, 0, 1.28, 0.25);
  RB(head, 1.15, 0.86, 1.1, YEL, 0, 0.43, 0, 0, 0, 0, 0.16, 'rusty');
  RB(head, 1.0, 0.3, 0.06, BLK, 0, 0.5, -0.55, 0, 0, 0, 0.03);
  const eyes = [eye(head, 0.13, -0.24, 0.5, -0.57), eye(head, 0.13, 0.24, 0.5, -0.57)];
  RB(head, 0.34, 0.08, 0.08, BLK, -0.24, 0.72, -0.58, 0, 0, -0.32, 0.03);
  RB(head, 0.34, 0.08, 0.08, BLK, 0.24, 0.72, -0.58, 0, 0, 0.32, 0.03);
  RB(head, 1.18, 0.1, 1.13, BLK, 0, 0.9, 0, 0, 0, 0, 0.04);
  decal(head, DECAL.hazard(), 1.0, 1.0, 0, 0.14, -0.556, Math.PI);
  for (const s of [-1, 1]) {
    CY(head, 0.09, 0.09, 0.9, BLK, s * 0.4, 1.0, 0.42, 0, 0, 0, 10);
    CY(head, 0.12, 0.1, 0.1, STL, s * 0.4, 1.46, 0.42, 0, 0, 0, 10, 'metal');
    GL(head, new THREE.BoxGeometry(0.16, 0.1, 0.06), ORG, s * 0.42, 0.95, -0.12);
  }
  // 背后红色散热口（弱点，发橙光）
  RB(body, 1.0, 0.5, 0.08, 0xb5321f, 0, 0.95, 1.06, 0, 0, 0, 0.03);
  for (let i = 0; i < 4; i++) RB(body, 1.02, 0.05, 0.1, BLK, 0, 0.77 + i * 0.12, 1.1, 0, 0, 0, 0.02);
  GL(body, new THREE.BoxGeometry(0.9, 0.36, 0.02), 0xff7a1a, 0, 0.95, 1.08);
  // 弧形大铲 + 液压臂 + 铲齿
  for (const s of [-1, 1]) {
    CY(body, 0.07, 0.07, 0.9, STL, s * 0.55, 0.85, -1.05, Math.PI / 2 - 0.2, 0, 0, 10, 'metal');
    CY(body, 0.1, 0.1, 0.4, BLK, s * 0.55, 0.92, -0.75, Math.PI / 2 - 0.2, 0, 0, 10);
  }
  const blade = pivot(body, 0, 0.66, -1.42);
  RB(blade, 2.3, 0.42, 0.16, YEL, 0, 0.38, 0.06, 0.35, 0, 0, 0.05, 'rusty');
  RB(blade, 2.3, 0.42, 0.16, YEL, 0, 0.0, -0.04, 0, 0, 0, 0.05, 'rusty');
  RB(blade, 2.3, 0.36, 0.16, YEL, 0, -0.36, 0.04, -0.3, 0, 0, 0.05, 'rusty');
  decal(blade, DECAL.hazard(), 2.2, 2.2, 0, 0.0, -0.125, Math.PI);
  RB(blade, 2.36, 0.1, 0.24, BLK, 0, 0.6, 0.14, 0.35, 0, 0, 0.03);
  for (let i = 0; i < 7; i++) RB(blade, 0.14, 0.16, 0.08, CRM, -0.9 + i * 0.3, -0.58, -0.05, -0.3, 0, 0, 0.02);
  for (const s of [-1, 1]) RB(blade, 0.14, 1.1, 0.26, BLK, s * 1.12, 0, 0.04, 0, 0, 0, 0.04);
  return { g, body, legs: [], arms: [], head, tracks, eyes, kind: 'hauler', stacks: [new THREE.Vector3(-0.4, 2.8, 0.67), new THREE.Vector3(0.4, 2.8, 0.67)], eyeLocal: new THREE.Vector3(0, 1.78, -0.35) };
}

export const BUILD = { grunt, spotter, hauler };

// 受击闪白：临时把所有部件换成白色材质
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
export function setFlash(rig, on) {
  if (rig.flashing === on) return; rig.flashing = on;
  rig.g.traverse(o => {
    if (!o.isMesh || !o.userData.part) return;
    if (on) { o.userData.mat = o.material; o.material = flashMat; } else if (o.userData.mat) o.material = o.userData.mat;
  });
}
// 动画：走路摆腿摆臂、身子一颠一颠、头左右看
export function animate(rig, t, speed, ctx = {}) {
  const k = Math.min(1, speed / 2.5), a = Math.sin(t) * k;
  if (rig.kind === 'grunt') {
    rig.legs.forEach((l, i) => l.rotation.x = (i ? a : -a) * 0.7);
    rig.arms.forEach((l, i) => { l.rotation.x = (i ? -a : a) * 0.5 + 0.1; l.rotation.z = (i ? 1 : -1) * (0.12 + Math.abs(a) * 0.08); });
    rig.body.position.y = Math.abs(Math.sin(t)) * 0.07 * k;
    rig.body.rotation.z = Math.sin(t) * 0.07 * k;
    rig.head.position.y = 1.44 + Math.abs(Math.sin(t + 0.6)) * 0.05 * k;
    rig.head.rotation.z = Math.sin(t * 0.5) * 0.08;
  } else if (rig.kind === 'spotter') {
    rig.legs.forEach((l, i) => l.rotation.x = (i ? a : -a) * 0.55);
    rig.body.position.y = Math.abs(Math.cos(t)) * 0.05 * k;
    rig.body.rotation.x = 0.05 * k;
    rig.head.rotation.y = ctx.locking ? 0 : Math.sin(t * 0.37) * 0.35;
    const s = ctx.locking ? 1.25 + Math.sin(t * 25) * 0.15 : 1; rig.lens.scale.set(0.13 * s, 0.02, 0.13 * s);
  } else {
    rig.tracks.forEach(tr => { tr.userData.lugs.position.z = ((t * 0.12) % 0.22); });
    rig.body.position.y = Math.abs(Math.sin(t * 3)) * 0.02;
    rig.head.rotation.x = Math.sin(t * 1.5) * 0.02;
  }
}

// 给 Boss / 小怪造型复用的工具与配色
export const K = { RB, CY, SP, GL, pivot, limb, decal, DECAL, eye, cmat, gmat, sphG, eyeRingG, put, C: { RED, BLK, CRM, STL, TEAL, YEL, ORG } };
