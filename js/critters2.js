import * as THREE from 'three';
import { K } from './robots.js';
import { P, hurtPlayer } from './player.js';
import { resolve, groundAt } from './world.js';
import { smoke, burst, flashStar, popText } from './fx.js';
import { fire } from './hazards.js';
import { enemies, spawn } from './enemies.js';
import { NO_INK } from './post.js';

// 第二批新敌人：举盾兵 / 修理无人机 / 分裂机器人(+分裂仔) / 埋雷蜘蛛
const { RB, CY, SP, GL, pivot, limb, eye, decal, DECAL, sphG, eyeRingG } = K;
const { RED, BLK, CRM, STL } = K.C;
export const c2Hooks = { spawned: null, sfx: null, shake: null };
const sfx = n => c2Hooks.sfx && c2Hooks.sfx(n);
let scene;
export function initCritters2(s) { scene = s; }

// ---------- 通用 ----------
// 被晕（勾锁/电击/钉枪）就原地晃，返回 true 表示这帧不做别的
function stunned(e, dt) {
  if (!(e.stun > 0)) { e.mesh.rotation.z = 0; return false; }
  e.stun -= dt; e.mesh.rotation.z = Math.sin(e.stun * 30) * 0.15; e.vel.multiplyScalar(0.8);
  e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; resolve(e.pos, e.t.r, e.t.h);
  return true;
}
// 往 (mx,mz) 方向走（单位向量 × want），朝向单独由 turnTo 管
function move(e, dt, mx, mz, sp) {
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  e.vel.x += (mx * sp - e.vel.x) * Math.min(1, dt * 5);
  e.vel.z += (mz * sp - e.vel.z) * Math.min(1, dt * 5);
  if (e.pulled > 0) { e.pulled -= dt; e.stun = 0.9; e.vel.set(dx / d * 18, 0, dz / d * 18); if (d < 2.6) e.pulled = 0; }
  e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; resolve(e.pos, e.t.r, e.t.h);
  if (!e.t.fly) e.pos.y = groundAt(e.pos.x, e.pos.z, e.t.r * 0.8, e.pos.y);
  return d;
}
function turnTo(e, dt, rate) {
  const ty = Math.atan2(-(P.pos.x - e.pos.x), -(P.pos.z - e.pos.z));
  let df = ty - e.yaw; df = Math.atan2(Math.sin(df), Math.cos(df));
  e.yaw += rate ? Math.max(-rate * dt, Math.min(rate * dt, df)) : df;
  e.mesh.rotation.y = e.yaw;
}
const toP = e => { const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d, d]; };

