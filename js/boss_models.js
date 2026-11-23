import * as THREE from 'three';
import { K } from './robots.js';

const { RB, CY, SP, GL, pivot, limb, eye, decal, DECAL, sphG, eyeRingG, cmat } = K;
const { RED, BLK, CRM, STL, TEAL, YEL, ORG } = K.C;
const GUN = 0x5a6470, SAND = 0xe0c08a, SAND2 = 0xc9a066, BROWN = 0x8a5a2a;
const brow = (p, x, y, z, w, rz) => RB(p, w, 0.1, 0.1, BLK, x, y, z, 0, 0, rz, 0.03);
function saw(p, r) { // 圆锯：盘 + 齿 + 红色轴心
  const s = pivot(p, 0, 0, 0);
  CY(s, r, r, 0.06, 0xc9d2d8, 0, 0, 0, 0, 0, 0, 28, 'metal');
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; RB(s, 0.14, 0.07, 0.14, 0xe8eef2, Math.cos(a) * r, 0, Math.sin(a) * r, 0, -a + 0.6, 0, 0.01); }
  CY(s, r * 0.3, r * 0.3, 0.12, RED, 0, 0, 0, 0, 0, 0, 14);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; CY(s, 0.07, 0.07, 0.08, BLK, Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6, 0, 0, 0, 10); }
  return s;
}

// ① 屠宰机：红色驼背大块头，两手圆锯，肚子上一张铁栅牙嘴
export function butcher() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0), legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(g, s * 0.6, 1.35, 0); legs.push(hip);
    RB(hip, 0.55, 0.7, 0.6, BLK, 0, -0.3, 0, 0, 0, 0, 0.15);
    RB(hip, 0.6, 0.55, 0.62, RED, 0, -0.85, -0.05, 0, 0, 0, 0.15, 'rusty');
    RB(hip, 0.4, 0.3, 0.2, CRM, 0, -0.62, -0.38, 0, 0, 0, 0.05);
    RB(hip, 0.8, 0.26, 1.05, BLK, 0, -1.2, -0.12, 0, 0, 0, 0.08);
  }
  RB(body, 1.6, 0.4, 1.1, BLK, 0, 1.45, 0, 0, 0, 0, 0.1);
  RB(body, 2.2, 1.7, 1.6, RED, 0, 2.4, 0.1, 0.12, 0, 0, 0.35, 'rusty');
  RB(body, 2.26, 0.2, 1.66, 0xffffff, 0, 1.75, 0.08, 0.12, 0, 0, 0.06, 'hazard');
  // 肚子上的牙嘴
  RB(body, 1.3, 0.6, 0.12, 0x1a1414, 0, 2.15, -0.72, 0.12, 0, 0, 0.05);
  GL(body, new THREE.BoxGeometry(1.1, 0.3, 0.02), 0xff5a1a, 0, 2.15, -0.76, 0.12);
  for (let i = 0; i < 6; i++) { RB(body, 0.14, 0.18, 0.1, CRM, -0.5 + i * 0.2, 2.38, -0.78, 0.12, 0, 0, 0.02); RB(body, 0.14, 0.18, 0.1, CRM, -0.4 + i * 0.16, 1.93, -0.74, 0.12, 0, 0, 0.02); }
  decal(body, DECAL.star(), 0.6, 0.6, 0.75, 2.85, -0.55, Math.PI);
  for (const s of [-1, 1]) { CY(body, 0.16, 0.16, 1.0, BLK, s * 0.55, 3.4, 0.7, -0.3, 0, 0, 10); CY(body, 0.2, 0.16, 0.12, STL, s * 0.55, 3.88, 0.85, -0.3, 0, 0, 10, 'metal'); }
  const head = pivot(body, 0, 3.25, -0.45);
  RB(head, 0.9, 0.6, 0.75, BLK, 0, 0.1, 0, 0, 0, 0, 0.2, 'metal');
  eye(head, 0.22, 0, 0.12, -0.4);
  brow(head, -0.18, 0.34, -0.42, 0.42, -0.35); brow(head, 0.18, 0.34, -0.42, 0.42, 0.35);
  const arms = [], saws = [];
  for (const s of [-1, 1]) {
    const sh = pivot(body, s * 1.2, 2.9, 0); arms.push(sh);
    SP(sh, 0.38, BLK, 0, 0, 0);
    RB(sh, 0.42, 0.75, 0.42, STL, s * 0.05, -0.5, 0, 0, 0, 0, 0.12, 'metal');
    RB(sh, 0.62, 0.7, 0.62, RED, s * 0.08, -1.15, -0.1, 0, 0, 0, 0.15, 'rusty');
    RB(sh, 0.66, 0.12, 0.66, CRM, s * 0.08, -0.85, -0.1, 0, 0, 0, 0.04);
    const sw = pivot(sh, s * 0.1, -1.55, -0.45); sw.rotation.z = Math.PI / 2;
    saws.push(saw(sw, 0.85));
  }
  return { g, body, legs, arms, head, saws, kind: 'butcher', eyeLocal: new THREE.Vector3(0, 3.35, -0.85) };
}

