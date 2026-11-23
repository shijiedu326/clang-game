import * as THREE from 'three';
import { K } from './robots.js';
import { P, hurtPlayer } from './player.js';
import { resolve, groundAt } from './world.js';
import { smoke, burst, flashStar } from './fx.js';
import { fire } from './hazards.js';
import { killEnemy } from './enemies.js';

const { RB, CY, SP, GL, pivot, limb, eye, decal, DECAL, sphG, eyeRingG, cmat } = K;
const { RED, BLK, CRM, STL } = K.C;
const SAND = 0xe0c08a, SAND2 = 0xc9a066, BROWN = 0x8a5a2a;
let sd = 3; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;

// ---------- 通用：朝玩家走/保持距离 ----------
function steer(e, dt, want, sp) {
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  e.yaw = Math.atan2(-dx, -dz); e.mesh.rotation.y = e.yaw;
  e.vel.x += (dx / d * want * sp - e.vel.x) * Math.min(1, dt * 5);
  e.vel.z += (dz / d * want * sp - e.vel.z) * Math.min(1, dt * 5);
  if (e.pulled > 0) { e.pulled -= dt; e.vel.set(dx / d * 18, 0, dz / d * 18); if (d < 2.6) e.pulled = 0; }
  e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; resolve(e.pos, e.t.r, e.t.h);
  if (!e.t.fly) e.pos.y = groundAt(e.pos.x, e.pos.z, e.t.r * 0.8, e.pos.y);
  return d;
}

// ================= 沙骸：缠满布条木板的木乃伊机器人，扔沙罐 =================
function buildHusk() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(g, s * 0.18, 0.9, 0); legs.push(hip);
    RB(hip, 0.2, 0.5, 0.22, SAND2, 0, -0.25, 0, 0, 0, 0.05 * s, 0.05);
    RB(hip, 0.18, 0.42, 0.2, SAND, 0, -0.66, 0.02, 0, 0, 0, 0.05);
    RB(hip, 0.24, 0.1, 0.32, BROWN, 0, -0.86, -0.04, 0, 0, 0, 0.03);
  }
  RB(body, 0.58, 0.72, 0.4, SAND2, 0, 1.3, 0, 0, 0, 0, 0.1, 'rusty');
  // 布条/木板缠绕
  for (let i = 0; i < 9; i++) RB(body, 0.64, 0.09, 0.46, i % 2 ? SAND : 0xead3a0, 0, 1.0 + i * 0.08, 0, 0, (R() - .5) * 0.3, (R() - .5) * 0.35, 0.03);
  RB(body, 0.36, 0.28, 0.06, STL, 0, 1.36, -0.24, 0, 0, 0, 0.03, 'metal');
  for (const x of [-0.12, 0.12]) SP(body, 0.025, BLK, x, 1.45, -0.27);
  // 脑袋：布条缠成的方头，一条发光眼缝
  const head = pivot(body, 0, 1.86, 0);
  RB(head, 0.42, 0.42, 0.4, SAND, 0, 0, 0, 0, 0, 0, 0.1, 'rusty');
  for (let i = 0; i < 4; i++) RB(head, 0.46, 0.07, 0.44, i % 2 ? 0xead3a0 : SAND2, 0, -0.14 + i * 0.1, 0, 0, (R() - .5) * 0.4, (R() - .5) * 0.4, 0.02);
  GL(head, new THREE.BoxGeometry(0.3, 0.05, 0.02), 0x5dffd1, 0, 0.04, -0.215);
  RB(head, 0.12, 0.3, 0.1, SAND2, 0.12, 0.28, 0.05, 0, 0, -0.5, 0.03);
  // 手臂 + 举着的沙罐
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(body, s * 0.36, 1.6, 0); arms.push(sh);
    RB(sh, 0.16, 0.5, 0.16, SAND, 0, -0.24, 0, 0, 0, 0, 0.05);
    RB(sh, 0.18, 0.08, 0.18, SAND2, 0, -0.3, 0, 0, 0, 0.3, 0.03);
    RB(sh, 0.14, 0.42, 0.14, SAND2, 0, -0.64, -0.02, 0, 0, 0, 0.05);
  }
  const jar = pivot(arms[1], 0, -0.88, -0.06);
  SP(jar, 0.2, 0xd9b77a, 0, 0, 0, 1, 1.15, 1); CY(jar, 0.205, 0.205, 0.05, RED, 0, 0, 0, 0, 0, 0, 12);
  // 拖在身后的布条
  for (const x of [-0.15, 0.1]) RB(body, 0.1, 0.6, 0.03, 0xead3a0, x, 1.0, 0.24, 0.3, 0, 0, 0.01);
  return { g, body, legs, arms, head, jar, kind: 'husk' };
}
function huskAI(e, dt, time) {
  const r = e.rig;
  const d0 = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  const d = steer(e, dt, d0 > 16 ? 1 : d0 < 9 ? -1 : 0, e.t.speed);
  e.walk += dt * (3 + Math.hypot(e.vel.x, e.vel.z) * 2);
  const a = Math.sin(e.walk) * Math.min(1, Math.hypot(e.vel.x, e.vel.z) / 2);
  r.legs.forEach((l, i) => l.rotation.x = (i ? a : -a) * 0.6);
  r.body.rotation.z = Math.sin(e.walk * 0.5) * 0.08; r.head.rotation.z = Math.sin(time * 1.3) * 0.15;
  e.cd -= dt;
  r.arms[1].rotation.x = e.cd < 0.5 ? -2.6 * (1 - e.cd / 0.5) : 0.2;
  r.arms[0].rotation.x = 0.2 + a * 0.3;
  if (e.cd <= 0 && d < 24) {
    e.cd = 2.4 + R() * 1.2;
    const from = e.pos.clone().add(new THREE.Vector3(0, 2.3, 0));
    const lead = new THREE.Vector3(P.pos.x + P.vel.x * 0.7, P.pos.y + 0.6, P.pos.z + P.vel.z * 0.7);
    fire('jar', from, lead, { time: 1.1, dmg: 8 });
  }
}