// ================= 举盾兵：举着一扇废车门往前顶，偶尔放下盾扔东西 =================
const SB = 0x5a6f86, SB2 = 0x3f4f63, DOOR = 0xb9b0a0;
function buildShield() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0), legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(g, s * 0.24, 0.8, 0); legs.push(hip);
    RB(hip, 0.24, 0.46, 0.26, SB2, 0, -0.22, 0, 0, 0, 0, 0.06);
    RB(hip, 0.22, 0.36, 0.24, STL, 0, -0.58, 0.02, 0, 0, 0, 0.06, 'metal');
    RB(hip, 0.3, 0.12, 0.42, BLK, 0, -0.76, -0.06, 0, 0, 0, 0.04);
  }
  RB(body, 0.82, 0.78, 0.56, SB, 0, 1.24, 0, 0, 0, 0, 0.14, 'rusty');
  RB(body, 0.86, 0.16, 0.6, SB2, 0, 0.88, 0, 0, 0, 0, 0.05);
  decal(body, DECAL.num('9', '#f2e2bf', '#1b1715'), 0.26, 0.26, 0.24, 1.36, 0.285, 0);
  // 头：矮矮的头盔 + 一条横向观察缝
  const head = pivot(body, 0, 1.78, 0);
  RB(head, 0.5, 0.34, 0.46, SB2, 0, 0, 0, 0, 0, 0, 0.12, 'metal');
  RB(head, 0.56, 0.08, 0.5, BLK, 0, 0.14, 0, 0, 0, 0, 0.03);
  GL(head, new THREE.BoxGeometry(0.34, 0.06, 0.02), 0xff3b2f, 0, 0.01, -0.235);
  // 右手：拳头；左手：车门盾
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(body, s * 0.5, 1.5, 0); arms.push(sh);
    RB(sh, 0.24, 0.24, 0.24, SB2, 0, 0, 0, 0, 0, 0, 0.08);
    RB(sh, 0.18, 0.5, 0.18, STL, 0, -0.32, 0, 0, 0, 0, 0.06, 'metal');
    RB(sh, 0.24, 0.24, 0.26, BLK, 0, -0.62, -0.02, 0, 0, 0, 0.08);
  }
  // 车门盾：铰链装在身体左前方，门板挡住整个正面；放盾时像开车门一样往前甩开
  const shield = pivot(body, -0.72, 1.06, -0.6), D = pivot(shield, 0.68, 0, 0);
  RB(D, 1.36, 1.66, 0.1, DOOR, 0, 0, 0, 0, 0, 0, 0.06, 'rusty');
  RB(D, 1.0, 0.56, 0.04, 0x8fb4c4, 0.04, 0.44, -0.06, 0, 0, 0, 0.03); // 车窗
  RB(D, 0.3, 0.06, 0.06, BLK, 0.42, -0.02, -0.08, 0, 0, 0, 0.02);    // 门把手
  decal(D, DECAL.hazard(), 1.24, 0.46, 0, -0.56, -0.06, Math.PI);
  for (const [x, y] of [[-0.56, 0.72], [0.56, 0.72], [-0.56, -0.72], [0.56, -0.72]]) SP(D, 0.04, BLK, x, y, -0.06);
  for (const y of [-0.5, 0.5]) CY(shield, 0.05, 0.05, 0.22, BLK, 0, y, 0, 0, 0, 0, 8); // 铰链
  return { g, body, legs, arms, head, shield, kind: 'shieldbot' };
}
function shieldAI(e, dt, time) {
  const r = e.rig;
  if (stunned(e, dt)) { e.guardDown = 0.2; r.shield.rotation.y = 0.7; return; }
  const [ux, uz, d] = toP(e);
  turnTo(e, dt, e.guardDown > 0 ? 3 : 1.5);
  e.cd -= dt;
  let want = d > 2.4 ? 1 : 0;
  if (e.guardDown > 0) { e.guardDown -= dt; want = 0; }
  move(e, dt, ux * want, uz * want, e.t.speed * (e.spd || 1));
  const v = Math.hypot(e.vel.x, e.vel.z);
  e.walk += dt * (2.5 + v * 2); const a = Math.sin(e.walk) * Math.min(1, v / 2);
  r.legs.forEach((l, i) => l.rotation.x = (i ? a : -a) * 0.5);
  r.body.rotation.z = Math.sin(e.walk * 0.5) * 0.05;
  // 盾：举着=正对前方；放下=甩到一边露出身子
  const open = e.guardDown > 0 ? 1 : 0;
  r.shield.rotation.y += ((open ? 1.45 : 0) - r.shield.rotation.y) * Math.min(1, dt * 10);
  r.arms[0].rotation.x = -0.7 + open * 0.5; r.arms[0].rotation.z = open * -0.4;
  // 近身：盾撞
  if (d < 3 && e.cd <= 0 && !open) {
    e.cd = 1.6; e.bash = 0.3;
    if (d < 3.2) hurtPlayer(14, e.pos);
    P.vel.x += ux * 9; P.vel.z += uz * 9; burst(new THREE.Vector3(e.pos.x + ux * 1.2, e.pos.y + 1.2, e.pos.z + uz * 1.2), 0xfff1a0, 8, 6);
    sfx('clang');
  }
  if (e.bash > 0) { e.bash -= dt; r.body.position.z = -Math.sin(e.bash / 0.3 * Math.PI) * 0.4; } else r.body.position.z = 0;
  // 中远距离：放下盾，右手扔一团电浆（这时候正面也打得动）
  if (d > 6 && d < 26 && e.cd <= 0 && !open) {
    e.guardDown = 1.1; e.cd = 3.6 + Math.random() * 1.5; e.throwT = 0.55;
  }
  if (e.throwT > 0) {
    r.arms[1].rotation.x = -2.4 * (1 - e.throwT / 0.55);
    if ((e.throwT -= dt) <= 0) {
      r.arms[1].rotation.x = 0.4;
      const from = new THREE.Vector3(e.pos.x, e.pos.y + 2.1, e.pos.z);
      fire('orb', from, new THREE.Vector3(P.pos.x, P.pos.y + 1.1, P.pos.z), { dmg: 9, speed: 18, color: 0xff7a2a });
    }
  } else r.arms[1].rotation.x += (0.2 - r.arms[1].rotation.x) * Math.min(1, dt * 6);
}

