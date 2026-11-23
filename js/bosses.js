import * as THREE from 'three';
import { P, hurtPlayer } from './player.js';
import { resolve, groundAt, rayWorld, findSpot } from './world.js';
import { smoke, burst, flashStar, popText } from './fx.js';
import { fire, shockwave, sweep, warnCircle } from './hazards.js';
import { spawn } from './enemies.js';
import * as M from './boss_models.js';

// Boss 行为。每个 Boss 是一个小状态机：e.st 当前招式，e.stT 招式计时
export const bossHooks = { sfx: null, shake: null, phase: null };
const sfx = n => bossHooks.sfx && bossHooks.sfx(n);
const shake = k => bossHooks.shake && bossHooks.shake(k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toP = e => { const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z; return { dx, dz, d: Math.hypot(dx, dz) || 1 }; };
function turn(e, dt, rate) {
  const { dx, dz } = toP(e); const ty = Math.atan2(-dx, -dz);
  const df = Math.atan2(Math.sin(ty - e.yaw), Math.cos(ty - e.yaw));
  e.yaw += clamp(df, -rate * dt, rate * dt); e.mesh.rotation.y = e.yaw; return df;
}
function move(e, dt, sp) {
  const x0 = e.pos.x, z0 = e.pos.z;
  e.pos.x += -Math.sin(e.yaw) * sp * dt; e.pos.z += -Math.cos(e.yaw) * sp * dt;
  resolve(e.pos, e.t.r, e.t.h);
  if (!e.t.fly) e.pos.y = groundAt(e.pos.x, e.pos.z, e.t.r * 0.6, e.pos.y);
  return Math.hypot(e.pos.x - x0, e.pos.z - z0);
}
const go = (e, st) => { e.st = st; e.stT = 0; e.did = 0; };
function phases(e, cuts) { // 血量跌破阈值进入下一阶段
  e.phase = e.phase || 0;
  if (e.phase < cuts.length && e.hp / e.maxHp < cuts[e.phase]) { e.phase++; bossHooks.phase && bossHooks.phase(e); return true; }
  return false;
}
function adds(type, n) {
  for (let i = 0; i < n; i++) { const p = findSpot(P.pos.x, P.pos.z, 12, 22); if (p) spawn(type, p.x, p.z, 1); }
}
const fwd = e => new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
const world = (e, v) => { e.mesh.updateMatrixWorld(); return v.clone().applyMatrix4(e.mesh.matrixWorld); };
const eyeTarget = () => new THREE.Vector3(P.pos.x, P.pos.y + 1.3, P.pos.z);
function walkLegs(r, t, k, amp = 0.5) { if (r.legs) r.legs.forEach((l, i) => l.rotation.x = Math.sin(t) * (i ? 1 : -1) * amp * k); }

// ---------------- ① 屠宰机 ----------------
function butcherAI(e, dt, time) {
  const r = e.rig; e.st = e.st || 'walk'; e.stT = (e.stT || 0) + dt;
  e.chargeCd = (e.chargeCd ?? 4) - dt; e.slamCd = (e.slamCd ?? 8) - dt;
  phases(e, [0.5]);
  const { d } = toP(e);
  let spin = 6;
  if (e.st === 'walk') {
    const df = turn(e, dt, 2.2); const sp = e.phase ? 4.2 : 3.4; move(e, dt, Math.abs(df) < 1 ? sp : 0.5);
    e.walk += dt * 5; walkLegs(r, e.walk, 1, 0.45); r.body.position.y = Math.abs(Math.sin(e.walk)) * 0.12;
    r.arms.forEach((a, i) => { a.rotation.x = 0.2 + Math.sin(e.walk + i * Math.PI) * 0.25; });
    if (d < 4.2) go(e, 'swipe');
    else if (e.chargeCd <= 0 && d > 7) { go(e, 'warn'); sfx('roar'); }
    else if (e.phase && e.slamCd <= 0) go(e, 'slamUp');
  } else if (e.st === 'swipe') {
    turn(e, dt, 3); const k = e.stT / 0.45; spin = 30;
    r.arms.forEach((a, i) => a.rotation.x = e.stT < 0.45 ? -1.6 * k : -1.6 + (e.stT - 0.45) * 8);
    if (e.stT > 0.45 && !e.did) { e.did = 1; sfx('saw'); shake(0.5); if (d < 4.8) { hurtPlayer(26, e.pos, true); const f = fwd(e); P.vel.x += f.x * 12; P.vel.z += f.z * 12; P.vel.y = 5; } }
    if (e.stT > 0.9) go(e, 'walk');
  } else if (e.st === 'warn') {
    turn(e, dt, 5); spin = 40; r.body.rotation.x = -0.25 * Math.min(1, e.stT * 3);
    r.arms.forEach(a => a.rotation.x = -0.9);
    if (!e.did) { e.did = 1; const f = fwd(e); for (let s = 3; s < 22; s += 3.2) warnCircle(e.pos.x + f.x * s, e.pos.z + f.z * s, 1.3, 0.9); }
    if (e.stT > 0.9) { go(e, 'charge'); sfx('charge'); }
  } else if (e.st === 'charge') {
    spin = 50; r.body.rotation.x = -0.35; e.walk += dt * 14; walkLegs(r, e.walk, 1, 0.8);
    const moved = move(e, dt, 20);
    if (Math.random() < 0.6) smoke(e.pos.clone().setY(0.3), 1, 1, 0xe6d3a8, 0.5);
    if (d < 2.6 && !e.did) { e.did = 1; hurtPlayer(32, e.pos, true); const f = fwd(e); P.vel.set(f.x * 18, 8, f.z * 18); shake(1); }
    if (moved < 20 * dt * 0.4 && e.stT > 0.1) { go(e, 'stun'); sfx('slam'); shake(1); flashStar(e.pos.clone().setY(2.5), 3); popText('撞墙了!', e.pos.clone().setY(4.2), 'ko'); }
    else if (e.stT > 1.3) { go(e, 'walk'); e.chargeCd = 6 + Math.random() * 2; }
  } else if (e.st === 'stun') {
    e.exposed = true; spin = 0; r.body.rotation.x = 0.3; r.head.rotation.z = Math.sin(time * 6) * 0.3;
    if (Math.random() < 0.15) burst(e.pos.clone().setY(3.6), 0xffd21f, 2, 3);
    if (e.stT > 2.4) { e.exposed = false; r.head.rotation.z = 0; r.body.rotation.x = 0; go(e, 'walk'); e.chargeCd = 6; }
  } else if (e.st === 'slamUp') {
    const k = Math.min(1, e.stT / 0.6); e.mesh.position.y = groundAt(e.pos.x, e.pos.z, 1, 0) + Math.sin(k * Math.PI * 0.5) * 3;
    r.arms.forEach(a => a.rotation.x = -2.6 * k);
    if (e.stT > 0.6) go(e, 'slamDown');
  } else if (e.st === 'slamDown') {
    const k = Math.min(1, e.stT / 0.18); e.mesh.position.y = groundAt(e.pos.x, e.pos.z, 1, 0) + (1 - k) * 3;
    if (k >= 1 && !e.did) { e.did = 1; sfx('slam'); shake(1.2); shockwave(e.pos.x, e.pos.z, { dmg: 22 }); setTimeout(() => !e.dead && shockwave(e.pos.x, e.pos.z, { dmg: 22, speed: 10 }), 350); }
    if (e.stT > 0.8) { go(e, 'walk'); e.slamCd = 9; r.arms.forEach(a => a.rotation.x = 0); }
  }
  r.saws.forEach(s => s.rotation.y += dt * spin);
}

// ---------------- ② 流沙巨口 ----------------
function mawAI(e, dt, time) {
  const r = e.rig; e.st = e.st || 'under'; e.stT = (e.stT || 0) + dt;
  phases(e, [0.5]);
  const { dx, dz, d } = toP(e);
  if (e.st === 'under') {
    e.invuln = true; r.body.position.y = -6.6; r.mound.visible = true; r.mound.scale.y = 1 + Math.sin(time * 10) * 0.2;
    const sp = e.phase ? 10 : 8; e.pos.x += dx / d * sp * dt; e.pos.z += dz / d * sp * dt; resolve(e.pos, 1.2, 1);
    if (Math.random() < dt * 20) smoke(e.pos.clone().setY(0.3), 1, 1.2, 0xe6d3a8, 0.6);
    if (e.stT > 2.6 || (d < 2 && e.stT > 1)) { go(e, 'warn'); warnCircle(e.pos.x, e.pos.z, 3.4, 0.9); sfx('rumble'); }
  } else if (e.st === 'warn') {
    shake(0.25); r.mound.scale.y = 1.3 + Math.sin(time * 30) * 0.3;
    if (e.stT > 0.9) { go(e, 'rise'); r.mound.visible = false; sfx('erupt'); smoke(e.pos.clone().setY(0.5), 14, 3.5, 0xe6d3a8, 3); shake(1.2); }
  } else if (e.st === 'rise') {
    e.invuln = false; r.body.position.y = -6.6 + Math.min(1, e.stT / 0.4) * 6.6;
    if (e.stT > 0.15 && !e.did) { e.did = 1; if (d < 3.6) { hurtPlayer(30, e.pos, true); P.vel.y = 11; P.vel.x += dx / d * 8; P.vel.z += dz / d * 8; } }
    if (e.stT > 0.4) { go(e, 'up'); e.spit = 0.6; }
  } else if (e.st === 'up') {
    turn(e, dt, 1.5); r.head.rotation.x = -0.75 + Math.sin(time * 2) * 0.12;
    r.segs.forEach((s, i) => s.rotation.z = Math.sin(time * 2 + i * 0.6) * 0.04);
    e.spit -= dt;
    if (e.spit <= 0) {
      e.spit = 1.4; const from = world(e, new THREE.Vector3(0, 6.2, -1.6)); sfx('spit');
      for (let i = -1; i <= 1; i++) { const off = new THREE.Vector3(-dz / d, 0, dx / d).multiplyScalar(i * 3); fire('jar', from, eyeTarget().add(off).setY(P.pos.y + 0.3), { time: 1.0, dmg: 10 }); }
      if (e.phase) for (let i = -2; i <= 2; i++) fire('orb', from, eyeTarget().add(new THREE.Vector3(-dz / d, 0, dx / d).multiplyScalar(i * 1.6)), { speed: 15, dmg: 8, color: 0xffb000 });
    }
    if (e.stT > (e.phase ? 4 : 5)) { go(e, 'sink'); }
  } else if (e.st === 'sink') {
    r.body.position.y = -Math.min(1, e.stT / 0.5) * 6.6; e.invuln = e.stT > 0.25;
    if (e.stT > 0.5) { go(e, 'under'); smoke(e.pos.clone().setY(0.4), 8, 2.5, 0xe6d3a8, 1.5); if (e.phase) adds('worm', 2); }
  }
  e.pos.y = 0;
}

// ---------------- ③ 铁砧 ----------------
function anvilAI(e, dt, time) {
  const r = e.rig; e.stT = (e.stT || 0) + dt;
  e.volCd = (e.volCd ?? 2.5) - dt; e.addCd = (e.addCd ?? 10) - dt; e.swCd = (e.swCd ?? 4) - dt;
  phases(e, [0.5]);
  const { d } = toP(e);
  turn(e, dt, 0.7);
  const sp = d > 9 ? 2.3 : d < 5 ? 1.2 : 0;
  move(e, dt, sp); r.tracks.forEach(t => t.userData.lugs.position.z = (time * sp * 0.25) % 0.24);
  r.body.position.y = Math.abs(Math.sin(time * 8)) * 0.03 * (sp ? 1 : 0);
  r.barrel.rotation.x += (-0.9 - r.barrel.rotation.x) * Math.min(1, dt * 4);
  if (d < 3.6 + e.t.r && (e.ram = (e.ram || 0) - dt) <= 0) { e.ram = 1; hurtPlayer(30, e.pos, true); const f = fwd(e); P.vel.set(f.x * 15, 7, f.z * 15); shake(0.8); }
  if (e.volCd <= 0) {
    e.volCd = e.phase ? 3.0 : 4.0; sfx('mortar'); shake(0.4); r.barrel.rotation.x = -0.6;
    const from = world(e, r.muzzle || new THREE.Vector3(0, 4.6, -1.6)); flashStar(from, 1.6); smoke(from, 4, 1, 0x8a8278, 2);
    const n = e.phase ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = i === 0 ? 0 : 1.5 + Math.random() * 4.5;
      fire('shell', from, new THREE.Vector3(P.pos.x + P.vel.x * 0.6 + Math.cos(a) * rr, 0, P.pos.z + P.vel.z * 0.6 + Math.sin(a) * rr), { time: 1.3 + i * 0.12, radius: 3, dmg: 22 });
    }
  }
  if (e.phase && e.swCd <= 0) { e.swCd = 10; sweep(e, { y: 0.7, speed: 1.2, dur: 4.5, from: e.yaw + Math.PI - 1.2, dmg: 18 }); sfx('laser'); }
  if (e.addCd <= 0) { e.addCd = 13; adds('grunt', 2); }
}

