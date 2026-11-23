import * as THREE from 'three';
import { P, keys, eyePos, lookDir } from './player.js';
import { rayWorld } from './world.js';
import { rayEnemies } from './enemies.js';
import { skills } from './stats.js';
import { NO_INK } from './post.js';
import { box, PAL } from './art.js';
import { burst } from './fx.js';

// 主动技能：勾锁（长按 E）、冲刺（Shift）
export const SK = { hookCd: 0, hookMax: 2.5, dashCd: 0, dashMax: 2.2, on: {} };
const RANGE = 42, TRAVEL = 0.13;
let scene, rope, claw, shot = null, prevE = false, prevShift = false;

export function initSkills(s) {
  scene = s;
  rope = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2b2420 }));
  rope.layers.set(NO_INK); rope.visible = false; scene.add(rope);
  claw = new THREE.Group();
  claw.add(box(0.16, 0.16, 0.22, PAL.dark, 0, 'metal'));
  for (const a of [0, 2.1, 4.2]) { const f = box(0.04, 0.04, 0.26, PAL.yellow, 0, 'metal'); f.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.16); f.rotation.set(Math.sin(a) * 0.5, -Math.cos(a) * 0.5, 0); claw.add(f); }
  claw.visible = false; scene.add(claw);
}
export function resetSkills() { SK.hookCd = 0; SK.dashCd = 0; shot = null; P.hook = null; if (rope) rope.visible = claw.visible = false; }

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _hand = new THREE.Vector3(), _end = new THREE.Vector3();
function handPos() {
  eyePos(_o); lookDir(_d);
  const right = new THREE.Vector3(-Math.cos(P.yaw), 0, Math.sin(P.yaw)).negate();
  return _hand.copy(_o).addScaledVector(right, -0.3).addScaledVector(_d, 0.5).add(new THREE.Vector3(0, -0.3, 0));
}
function fireHook() {
  eyePos(_o); lookDir(_d);
  const tw = rayWorld(_o, _d, RANGE), he = rayEnemies(_o, _d, Math.min(tw, RANGE));
  SK.hookCd = SK.hookMax;
  if (he && !he.e.t.heavy) { shot = { enemy: he.e, point: _o.clone().addScaledVector(_d, he.t), t: 0 }; }
  else if (he) { shot = { point: _o.clone().addScaledVector(_d, Math.max(0, he.t - 1.5)), t: 0 }; }
  else if (tw < RANGE) { shot = { point: _o.clone().addScaledVector(_d, tw - 0.25), t: 0 }; }
  else { shot = { point: _o.clone().addScaledVector(_d, RANGE), t: 0, miss: true }; SK.hookCd = 0.6; }
  SK.on.fire && SK.on.fire();
}

export function updateSkills(dt) {
  SK.hookCd = Math.max(0, SK.hookCd - dt); SK.dashCd = Math.max(0, SK.dashCd - dt);
  const held = !!(keys.KeyE || window.__hookHold);
  if (skills.hook && held && !prevE && !shot && !P.hook && SK.hookCd <= 0) fireHook();
  prevE = held;
  if (P.hook) P.hook.held = held;
  // 冲刺：朝按键方向，没按方向就朝前
  const sh = !!(keys.ShiftLeft || keys.ShiftRight);
  if (skills.dash && sh && !prevShift && SK.dashCd <= 0) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let x = -sy * (f || (s ? 0 : 1)) + cy * s, z = -cy * (f || (s ? 0 : 1)) - sy * s; const l = Math.hypot(x, z) || 1;
    P.dashDir = new THREE.Vector3(x / l, 0, z / l); P.dashT = 0.2; SK.dashCd = SK.dashMax;
    SK.on.dash && SK.on.dash();
  }
  prevShift = sh;
  // 绳子与钩爪
  let end = null;
  if (shot) {
    shot.t += dt;
    const k = Math.min(1, shot.t / TRAVEL);
    if (shot.miss) {
      const back = shot.t > TRAVEL ? 1 - Math.min(1, (shot.t - TRAVEL) / TRAVEL) : k;
      end = _end.copy(handPos()).lerp(shot.point, back); if (shot.t > TRAVEL * 2) shot = null;
    } else if (shot.enemy) {
      if (k < 1) end = _end.copy(handPos()).lerp(shot.point, k);
      else {
        if (!shot.hit) { shot.hit = true; shot.enemy.pulled = 0.55; burst(shot.point, 0xfff1a0, 6, 4); SK.on.grab && SK.on.grab(shot.enemy); }
        const e = shot.enemy; end = _end.set(e.pos.x, e.pos.y + e.t.h * 0.6, e.pos.z);
        if (e.dead || !(e.pulled > 0)) shot = null;
      }
    } else {
      if (k < 1) end = _end.copy(handPos()).lerp(shot.point, k);
      else {
        if (!shot.hit) { shot.hit = true; P.hook = { point: shot.point.clone(), t: 0, reel: true, held }; burst(shot.point, 0xfff1a0, 5, 3); SK.on.latch && SK.on.latch(); }
        end = _end.copy(shot.point); if (!P.hook) shot = null;
      }
    }
  }
  if (end) {
    const a = handPos(), len = a.distanceTo(end);
    rope.visible = claw.visible = true;
    rope.position.copy(a).lerp(end, 0.5); rope.scale.set(0.03, 0.03, len); rope.lookAt(end);
    claw.position.copy(end); claw.lookAt(a); claw.rotateY(Math.PI);
  } else rope.visible = claw.visible = false;
}
export const hookShotActive = () => !!shot;