// ================= 修理无人机：躲在后面，给受伤的队友接绿色修理光束 =================
const MED = 0xeae4d4, MEDG = 0x3fc46a;
const beamG = new THREE.CylinderGeometry(1, 1, 1, 6), torusG = new THREE.TorusGeometry(0.27, 0.035, 6, 20);
function buildMedic() {
  const g = new THREE.Group(), body = pivot(g, 0, 0.4, 0);
  RB(body, 0.7, 0.4, 0.7, MED, 0, 0, 0, 0, 0, 0, 0.16);
  RB(body, 0.74, 0.08, 0.74, MEDG, 0, -0.05, 0, 0, 0, 0, 0.03);
  decal(body, DECAL.tag('+', '#3fc46a', '#fff6e2'), 0.36, 0.36, 0, 0.21, 0, 0, 0).rotation.x = -Math.PI / 2;
  eye(body, 0.12, 0, 0.02, -0.36, 0x3fff8a);
  const rotors = [];
  for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) {
    CY(body, 0.03, 0.03, 0.2, BLK, x * 0.8, 0.18, z * 0.8, 0, 0, 0, 6);
    const rt = pivot(body, x, 0.3, z); rotors.push(rt);
    RB(rt, 0.5, 0.02, 0.07, STL, 0, 0, 0, 0, 0, 0, 0.01);
    K.put(body, new THREE.Mesh(torusG, K.cmat(MEDG)), x, 0.3, z, Math.PI / 2); // 护圈
  }
  // 下面吊着的修理喷嘴
  const arm = pivot(body, 0, -0.2, 0);
  CY(arm, 0.04, 0.04, 0.32, STL, 0, -0.16, 0, 0, 0, 0, 6);
  CY(arm, 0.1, 0.06, 0.14, BLK, 0, -0.36, 0, 0, 0, 0, 10);
  GL(arm, sphG, 0x7dffa8, 0, -0.44, 0).scale.setScalar(0.07);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0x5dff8f, transparent: true, opacity: 0.7, depthWrite: false }));
  beam.layers.set(NO_INK); beam.visible = false; g.add(beam);
  return { g, body, rotors, arm, beam, kind: 'medic' };
}
const _w = new THREE.Vector3(), _l = new THREE.Vector3(), _n = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function medicAI(e, dt, time) {
  const r = e.rig; r.rotors.forEach((o, i) => o.rotation.y += dt * (i % 2 ? 38 : -38));
  r.beam.visible = false;
  if (e.stun > 0) { e.stun -= dt; e.pos.y = Math.max(1, e.pos.y - dt * 2); r.body.rotation.z = Math.sin(e.stun * 30) * 0.3; return; }
  r.body.rotation.z = 0;
  // 每 0.5 秒重新挑一个最需要修的队友（血量比例最低、18 米内）
  if ((e.pickT = (e.pickT || 0) - dt) <= 0) {
    e.pickT = 0.5; let best = null, bv = 0.98;
    for (const o of enemies) {
      if (o === e || o.dead || o.t.boss || o.type === 'medic' || o.spawnT > 0) continue;
      const k = o.hp / o.maxHp, dd = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z);
      if (k < bv && dd < 18) { bv = k; best = o; }
    }
    e.patient = best;
  }
  const pt = e.patient && !e.patient.dead ? e.patient : null;
  const [ux, uz, d] = toP(e);
  let gx, gz, gy;
  if (pt) { // 停在伤员背后（远离玩家那边）
    const [px, pz] = toP(pt); gx = pt.pos.x - px * 2.6; gz = pt.pos.z - pz * 2.6; gy = pt.pos.y + pt.t.h + 1.6;
  } else { // 没人要修就和玩家保持 13 米左右绕圈
    const k = d > 15 ? 1 : d < 11 ? -1 : 0, side = Math.sin(time * 0.4 + e.walk) > 0 ? 1 : -1;
    gx = e.pos.x + ux * k * 4 - uz * side * 3; gz = e.pos.z + uz * k * 4 + ux * side * 3; gy = P.pos.y + 4.2;
  }
  const mx = gx - e.pos.x, mz = gz - e.pos.z, md = Math.hypot(mx, mz);
  const sp = md > 0.6 ? e.t.speed * (e.spd || 1) * Math.min(1, md / 2) : 0;
  move(e, dt, md ? mx / md : 0, md ? mz / md : 0, sp);
  e.pos.y += (gy + Math.sin(time * 2.2 + e.walk) * 0.25 - e.pos.y) * Math.min(1, dt * 1.6);
  turnTo(e, dt, 0);
  r.body.rotation.x = Math.min(0.35, Math.hypot(e.vel.x, e.vel.z) * 0.06);
  if (pt) {
    const pd = Math.hypot(pt.pos.x - e.pos.x, pt.pos.z - e.pos.z, pt.pos.y + pt.t.h * 0.6 - e.pos.y);
    if (pd < 9) {
      // 光束：从喷嘴到伤员身体中间（在无人机自己的坐标里摆）
      r.arm.updateMatrixWorld(true); _w.set(0, -0.44, 0).applyMatrix4(r.arm.matrixWorld);
      _n.set(pt.pos.x, pt.pos.y + pt.t.h * 0.55, pt.pos.z);
      e.mesh.worldToLocal(_l.copy(_w)); const lb = e.mesh.worldToLocal(_n.clone());
      const len = _l.distanceTo(lb);
      r.beam.visible = true; r.beam.position.copy(_l).lerp(lb, 0.5);
      r.beam.quaternion.setFromUnitVectors(_up, lb.sub(_l).normalize());
      const wob = 0.06 + Math.sin(time * 40) * 0.025; r.beam.scale.set(wob, len, wob);
      r.beam.material.opacity = 0.5 + Math.sin(time * 25) * 0.2;
      const heal = Math.max(10, pt.maxHp * 0.07) * dt;
      if (pt.hp < pt.maxHp) {
        pt.hp = Math.min(pt.maxHp, pt.hp + heal); e.healAcc = (e.healAcc || 0) + heal;
        if ((e.popT = (e.popT || 0) - dt) <= 0 && e.healAcc >= 3) {
          e.popT = 0.6; popText('+' + Math.round(e.healAcc), new THREE.Vector3(pt.pos.x, pt.pos.y + pt.t.h + 0.3, pt.pos.z), 'heal'); e.healAcc = 0;
          burst(_n.clone(), 0x7dffa8, 3, 3, 0.06);
        }
      }
    }
  }
}