// ② 流沙巨口：大沙虫，圆嘴两圈牙，背上甲片
export function maw() {
  const g = new THREE.Group(), mound = pivot(g, 0, 0, 0);
  SP(mound, 2.4, SAND, 0, 0, 0, 1, 0.35, 1.2); SP(mound, 1.4, SAND2, 1, 0.05, 1.2, 1, 0.35, 1);
  const body = pivot(g, 0, -6.5, 0), segs = [];
  for (let i = 0; i < 6; i++) {
    const sg = pivot(body, 0, 0.55 + i * 0.95, 0); segs.push(sg);
    CY(sg, 1.45 - i * 0.04, 1.55 - i * 0.04, 0.95, i % 2 ? BROWN : 0xa8743e, 0, 0, 0, 0, 0, 0, 20, 'rusty');
    CY(sg, 1.6 - i * 0.04, 1.6 - i * 0.04, 0.14, SAND, 0, 0.45, 0, 0, 0, 0, 20);
    RB(sg, 1.2, 0.5, 0.5, SAND2, 0, 0.1, 1.3, 0.3, 0, 0, 0.1, 'rusty');
  }
  const head = pivot(body, 0, 6.0, -0.4); head.rotation.x = -0.75;
  CY(head, 1.7, 1.5, 1.1, 0xa8743e, 0, 0, 0, 0, 0, 0, 24, 'rusty');
  CY(head, 1.75, 1.75, 0.16, BLK, 0, 0.5, 0, 0, 0, 0, 24);
  GL(head, eyeRingG, 0x5a0c0c, 0, 0.56, 0).scale.set(1.3, 0.02, 1.3);
  GL(head, eyeRingG, 0xff5a1a, 0, 0.57, 0).scale.set(0.6, 0.02, 0.6);
  for (const [n, rr, len] of [[18, 1.4, 0.55], [12, 0.95, 0.4]]) for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, t = new THREE.Mesh(new THREE.ConeGeometry(0.12, len, 5), cmat(CRM));
    t.position.set(Math.cos(a) * rr, 0.62, Math.sin(a) * rr); t.rotation.set(Math.sin(a) * -0.7, 0, Math.cos(a) * 0.7); t.userData.part = true; head.add(t);
  }
  for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36; GL(head, sphG, 0xffd23a, Math.sin(a) * 1.55, 0.1 + (i % 2) * 0.25, -Math.cos(a) * 1.55).scale.setScalar(0.12); }
  return { g, body, head, mound, segs, kind: 'maw', eyeLocal: new THREE.Vector3(0, 6.3, -1.2) };
}