// ================= 沙虫：钻地偷袭，冒头咬一口再钻回去 =================
function buildWorm() {
  const g = new THREE.Group();
  const mound = pivot(g, 0, 0, 0);
  SP(mound, 0.9, SAND, 0, 0, 0, 1, 0.35, 1.3); SP(mound, 0.5, SAND2, 0.3, 0.05, 0.6, 1, 0.35, 1);
  const body = pivot(g, 0, -2.6, 0);
  for (let i = 0; i < 5; i++) {
    CY(body, 0.42 - i * 0.02, 0.46 - i * 0.02, 0.42, i % 2 ? BROWN : 0xa8743e, Math.sin(i * 0.6) * 0.08, 0.22 + i * 0.4, -i * 0.04, 0, 0, 0, 14, 'rusty');
    CY(body, 0.47 - i * 0.02, 0.47 - i * 0.02, 0.06, SAND, Math.sin(i * 0.6) * 0.08, 0.42 + i * 0.4, -i * 0.04, 0, 0, 0, 14);
  }
  const head = pivot(body, 0, 2.15, -0.2); head.rotation.x = -0.5;
  CY(head, 0.5, 0.42, 0.4, 0xa8743e, 0, 0, 0, 0, 0, 0, 16, 'rusty');
  GL(head, eyeRingG, 0x7a1010, 0, 0.21, 0).scale.set(0.38, 0.02, 0.38);
  GL(head, eyeRingG, 0xff3b2f, 0, 0.215, 0).scale.set(0.16, 0.02, 0.16);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), cmat(CRM)); t.position.set(Math.cos(a) * 0.36, 0.26, Math.sin(a) * 0.36); t.rotation.set(Math.sin(a) * -0.6, 0, Math.cos(a) * 0.6); t.userData.part = true; head.add(t); }
  for (const x of [-0.18, 0, 0.18]) GL(head, sphG, 0xffd23a, x, 0.05, -0.47).scale.setScalar(0.05);
  return { g, body, head, mound, kind: 'worm' };
}
function wormAI(e, dt, time) {
  const r = e.rig; e.st = e.st || 'under'; e.stT = (e.stT || 0) + dt;
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  e.yaw = Math.atan2(-dx, -dz); e.mesh.rotation.y = e.yaw;
  if (e.st === 'under') {
    e.invuln = true; r.body.position.y = -2.6; r.mound.visible = true;
    r.mound.scale.y = 1 + Math.sin(time * 14) * 0.15;
    const sp = e.t.speed; e.pos.x += dx / d * sp * dt; e.pos.z += dz / d * sp * dt; resolve(e.pos, 0.6, 1);
    if (R() < dt * 12) smoke(e.pos.clone().setY(0.2), 1, 0.5, 0xe6d3a8, 0.4);
    if (d < 2.4 && e.stT > 1.2) { e.st = 'rise'; e.stT = 0; smoke(e.pos.clone().setY(0.3), 8, 1.6, 0xe6d3a8, 1.5); }
  } else if (e.st === 'rise') {
    r.body.position.y = -2.6 + Math.min(1, e.stT / 0.25) * 2.6; r.mound.visible = false; e.invuln = false;
    if (e.stT > 0.25) { e.st = 'up'; e.stT = 0; if (d < 2.6) hurtPlayer(15, e.pos); burst(e.pos.clone().setY(1.5), 0xd9b77a, 12, 7); }
  } else if (e.st === 'up') {
    r.head.rotation.x = -0.5 + Math.sin(time * 9) * 0.2; r.body.rotation.z = Math.sin(time * 4) * 0.1;
    if (e.stT > 1.8) { e.st = 'sink'; e.stT = 0; }
  } else {
    r.body.position.y = -Math.min(1, e.stT / 0.3) * 2.6; e.invuln = e.stT > 0.15;
    if (e.stT > 0.3) { e.st = 'under'; e.stT = 0; smoke(e.pos.clone().setY(0.3), 5, 1.2, 0xe6d3a8, 1); }
  }
  e.pos.y = 0;
}