// ================= 分裂机器人：两半拼起来的胖子，打死裂成两只小的 =================
const SPA = 0xe8613a, SPB = 0x2fa39a;
function halfBody(p, s, c, k) {
  RB(p, 0.44 * k, 0.9 * k, 0.74 * k, c, s * 0.23 * k, 0, 0, 0, 0, 0, 0.18 * k, 'rusty');
  for (let i = 0; i < 3; i++) SP(p, 0.035 * k, BLK, s * 0.02 * k, (-0.3 + i * 0.3) * k, -0.37 * k); // 中缝铆钉
}
function buildSplitter(k = 1, mini = false) {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0), legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(g, s * 0.24 * k, 0.55 * k, 0); legs.push(hip);
    RB(hip, 0.2 * k, 0.5 * k, 0.22 * k, BLK, 0, -0.26 * k, 0, 0, 0, 0, 0.06 * k);
    RB(hip, 0.28 * k, 0.12 * k, 0.36 * k, s < 0 ? SPA : SPB, 0, -0.5 * k, -0.05 * k, 0, 0, 0, 0.04 * k);
  }
  const core = pivot(body, 0, 1.05 * k, 0);
  if (mini) { halfBody(core, 0, SPA, k * 1.6); }
  else { halfBody(core, -1, SPA, k); halfBody(core, 1, SPB, k); GL(core, new THREE.BoxGeometry(0.05 * k, 0.8 * k, 0.05), 0xffd23a, 0, 0, -0.375 * k); }
  // 两只眼（一半一只）+ 咧嘴
  eye(core, 0.11 * k * (mini ? 1.4 : 1), mini ? 0 : -0.2 * k, 0.18 * k, -0.37 * k);
  if (!mini) eye(core, 0.11 * k, 0.2 * k, 0.18 * k, -0.37 * k, 0x3fe0ff);
  RB(core, 0.42 * k, 0.08 * k, 0.04, BLK, 0, -0.14 * k, -0.375 * k, 0, 0, 0, 0.02);
  // 天线
  CY(core, 0.02 * k, 0.02 * k, 0.3 * k, BLK, mini ? 0 : -0.2 * k, 0.6 * k, 0, 0, 0, 0.2, 6);
  SP(core, 0.06 * k, 0xffd23a, mini ? 0.03 * k : -0.17 * k, 0.75 * k, 0);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(core, s * 0.52 * k, 0.15 * k, 0); arms.push(sh);
    RB(sh, 0.14 * k, 0.5 * k, 0.14 * k, s < 0 ? SPA : SPB, 0, -0.24 * k, 0, 0, 0, 0, 0.05 * k);
    RB(sh, 0.22 * k, 0.22 * k, 0.22 * k, BLK, 0, -0.54 * k, 0, 0, 0, 0, 0.07 * k);
  }
  return { g, body, core, legs, arms, kind: 'splitter' };
}
function chaseAI(e, dt, time) {
  const r = e.rig;
  if (stunned(e, dt)) return;
  const [ux, uz, d] = toP(e);
  turnTo(e, dt, 0);
  const sp = e.t.speed * (e.spd || 1);
  // 被墙卡住就侧着绕
  if (e.detour > 0) { e.detour -= dt; move(e, dt, -uz * e.side, ux * e.side, sp); }
  else {
    move(e, dt, d > 1.8 ? ux : 0, d > 1.8 ? uz : 0, sp);
    const moved = Math.hypot(e.pos.x - (e.px ?? e.pos.x), e.pos.z - (e.pz ?? e.pos.z));
    e.stuck = d > 2 && moved < sp * dt * 0.25 ? (e.stuck || 0) + dt : 0;
    if (e.stuck > 0.4) { e.detour = 0.9; e.side = Math.random() < .5 ? -1 : 1; e.stuck = 0; }
  }
  e.px = e.pos.x; e.pz = e.pos.z;
  const v = Math.hypot(e.vel.x, e.vel.z);
  e.walk += dt * (3 + v * 2.4); const a = Math.sin(e.walk) * Math.min(1, v / 2);
  r.legs.forEach((l, i) => l.rotation.x = (i ? a : -a) * 0.7);
  r.core.rotation.z = Math.sin(e.walk) * 0.08; r.core.position.y = r.core.userData.y0 ?? (r.core.userData.y0 = r.core.position.y);
  r.core.position.y += Math.abs(Math.sin(e.walk)) * 0.06;
  e.cd -= dt;
  r.arms.forEach((s, i) => s.rotation.x = -a * 0.6 * (i ? 1 : -1));
  if (d < 2.2 && e.cd <= 0) {
    e.cd = 1.2; e.punch = 0.25; hurtPlayer(e.t.dmg, e.pos);
  }
  if (e.punch > 0) { e.punch -= dt; r.arms[1].rotation.x = -1.6; }
}
// 死了裂开：左右各蹦出一只分裂仔
function splitOnDeath(e) {
  if (e.noScore) return;
  const hpMul = e.maxHp / e.t.hp / (e.elite ? 1.8 : 1);
  const [ux, uz] = toP(e);
  for (const s of [-1, 1]) {
    const x = e.pos.x - uz * s * 0.8, z = e.pos.z + ux * s * 0.8;
    const m = spawn('splitmini', x, z, hpMul); m.spawnT = 0.25; m.cd = 0.8;
    m.kb = new THREE.Vector3(-uz * s * 6, 0, ux * s * 6);
    c2Hooks.spawned && c2Hooks.spawned(m);
  }
  burst(new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z), 0xffd23a, 16, 8, 0.1);
  popText('SPLIT!', new THREE.Vector3(e.pos.x, e.pos.y + 2.4, e.pos.z), 'crit');
}