// ③ 铁砧：双履带重型坦克，顶上迫击炮塔，正面厚装甲，背后反应堆是弱点
export function anvil() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0), tracks = [];
  for (const s of [-1, 1]) {
    const t = pivot(g, s * 1.55, 0.55, 0); tracks.push(t);
    RB(t, 0.8, 1.1, 3.8, BLK, 0, 0, 0, 0, 0, 0, 0.4);
    for (const z of [-1.3, -0.45, 0.45, 1.3]) CY(t, 0.4, 0.4, 0.84, STL, 0, 0, z, 0, 0, Math.PI / 2, 14, 'metal');
    const lugs = pivot(t, 0, 0, 0); t.userData.lugs = lugs;
    for (let i = 0; i < 16; i++) RB(lugs, 0.84, 0.08, 0.14, 0x1a1616, 0, 0.56, -1.8 + i * 0.24, 0, 0, 0, 0.02);
  }
  RB(body, 2.6, 1.2, 3.6, GUN, 0, 1.45, 0, 0, 0, 0, 0.25, 'rusty');
  RB(body, 2.7, 0.18, 3.7, RED, 0, 0.95, 0, 0, 0, 0, 0.06);
  for (const s of [-1, 1]) decal(body, DECAL.star(), 0.8, 0.8, s * 1.31, 1.5, 0.4, s * Math.PI / 2);
  // 正面装甲板
  for (let i = 0; i < 3; i++) RB(body, 2.9, 0.5, 0.3, YEL, 0, 0.9 + i * 0.45, -1.9 - i * 0.08, 0.35, 0, 0, 0.06, 'rusty');
  decal(body, DECAL.hazard(), 2.8, 2.8, 0, 1.36, -2.09, Math.PI);
  // 背后反应堆（发光，弱点）
  RB(body, 1.6, 0.9, 0.3, BLK, 0, 1.5, 1.9, 0, 0, 0, 0.08);
  GL(body, new THREE.BoxGeometry(1.3, 0.6, 0.06), 0xff7a1a, 0, 1.5, 2.06);
  for (let i = 0; i < 3; i++) RB(body, 1.4, 0.06, 0.1, BLK, 0, 1.3 + i * 0.2, 2.1, 0, 0, 0, 0.02);
  // 炮塔
  const head = pivot(body, 0, 2.05, 0.2);
  RB(head, 1.8, 0.9, 1.8, RED, 0, 0.45, 0, 0, 0, 0, 0.3, 'rusty');
  RB(head, 1.4, 0.22, 0.08, BLK, 0, 0.55, -0.9, 0, 0, 0, 0.03);
  GL(head, new THREE.BoxGeometry(1.1, 0.08, 0.02), 0xff3b2f, 0, 0.55, -0.95);
  brow(head, -0.4, 0.78, -0.92, 0.6, -0.25); brow(head, 0.4, 0.78, -0.92, 0.6, 0.25);
  const barrel = pivot(head, 0, 0.7, -0.3); barrel.rotation.x = -0.9;
  CY(barrel, 0.32, 0.4, 2.0, BLK, 0, 1.0, 0, 0, 0, 0, 16, 'metal');
  CY(barrel, 0.44, 0.44, 0.3, STL, 0, 2.0, 0, 0, 0, 0, 16, 'metal');
  GL(barrel, eyeRingG, 0xff8a1f, 0, 2.16, 0).scale.set(0.28, 0.02, 0.28);
  return { g, body, head, barrel, tracks, kind: 'anvil', muzzle: new THREE.Vector3(0, 4.6, -1.6), eyeLocal: new THREE.Vector3(0, 2.6, -1.2) };
}

// ④ 蜂巢：悬浮运输机，黄黑六角蜂窝外壳，四个旋翼，肚子红色舱门是弱点
export function hive() {
  const g = new THREE.Group(), body = pivot(g, 0, 1.2, 0);
  CY(body, 2.0, 2.3, 1.4, YEL, 0, 0, 0, 0, 0, 0, 6, 'rusty');
  CY(body, 2.35, 2.35, 0.18, BLK, 0, -0.5, 0, 0, 0, 0, 6);
  CY(body, 1.6, 2.0, 0.6, BLK, 0, 0.95, 0, 0, 0, 0, 6, 'metal');
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; decal(body, DECAL.hazard(), 1.8, 1.8, Math.sin(a) * 2.04, 0.05, Math.cos(a) * 2.04, a); }
  const hatch = pivot(body, 0, -0.75, 0);
  CY(hatch, 1.2, 1.0, 0.25, RED, 0, 0, 0, 0, 0, 0, 16, 'rusty');
  GL(hatch, eyeRingG, 0xff7a1a, 0, -0.14, 0).scale.set(0.8, 0.03, 0.8);
  const eyes = [eye(body, 0.3, -0.5, 0.3, -2.0), eye(body, 0.3, 0.5, 0.3, -2.0)];
  brow(body, -0.5, 0.72, -2.02, 0.6, -0.3); brow(body, 0.5, 0.72, -2.02, 0.6, 0.3);
  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4;
    RB(body, 0.3, 0.25, 2.2, BLK, Math.sin(a) * 2.6, 0.5, Math.cos(a) * 2.6, 0, a, 0, 0.08);
    CY(body, 0.45, 0.45, 0.5, STL, Math.sin(a) * 3.5, 0.6, Math.cos(a) * 3.5, 0, 0, 0, 12, 'metal');
    const r = pivot(body, Math.sin(a) * 3.5, 0.92, Math.cos(a) * 3.5); rotors.push(r);
    RB(r, 2.4, 0.05, 0.25, STL, 0, 0, 0, 0, 0, 0, 0.02); RB(r, 0.25, 0.05, 2.4, STL, 0, 0, 0, 0, 0, 0, 0.02);
  }
  for (const s of [-1, 1]) { CY(body, 0.3, 0.3, 1.2, BLK, s * 1.6, -0.4, -1.2, Math.PI / 2, 0, 0, 10); GL(body, eyeRingG, 0xff3b2f, s * 1.6, -0.4, -1.82, Math.PI / 2).scale.set(0.2, 0.02, 0.2); }
  return { g, body, hatch, rotors, eyes, kind: 'hive', eyeLocal: new THREE.Vector3(0, 0.8, -2.0) };
}

