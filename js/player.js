import * as THREE from 'three';
import { resolve, groundAt, ARENA } from './world.js';
import { settings } from './save.js';

export const P = {
  pos: new THREE.Vector3(0, 0, 8), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, hp: 100, maxHp: 100, armor: 50, maxArmor: 50, lookDX: 0, lookDY: 0, onGround: true, r: 0.4, h: 1.7, eye: 1.6,
  speed: 9, jump: 8.5, dmgMul: 1, hurtT: 0, hook: null, kick: 0, dashT: 0, dashDir: null,
};
// 玩家受伤（敌人、弹体、地面危险都走这里）
export const playerHooks = { onHurt: null };
export function hurtPlayer(n, from, force = false) {
  if (P.hurtT > 0 && n < 20 && !force) return;
  if (P.armor > 0) { const a = Math.min(P.armor, n * 0.7); P.armor -= a; n -= a; }
  P.hp -= n; P.hurtT = 0.35; playerHooks.onHurt && playerHooks.onHurt(n, from);
}
export const keys = {};
export const mouse = { down: false };

export function initInput(canvas, onLock) {
  addEventListener('keydown', e => { keys[e.code] = true; if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas) return;
    const k = 0.0022 * settings.sens;
    P.yaw -= e.movementX * k; P.pitch -= e.movementY * k;
    P.lookDX += e.movementX * k; P.lookDY += e.movementY * k;
    P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch));
  });
  document.addEventListener('pointerlockchange', () => onLock(document.pointerLockElement === canvas));
}

export function resetPlayer() {
  P.speed = 9; P.jump = 8.5; P.maxHp = 100; P.maxArmor = 50; P.dashT = 0; P.slowT = 0; P.wind = null;
  P.pos.set(0, 0, 8); P.vel.set(0, 0, 0); P.hp = P.maxHp; P.armor = P.maxArmor; P.yaw = 0; P.pitch = 0; P.hook = null; P.onGround = true;
}

export function eyePos(out = new THREE.Vector3()) { return out.set(P.pos.x, P.pos.y + P.eye, P.pos.z); }
export function lookDir(out = new THREE.Vector3()) {
  const cp = Math.cos(P.pitch);
  return out.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
}

export function updatePlayer(dt) {
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
  const l = Math.hypot(wx, wz); if (l > 0) { wx /= l; wz /= l; }
  const acc = P.onGround ? 14 : 5;
  const k = 1 - Math.exp(-acc * dt);
  const spd = P.speed * (P.slowT > 0 ? 0.6 : 1);
  if (P.slowT > 0) P.slowT -= dt;
  P.vel.x += (wx * spd - P.vel.x) * k;
  P.vel.z += (wz * spd - P.vel.z) * k;
  // 沙尘暴的风：站得越高吹得越狠
  if (P.wind) { const wk = P.pos.y > 2 ? 2.6 : 0.6; P.vel.x += P.wind.x * wk * dt * 10; P.vel.z += P.wind.z * wk * dt * 10; }
  if (keys.Space && P.onGround) { P.vel.y = P.jump; P.onGround = false; }
  // 冲刺
  if (P.dashT > 0) { P.dashT -= dt; P.vel.x = P.dashDir.x * 26; P.vel.z = P.dashDir.z * 26; if (P.vel.y < 0) P.vel.y *= 0.5; }
  // 勾锁牵引：按住就一直拉，到点或松手结束，结束时给一点上抛好翻上台子
  if (P.hook && P.hook.reel) {
    const to = P.hook.point.clone().sub(eyePos()); const d = to.length();
    if (d < 1.8 || P.hook.t > 1.6 || !P.hook.held) { P.hook = null; P.vel.multiplyScalar(0.55); P.vel.y = Math.max(P.vel.y, 6); }
    else { const sp = Math.min(34, 12 + P.hook.t * 60); to.normalize().multiplyScalar(sp); P.vel.lerp(to, 1 - Math.exp(-12 * dt)); P.hook.t += dt; P.onGround = false; }
  }
  if (!(P.hook && P.hook.reel)) P.vel.y -= 26 * dt;
  P.pos.addScaledVector(P.vel, dt);
  resolve(P.pos, P.r, P.h);
  const g = groundAt(P.pos.x, P.pos.z, P.r * 0.8, P.pos.y);
  if (P.pos.y <= g && P.vel.y <= 0) { P.pos.y = g; P.vel.y = 0; P.onGround = true; }
  else if (P.pos.y > g + 0.05) P.onGround = false;
  const L = ARENA + 1; P.pos.x = Math.max(-L, Math.min(L, P.pos.x)); P.pos.z = Math.max(-L, Math.min(L, P.pos.z));
  if (P.hurtT > 0) P.hurtT -= dt;
  P.kick *= Math.exp(-14 * dt);
}