// ================= 埋雷蜘蛛：六条腿的扁铁盒，边跑边往地上丢地雷 =================
const SPD = 0x4a4f3a, SPD2 = 0x2e3126;
function buildSpider() {
  const g = new THREE.Group(), body = pivot(g, 0, 0.62, 0), legs = [];
  RB(body, 1.1, 0.34, 1.3, SPD, 0, 0, 0, 0, 0, 0, 0.12, 'rusty');
  RB(body, 0.9, 0.16, 1.0, SPD2, 0, 0.22, 0.05, 0, 0, 0, 0.06);
  decal(body, DECAL.hazard(), 1.0, 0.36, 0, 0.012, -0.655, Math.PI);
  // 背上的地雷架：三颗待投的雷
  const rack = pivot(body, 0, 0.32, 0.2);
  for (const x of [-0.3, 0, 0.3]) { CY(rack, 0.14, 0.16, 0.1, BLK, x, 0, 0, 0, 0, 0, 12); GL(rack, sphG, 0xff3b2f, x, 0.06, 0).scale.setScalar(0.04); }
  // 前脸：两颗凶眼 + 一对小钳
  eye(body, 0.1, -0.22, 0.04, -0.66); eye(body, 0.1, 0.22, 0.04, -0.66);
  RB(body, 0.5, 0.06, 0.04, BLK, 0, 0.16, -0.66, 0, 0, 0, 0.02);
  for (const s of [-1, 1]) RB(body, 0.08, 0.08, 0.3, STL, s * 0.3, -0.12, -0.75, 0.3, -s * 0.3, 0, 0.03, 'metal');
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, z = -0.45 + (i % 3) * 0.45;
    const hip = pivot(body, s * 0.52, -0.02, z); legs.push(hip);
    limb(hip, [0, 0, 0], [s * 0.55, 0.32, 0], 0.09, SPD2);
    limb(hip, [s * 0.55, 0.32, 0], [s * 0.85, -0.62, (i % 3 - 1) * 0.15], 0.07, STL);
  }
  return { g, body, legs, rack, kind: 'spider' };
}
function spiderAI(e, dt, time) {
  const r = e.rig;
  if (stunned(e, dt)) return;
  const [ux, uz, d] = toP(e);
  turnTo(e, dt, 4);
  // 保持 9~16 米，横着跑；定时换方向
  if ((e.sideT = (e.sideT || 0) - dt) <= 0) { e.sideT = 1.5 + Math.random() * 2; e.side = Math.random() < .5 ? -1 : 1; }
  const k = d > 16 ? 1 : d < 9 ? -1 : 0;
  let mx = ux * k - uz * e.side * 0.9, mz = uz * k + ux * e.side * 0.9; const ml = Math.hypot(mx, mz) || 1;
  const bx = e.pos.x, bz = e.pos.z;
  move(e, dt, mx / ml, mz / ml, e.t.speed * (e.spd || 1));
  if (Math.hypot(e.pos.x - bx, e.pos.z - bz) < e.t.speed * dt * 0.2) e.sideT = 0; // 撞墙就换边
  const v = Math.hypot(e.vel.x, e.vel.z);
  e.walk += dt * (6 + v * 3);
  r.legs.forEach((l, i) => { const ph = e.walk + (i % 2) * Math.PI; l.rotation.x = Math.sin(ph) * 0.35; l.rotation.z = Math.max(0, Math.cos(ph)) * 0.25 * (i < 3 ? 1 : -1); });
  r.body.position.y = 0.62 + Math.abs(Math.sin(e.walk)) * 0.05;
  // 丢雷
  e.cd -= dt;
  r.rack.position.y = 0.32 + (e.cd < 0.4 ? Math.sin(time * 40) * 0.03 : 0);
  if (e.cd <= 0) {
    e.cd = 3.4 + Math.random() * 1.4;
    const mine = mines.filter(m => m.owner === e).length;
    if (mine < 4 && mines.length < 12) dropMine(e.pos.x, e.pos.z, e);
  }
  // 贴脸了就用钳子夹一下
  if (d < 2 && !(e.pinch > 0)) { e.pinch = 1.4; hurtPlayer(8, e.pos); }
  if (e.pinch > 0) e.pinch -= dt;
}