// ⑤ 起重巨人：两条桁架长腿的黄色塔吊，吊臂挂破拆球，独眼射激光
export function titan() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0), legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(g, s * 0.9, 3.8, 0); legs.push(hip);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) limb(hip, [x, 0, z], [x * 1.5, -3.5, z * 1.5], 0.12, YEL);
    for (let y = -0.6; y > -3.4; y -= 0.7) RB(hip, 0.6, 0.08, 0.6, BLK, 0, y, 0, 0, 0, 0, 0.02);
    RB(hip, 1.1, 0.35, 1.5, BLK, 0, -3.62, -0.1, 0, 0, 0, 0.1);
  }
  RB(body, 2.4, 1.6, 2.0, YEL, 0, 4.6, 0, 0, 0, 0, 0.3, 'rusty');
  RB(body, 2.46, 0.2, 2.06, 0xffffff, 0, 3.95, 0, 0, 0, 0, 0.05, 'hazard');
  decal(body, DECAL.num('25', '#1b1715', '#f5c518'), 0.8, 0.8, 0.6, 4.6, -1.01, Math.PI);
  // 驾驶舱脑袋
  const head = pivot(body, 0, 5.75, -0.3);
  RB(head, 1.4, 1.0, 1.2, YEL, 0, 0.3, 0, 0, 0, 0, 0.25, 'rusty');
  RB(head, 1.2, 0.5, 0.06, 0x1d2a33, 0, 0.35, -0.6, 0, 0, 0, 0.03);
  eye(head, 0.24, 0, 0.36, -0.64);
  brow(head, 0, 0.72, -0.62, 1.0, 0);
  CY(head, 0.04, 0.04, 1.0, BLK, 0.5, 1.2, 0.3, 0, 0, 0, 6); GL(head, sphG, 0xff3b2f, 0.5, 1.72, 0.3).scale.setScalar(0.08);
  // 吊臂 + 破拆球
  const jib = pivot(body, 1.1, 5.0, 0);
  limb(jib, [0, 0, 0], [3.6, 1.6, 0], 0.32, YEL); limb(jib, [0, 0.5, 0], [3.6, 1.6, 0], 0.18, BLK);
  for (let i = 1; i < 6; i++) RB(jib, 0.08, 0.6, 0.3, BLK, i * 0.6, i * 0.27 + 0.2, 0, 0, 0, -0.4, 0.02);
  const ball = pivot(g, 0, 0, 0);
  SP(ball, 0.9, BLK, 0, 0, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; RB(ball, 0.2, 0.5, 0.2, STL, Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, 0, 0, Math.PI / 2 - a, 0.04).rotation.set(0, -a, Math.PI / 2); }
  RB(ball, 0.3, 0.5, 0.3, STL, 0, 0.9, 0, 0, 0, 0, 0.04); RB(ball, 0.3, 0.5, 0.3, STL, 0, -0.9, 0, 0, 0, 0, 0.04);
  const chain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2a2a2a })); g.add(chain);
  const arms = [];
  const arm2 = pivot(body, -1.3, 4.9, 0); arms.push(arm2);
  SP(arm2, 0.4, BLK, 0, 0, 0); limb(arm2, [0, 0, 0], [-0.3, -1.6, -0.4], 0.35, YEL);
  RB(arm2, 0.6, 0.5, 0.6, BLK, -0.35, -1.85, -0.45, 0, 0, 0, 0.1);
  return { g, body, legs, arms, head, jib, ball, chain, kind: 'titan', jibTip: new THREE.Vector3(4.7, 6.6, 0), eyeLocal: new THREE.Vector3(0, 6.1, -1.0) };
}