// ---------------- ④ 蜂巢 ----------------
function hiveAI(e, dt, time) {
  const r = e.rig; e.stT = (e.stT || 0) + dt;
  e.orbCd = (e.orbCd ?? 2) - dt; e.hatchCd = (e.hatchCd ?? 6) - dt; e.misCd = (e.misCd ?? 4) - dt;
  phases(e, [0.5]);
  e.orbit = (e.orbit || 0) + dt * 0.35;
  const tx = P.pos.x + Math.cos(e.orbit) * 14, tz = P.pos.z + Math.sin(e.orbit) * 14;
  const mx = clamp(tx, -38, 38) - e.pos.x, mz = clamp(tz, -38, 38) - e.pos.z, md = Math.hypot(mx, mz) || 1;
  e.pos.x += mx / md * Math.min(6, md) * dt; e.pos.z += mz / md * Math.min(6, md) * dt;
  e.pos.y += (8.5 + Math.sin(time * 0.9) * 1.2 - e.pos.y) * Math.min(1, dt * 2);
  turn(e, dt, 2); r.body.rotation.z = Math.sin(time * 1.3) * 0.08;
  r.rotors.forEach(o => o.rotation.y += dt * 30);
  if (e.orbCd <= 0) {
    e.orbCd = e.phase ? 1.8 : 2.6; sfx('orb');
    for (const s of [-1, 1]) {
      const from = world(e, new THREE.Vector3(s * 1.6, 0.8, -1.9));
      for (let i = -2; i <= 2; i++) { const tg = new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z).add(new THREE.Vector3(i * 1.4, 0, i * 1.4 * s * 0.3)); fire('orb', from, tg, { speed: 17, dmg: 8, color: 0xff3b2f }); }
    }
  }
  if (e.hatchCd <= 0) { e.hatchCd = 9; e.hatchT = 3; sfx('hatch'); }
  if (e.hatchT > 0) {
    e.hatchT -= dt; e.exposed = true; r.hatch.position.y = -0.75 - Math.min(1, (3 - e.hatchT) * 3) * 0.5;
    if (e.hatchT < 2.6 && !e.dropped) { e.dropped = 1; for (let i = 0; i < (e.phase ? 4 : 3); i++) { const dd = spawn('drone', e.pos.x + (i - 1) * 1.2, e.pos.z, 1); dd.pos.y = e.pos.y - 1; } }
    if (e.hatchT <= 0) { e.exposed = false; e.dropped = 0; r.hatch.position.y = -0.75; }
  }
  if (e.phase && e.misCd <= 0) { e.misCd = 6; sfx('missile'); for (const s of [-1, 1]) fire('missile', world(e, new THREE.Vector3(s * 2, 1.5, 0)), new THREE.Vector3(P.pos.x, P.pos.y + 6, P.pos.z), { dmg: 16 }); }
}