// ---------- 地雷 ----------
const mines = [];
const mineBodyG = new THREE.CylinderGeometry(0.32, 0.38, 0.14, 14), mineTopG = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), mineRingG = new THREE.RingGeometry(1.5, 1.62, 32);
const mineMat = K.cmat(0x2b2626, 'metal');
function dropMine(x, z, owner) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(mineBodyG, mineMat); b.position.y = 0.07; g.add(b);
  const top = new THREE.Mesh(mineTopG, new THREE.MeshBasicMaterial({ color: 0xff3b2f })); top.position.y = 0.16; top.layers.set(NO_INK); g.add(top);
  const ring = new THREE.Mesh(mineRingG, new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.layers.set(NO_INK); g.add(ring);
  const y = groundAt(x, z, 0.3, 0); g.position.set(x, y, z); scene.add(g);
  mines.push({ g, top, ring, owner, t: 0, life: 22, arm: 0, ph: Math.random() * 6 });
  sfx('tink');
}
export function clearMines() { mines.forEach(m => scene.remove(m.g)); mines.length = 0; }
export function mineCount() { return mines.length; }
function mineBoom(m, dmg) {
  const c = m.g.position.clone().setY(m.g.position.y + 0.5);
  flashStar(c, 2.4); smoke(c, 6, 1.6, 0xd8d0c0, 1.6); burst(c, 0xff8a1f, 14, 9, 0.1);
  sfx('boom'); c2Hooks.shake && c2Hooks.shake(0.6);
  if (dmg && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 2.6 && Math.abs(P.pos.y - m.g.position.y) < 2) hurtPlayer(dmg, c);
}
export function updateMines(dt) {
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i]; m.t += dt; m.ph += dt;
    const s = Math.min(1, m.t / 0.3); m.g.scale.setScalar(s);
    if (m.arm > 0) { // 踩上了：滴一声就炸
      m.arm -= dt; m.top.material.color.setHex(Math.floor(m.arm * 30) % 2 ? 0xffffff : 0xff3b2f); m.ring.material.opacity = 0.8;
      if (m.arm <= 0) { mineBoom(m, 18); scene.remove(m.g); mines.splice(i, 1); }
      continue;
    }
    const on = Math.sin(m.ph * 6) > 0.6; m.top.material.color.setHex(on ? 0xff3b2f : 0x5a1410);
    m.ring.material.opacity = 0.18 + (on ? 0.2 : 0);
    if (m.t > m.life) { smoke(m.g.position.clone().setY(0.3), 3, 0.6, 0x9a9488, 0.8); scene.remove(m.g); mines.splice(i, 1); continue; }
    if (m.t > 0.8 && Math.hypot(P.pos.x - m.g.position.x, P.pos.z - m.g.position.z) < 1.6 && Math.abs(P.pos.y - m.g.position.y) < 1.4) { m.arm = 0.35; sfx('beep'); }
  }
}
// 爆炸能把地雷一起引爆（不伤玩家以外的敌人，免得连环太乱）
export function detonateMines(c, radius) {
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    if (m.arm <= 0 && Math.hypot(m.g.position.x - c.x, m.g.position.z - c.z) < radius) m.arm = 0.12;
  }
}