// ⑥ 未完工的机器：缠着脚手架的半成品巨像，胸口裸露的能量核心，一边是钳臂一边是吊钩
export function unfinished() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0);
  // 底座履带台
  RB(body, 4.6, 1.2, 4.0, BLK, 0, 0.6, 0, 0, 0, 0, 0.3);
  for (const s of [-1, 1]) for (const z of [-1.3, 0, 1.3]) CY(body, 0.5, 0.5, 0.6, STL, s * 2.35, 0.6, z, 0, 0, Math.PI / 2, 14, 'metal');
  RB(body, 4.7, 0.2, 4.1, 0xffffff, 0, 1.25, 0, 0, 0, 0, 0.05, 'hazard');
  // 躯干：一半刷了漆，一半还是灰底
  RB(body, 3.4, 3.2, 2.6, GUN, 0, 3.0, 0, 0, 0, 0, 0.4, 'rusty');
  RB(body, 1.7, 3.2, 2.62, RED, 0.85, 3.0, 0, 0, 0, 0, 0.3, 'rusty');
  // 核心：笼子 + 发光球
  const core = pivot(body, 0, 3.2, -1.1);
  GL(core, sphG, 0x5dffd1, 0, 0, 0).scale.setScalar(0.55);
  GL(core, sphG, 0xffffff, 0, 0, -0.1).scale.setScalar(0.28);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; RB(core, 0.08, 1.3, 0.08, BLK, Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65 - 0.1, 0, 0, 0, 0.02); }
  // 盖住核心的装甲板（二阶段掉落）
  const plates = [];
  for (const [x, y] of [[-0.45, 3.55], [0.45, 3.55], [-0.45, 2.85], [0.45, 2.85]]) plates.push(RB(body, 0.9, 0.7, 0.25, YEL, x, y, -1.38, 0, 0, 0, 0.06, 'rusty'));
  // 脑袋：三只眼
  const head = pivot(body, 0, 4.9, -0.3);
  RB(head, 1.8, 1.1, 1.5, BLK, 0, 0.4, 0, 0, 0, 0, 0.3, 'metal');
  const eyes = [eye(head, 0.22, -0.5, 0.42, -0.78), eye(head, 0.3, 0, 0.5, -0.78), eye(head, 0.22, 0.5, 0.42, -0.78)];
  brow(head, -0.5, 0.75, -0.78, 0.5, -0.4); brow(head, 0.5, 0.75, -0.78, 0.5, 0.4);
  RB(head, 2.0, 0.15, 0.1, 0xffffff, 0, 1.0, -0.76, 0, 0, 0.08, 0.02, 'hazard');
  // 脚手架
  for (const s of [-1, 1]) for (const z of [-1.6, 1.6]) limb(body, [s * 2.0, 1.2, z], [s * 2.0, 6.4, z], 0.12, YEL);
  for (const y of [2.4, 4.0, 5.6]) for (const s of [-1, 1]) { limb(body, [s * 2.0, y, -1.6], [s * 2.0, y, 1.6], 0.1, YEL); limb(body, [-2.0, y, s * 1.6], [2.0, y, s * 1.6], 0.1, YEL); }
  limb(body, [-2.0, 2.4, -1.6], [-2.0, 4.0, 1.6], 0.08, BLK); limb(body, [2.0, 4.0, -1.6], [2.0, 5.6, 1.6], 0.08, BLK);
  decal(body, DECAL.tag('WIP', '#f5c518', '#1b1715'), 1.2, 1.2, -1.2, 4.1, -1.31, Math.PI);
  // 左：大钳臂
  const arms = [];
  const L = pivot(body, -2.1, 4.2, -0.2); arms.push(L);
  SP(L, 0.6, BLK, 0, 0, 0); limb(L, [0, 0, 0], [-0.6, -1.6, -0.8], 0.55, RED);
  for (const s of [-1, 1]) RB(L, 0.22, 1.0, 0.3, CRM, -0.6 + s * 0.22, -2.3, -1.0, 0.3, 0, s * 0.35, 0.05);
  // 右：吊钩 + 垂下的电线
  const Rr = pivot(body, 2.1, 4.4, 0); arms.push(Rr);
  limb(Rr, [0, 0, 0], [1.4, 0.6, -0.4], 0.35, GUN);
  CY(Rr, 0.03, 0.03, 2.2, BLK, 1.4, -0.5, -0.4, 0, 0, 0, 6);
  RB(Rr, 0.5, 0.6, 0.2, YEL, 1.4, -1.8, -0.4, 0, 0, 0, 0.08);
  for (let i = 0; i < 3; i++) CY(body, 0.04, 0.04, 1.6 + i * 0.4, [RED, TEAL, YEL][i], -1.2 + i * 0.3, 1.9, 1.3, 0.2, 0, 0.1 * i, 6);
  return { g, body, head, core, plates, eyes, arms, kind: 'unfinished', eyeLocal: new THREE.Vector3(0, 5.4, -1.1) };
}