// ---------------- ⑤ 起重巨人 ----------------
function titanAI(e, dt, time) {
  const r = e.rig; e.st = e.st || 'walk'; e.stT = (e.stT || 0) + dt;
  e.atkCd = (e.atkCd ?? 3) - dt;
  phases(e, [0.5]);
  const { d } = toP(e);
  const tip = world(e, r.jibTip);
  let ball = new THREE.Vector3(tip.x + Math.sin(time * 1.6) * 0.8, tip.y - 4.2, tip.z + Math.cos(time * 1.3) * 0.6);
  if (e.st === 'walk') {
    const df = turn(e, dt, 1.0); move(e, dt, Math.abs(df) < 0.8 && d > 6 ? 2.6 : 0);
    e.walk += dt * 3; walkLegs(r, e.walk, 1, 0.35); r.body.position.y = Math.abs(Math.sin(e.walk)) * 0.15;
    if (e.atkCd <= 0) { e.combo = ((e.combo || 0) + 1) % 3; go(e, ['swing', 'laser', 'stomp'][e.combo]); if (e.st === 'swing') sfx('chain'); }
  } else if (e.st === 'swing') {
    turn(e, dt, 0.3); const a = e.yaw + Math.PI + e.stT * (e.phase ? 2.8 : 2.2), rr = 7.5;
    ball = new THREE.Vector3(e.pos.x + Math.sin(a) * rr, 1.3, e.pos.z + Math.cos(a) * rr);
    r.jib.rotation.y = -(a - e.yaw) - Math.PI / 2;
    if (ball.distanceTo(new THREE.Vector3(P.pos.x, P.pos.y + 0.9, P.pos.z)) < 1.8 && (e.hitCd = (e.hitCd || 0) - dt) <= 0) { e.hitCd = 0.8; hurtPlayer(30, ball, true); const v = new THREE.Vector3(P.pos.x - ball.x, 0, P.pos.z - ball.z).normalize(); P.vel.set(v.x * 16, 8, v.z * 16); shake(0.9); sfx('slam'); }
    if (Math.random() < 0.3) smoke(ball.clone().setY(0.3), 1, 0.8, 0xe6d3a8, 0.4);
    if (e.stT > 4) { go(e, 'walk'); e.atkCd = 2.5; r.jib.rotation.y = 0; }
  } else if (e.st === 'laser') {
    turn(e, dt, 0.2);
    if (!e.did) { e.did = 1; sfx('laser'); sweep(e, { y: 0.7, speed: e.phase ? 1.5 : 1.1, dur: 4, from: e.yaw + Math.PI - 1.4, dmg: 20 }); if (e.phase) { sweep(e, { y: 0.7, speed: e.phase ? 1.5 : 1.1, dur: 4, from: e.yaw - 1.4, dmg: 20 }); adds('spotter', 2); } }
    r.head.rotation.x = Math.sin(time * 3) * 0.1;
    if (e.stT > 4.8) { go(e, 'walk'); e.atkCd = 2.5; }
  } else if (e.st === 'stomp') {
    const k = e.stT < 0.7 ? e.stT / 0.7 : 1;
    r.legs[0].rotation.x = e.stT < 0.7 ? -1.0 * k : 0;
    if (e.stT > 0.7 && !e.did) { e.did = 1; sfx('slam'); shake(1.3); shockwave(e.pos.x, e.pos.z, { dmg: 24, speed: 12, max: 26 }); if (e.phase) setTimeout(() => !e.dead && shockwave(e.pos.x, e.pos.z, { dmg: 24, speed: 9, max: 26 }), 450); }
    if (e.stT > 1.4) { go(e, 'walk'); e.atkCd = 2.5; }
  }
  // 球和链子
  const inv = new THREE.Matrix4().copy(e.mesh.matrixWorld).invert();
  const lb = ball.clone().applyMatrix4(inv), lt = r.jibTip.clone();
  if (e.st === 'swing') lt.copy(world(e, new THREE.Vector3(1.1, 5.0, 0)).applyMatrix4(inv));
  r.ball.position.copy(lb); r.ball.rotation.y += dt * 2;
  r.chain.position.copy(lt).lerp(lb, 0.5); r.chain.scale.set(0.08, 0.08, lt.distanceTo(lb)); r.chain.lookAt(world(e, lb));
}