// ================= 自爆无人机：飞过来滴滴滴然后炸 =================
function buildDrone() {
  const g = new THREE.Group(), body = pivot(g, 0, 0.35, 0);
  SP(body, 0.32, 0xff8a1f, 0, 0, 0, 1, 0.8, 1);
  CY(body, 0.34, 0.34, 0.08, BLK, 0, 0, 0, 0, 0, 0, 16);
  eye(body, 0.12, 0, 0.02, -0.29);
  CY(body, 0.03, 0.03, 0.2, BLK, 0, 0.32, 0, 0, 0, 0, 6);
  const rotor = pivot(body, 0, 0.44, 0);
  RB(rotor, 0.9, 0.03, 0.1, STL, 0, 0, 0, 0, 0, 0, 0.01); RB(rotor, 0.1, 0.03, 0.9, STL, 0, 0, 0, 0, 0, 0, 0.01);
  SP(body, 0.09, RED, 0, -0.28, 0);
  return { g, body, rotor, kind: 'drone' };
}
function droneAI(e, dt, time) {
  const r = e.rig; r.rotor.rotation.y += dt * 40;
  const tgtY = P.pos.y + 1.4 + Math.sin(time * 3 + e.walk) * 0.4;
  const d = steer(e, dt, e.arm ? 0 : 1, e.t.speed);
  e.pos.y += (tgtY - e.pos.y) * Math.min(1, dt * 2);
  r.body.rotation.x = Math.min(0.4, Math.hypot(e.vel.x, e.vel.z) * 0.05);
  if (!e.arm && Math.hypot(d, e.pos.y - P.pos.y - 1) < 2.4) { e.arm = 0.5; }
  if (e.arm) {
    e.arm -= dt; r.body.scale.setScalar(1 + (Math.floor(time * 20) % 2) * 0.15);
    if (e.arm <= 0) {
      flashStar(e.pos.clone(), 2.2); smoke(e.pos.clone(), 5, 1.4, 0xd8d0c0, 1.5); burst(e.pos, 0xff8a1f, 14, 9);
      if (Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z, P.pos.y + 1 - e.pos.y) < 2.8) hurtPlayer(16, e.pos, true);
      e.noScore = true; killEnemy(e, new THREE.Vector3());
    }
  }
}

export const CRITTER_TYPES = {
  husk: { name: '沙骸', en: 'HUSK', no: 6, hp: 40, speed: 2.4, r: 0.5, h: 2.1, head: [0.78, 1], bodyArmor: 0.5, color: SAND, score: 250, build: buildHusk, ai: huskAI, atk: '扔沙罐 · 迷眼减速', weak: '头部（胸口有钢板）', threat: 2 },
  worm: { name: '沙虫', en: 'SAND WORM', no: 7, hp: 30, speed: 6.5, r: 0.6, h: 2.6, head: [0.7, 1], color: BROWN, score: 200, build: buildWorm, ai: wormAI, heavy: true, atk: '藏在地下，冒头就咬', weak: '冒头时打嘴', threat: 2 },
  drone: { name: '自爆蜂', en: 'BOOM BEE', no: 8, hp: 8, speed: 7, r: 0.4, h: 0.8, fly: true, flyY: 4, color: 0xff8a1f, score: 50, build: buildDrone, ai: droneAI, atk: '飞过来自爆', weak: '一碰就碎', threat: 1 },
};