export const CRITTER2_TYPES = {
  shieldbot: { name: '举盾兵', en: 'DOORMAN', no: 9, hp: 80, speed: 2.7, r: 0.7, h: 2.1, head: [0.8, 1], color: SB, score: 300, build: buildShield, ai: shieldAI, frontArmor: true, heavy: true, stunOK: true, atk: '车门盾顶人 · 放下盾扔电浆', weak: '侧面、背后，放下盾扔东西的时候', armor: '正面车门盾 · 减伤 88%', threat: 2 },
  medic: { name: '修理无人机', en: 'PATCH-UP', no: 10, hp: 30, speed: 6, r: 0.55, h: 0.9, fly: true, flyY: 4, color: MEDG, score: 250, build: buildMedic, ai: medicAI, stunOK: true, atk: '给受伤的队友接修理光束（每秒回 7% 血）', weak: '一碰就碎 · 先打它', threat: 2 },
  splitter: { name: '分裂机器人', en: 'SPLITTER', no: 11, hp: 70, speed: 3.4, r: 0.6, h: 1.9, head: [0.75, 1], color: SPA, score: 200, dmg: 12, build: () => buildSplitter(1), ai: chaseAI, onDeath: splitOnDeath, stunOK: true, atk: '冲过来抡拳', weak: '打死会裂成两只分裂仔，别贴脸打', threat: 2 },
  splitmini: { name: '分裂仔', en: 'SPLITLING', no: 12, hp: 18, speed: 5.4, r: 0.4, h: 1.1, head: [0.65, 1], color: SPA, score: 60, dmg: 6, build: () => buildSplitter(0.55, true), ai: chaseAI, stunOK: true, atk: '跑得很快，咬一口就跑', weak: '血很少', threat: 1 },
  spider: { name: '埋雷蜘蛛', en: 'MINELAYER', no: 13, hp: 55, speed: 4.6, r: 0.9, h: 1.0, head: [0.5, 1], color: SPD, score: 300, build: buildSpider, ai: spiderAI, stunOK: true, atk: '边跑边丢地雷（红圈里别站）', weak: '腿短跑不快 · 炸药能把雷提前引爆', threat: 2 },
};
export const __mines = () => mines;