// ---------------- ⑥ 未完工的机器 ----------------
function unfinishedAI(e, dt, time) {
  const r = e.rig; e.stT = (e.stT || 0) + dt;
  ['misCd', 'swCd', 'addCd', 'rainCd', 'waveCd', 'droneCd'].forEach((k, i) => e[k] = (e[k] ?? [2, 6, 9, 4, 7, 5][i]) - dt);
  if (phases(e, [0.6, 0.25])) {
    if (e.phase === 1) { // 装甲板脱落，核心暴露
      e.armorAll = 0; e.t = Object.assign({}, e.t, { head: [0.3, 0.5] });
      r.plates.forEach(p => { const w = world(e, p.position); flashStar(w, 1.5); smoke(w, 3, 1, 0xd8d0c0, 1); p.visible = false; });
      shake(1.5); sfx('slam');
    }
    if (e.phase === 2) { shake(1.5); sfx('roar'); }
  }
  e.armorAll = e.phase ? 0 : 0.35;
  const { d } = toP(e);
  turn(e, dt, 0.8); move(e, dt, d > 18 ? 1.4 : d < 10 ? -1 : 0);
  r.head.rotation.z = Math.sin(time * 0.7) * 0.05;
  r.arms[0].rotation.x = Math.sin(time * 1.2) * 0.2; r.arms[1].rotation.z = Math.sin(time * 0.9) * 0.15;
  r.core.scale.setScalar(1 + Math.sin(time * (e.phase === 2 ? 14 : 5)) * 0.08);
  if (e.misCd <= 0) { e.misCd = e.phase ? 4 : 5; sfx('missile'); for (let i = 0; i < 4; i++) fire('missile', world(e, new THREE.Vector3((i - 1.5) * 0.9, 6.5, 0.5)), new THREE.Vector3(P.pos.x, 12, P.pos.z), { dmg: 15 }); }
  if (e.swCd <= 0) {
    e.swCd = e.phase === 2 ? 7 : 9; sfx('laser');
    sweep(e, { y: 0.7, speed: 1.2, dur: 4, from: e.yaw + Math.PI - 1.2, dmg: 20 });
    if (e.phase === 2) sweep(e, { y: 0.7, speed: 1.2, dur: 4, from: e.yaw - 1.2, dmg: 20 });
  }
  if (e.addCd <= 0) { e.addCd = 12; adds(Math.random() < 0.5 ? 'spotter' : 'grunt', 2); }
  if (e.phase >= 1 && e.rainCd <= 0) {
    e.rainCd = 6; sfx('mortar'); const from = world(e, new THREE.Vector3(2.1, 6, 0));
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, rr = Math.random() * 7; fire('shell', from, new THREE.Vector3(P.pos.x + Math.cos(a) * rr, 0, P.pos.z + Math.sin(a) * rr), { time: 1.4 + i * 0.1, radius: 2.8, dmg: 20 }); }
  }
  if (e.phase >= 1 && e.waveCd <= 0) { e.waveCd = 8; sfx('slam'); shake(1); shockwave(e.pos.x, e.pos.z, { dmg: 22, max: 30 }); }
  if (e.phase === 2 && e.droneCd <= 0) { e.droneCd = 10; for (let i = 0; i < 3; i++) { const dd = spawn('drone', e.pos.x + (i - 1) * 2, e.pos.z, 1); dd.pos.y = 7; } }
  if (e.phase === 2 && Math.random() < 0.1) burst(world(e, new THREE.Vector3((Math.random() - .5) * 3, 3 + Math.random() * 3, -1.3)), 0x5dffd1, 3, 4);
}

const B = (no, name, en, sub, hp, r, h, build, ai, extra = {}) => ({ boss: true, no, name, en, sub, hp, r, h, build, ai, heavy: true, score: 3000, color: 0xd8432a, threat: 5, ...extra });
export const BOSS_TYPES = {
  butcher: B(11, '屠宰机', 'THE BUTCHER', '近战狂暴，会冲锋撞人', 1400, 1.5, 3.8, M.butcher, butcherAI, { head: [0.8, 1], atk: '圆锯横扫 · 直线冲锋 · 跳砸', weak: '冲锋撞墙后会晕，伤害翻倍' }),
  maw: B(12, '流沙巨口', 'SAND MAW', '从地底破土而出', 1600, 1.8, 7.2, M.maw, mawAI, { head: [0.72, 1], atk: '破土咬人 · 喷沙罐', weak: '冒头时打嘴' }),
  anvil: B(13, '铁砧', 'THE ANVIL', '重型迫击炮坦克', 2000, 2.3, 4.4, M.anvil, anvilAI, { frontArmor: true, atk: '迫击炮齐射 · 碾压 · 扫射激光', weak: '背后反应堆', armor: '正面装甲 · 减伤 88%' }),
  hive: B(14, '蜂巢', 'THE HIVE', '会下自爆蜂的空中母舰', 1800, 2.6, 2.6, M.hive, hiveAI, { fly: true, flyY: 8.5, atk: '光弹齐射 · 投放自爆蜂 · 导弹', weak: '肚子舱门打开时' }),
  titan: B(15, '起重巨人', 'CRANE TITAN', '吊臂挂着破拆球', 2600, 1.8, 7.4, M.titan, titanAI, { head: [0.8, 1], atk: '破拆球横扫 · 激光扫地 · 跺脚冲击波', weak: '驾驶舱独眼' }),
  unfinished: B(16, '未完工的机器', 'THE UNFINISHED', '还没造完，就已经很要命了', 4200, 2.6, 7.5, M.unfinished, unfinishedAI, { atk: '追踪导弹 · 双激光 · 炮击雨 · 冲击波', weak: '装甲脱落后的胸口核心', armor: '一阶段全身装甲 · 减伤 65%' }),
};
export const BOSS_ORDER = ['butcher', 'maw', 'anvil', 'hive', 'titan', 'unfinished'];
