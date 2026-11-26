import * as THREE from 'three';
import { rayWorld } from './world.js';
import { rayEnemies, damageEnemy } from './enemies.js';
import { boom, onShot } from './elements.js';
import { smoke, burst } from './fx.js';
import { cyl, box } from './art.js';
import { P } from './player.js';

// 火箭筒的弹体：直线飞行，撞墙/撞敌人/落地就炸。炸点离玩家近会把人掀起来（火箭跳）
let scene;
export const rHooks = { hit: null }; // hit(kind) 直接命中时给命中标记用
const list = [], bombs = [];
export function initRockets(s) { scene = s; }
export function clearRockets() { list.forEach(r => scene.remove(r.m)); list.length = 0; bombs.length = 0; }

function rocketMesh() {
  const g = new THREE.Group();
  const body = cyl(0.075, 0.075, 0.5, 0x6b7a3e, 1, 8, 'metal'); body.rotation.x = Math.PI / 2; g.add(body);
  const nose = cyl(0.0, 0.075, 0.18, 0xd8432a, 1, 8, 'plain'); nose.rotation.x = -Math.PI / 2; nose.position.z = -0.34; g.add(nose);
  for (let i = 0; i < 4; i++) { const f = box(0.02, 0.16, 0.14, 0x2a2e33, 1, 'plain'); f.position.z = 0.22; f.rotation.z = i * Math.PI / 2; f.position.y = 0; f.translateY(0.08); g.add(f); }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc21f })); glow.position.z = 0.3; g.add(glow);
  return g;
}

// o 起点，d 方向（单位向量），opt = {dmg, r, speed, bomblets}
export function fireRocket(o, d, opt) {
  const m = rocketMesh(); m.position.copy(o); m.lookAt(o.clone().sub(d)); scene.add(m);
  list.push({ m, p: o.clone(), d: d.clone(), sp: opt.speed || 40, life: 3, trail: 0.12, ...opt });
}

const _h = new THREE.Vector3();
function explode(r, p, direct) {
  const c = p.clone();
  if (direct) {
    const res = damageEnemy(direct.e, r.dmg * 0.5, direct.head, r.d);
    rHooks.hit && rHooks.hit(res === 'armor' ? 3 : direct.head ? 2 : 1);
  }
  boom(c, r.r, r.dmg, null);
  onShot({ rate: 1, dmg: r.dmg * 0.3, pellets: 1 }, direct ? [{ e: direct.e, p: c, head: direct.head }] : [], direct ? null : c);
  // 火箭跳：炸点在脚边就把自己掀起来，不掉血
  const dx = P.pos.x - c.x, dz = P.pos.z - c.z, dy = P.pos.y + 0.8 - c.y, dist = Math.hypot(dx, dy, dz);
  if (dist < r.r + 0.6) {
    const k = 1 - dist / (r.r + 0.6);
    P.vel.y = Math.max(P.vel.y, 5 + 9 * k); P.onGround = false;
    P.vel.x += dx / (dist || 1) * 10 * k; P.vel.z += dz / (dist || 1) * 10 * k;
  }
  if (r.bomblets) for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2, rr = 1.6 + Math.random() * 1.4;
    bombs.push({ p: new THREE.Vector3(c.x + Math.cos(a) * rr, Math.max(0.3, c.y - 0.5), c.z + Math.sin(a) * rr), t: 0.25 + i * 0.14, dmg: r.dmg * 0.3 });
  }
}

export function updateRockets(dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i], step = r.sp * dt;
    r.life -= dt;
    const tw = rayWorld(r.p, r.d, step), hit = rayEnemies(r.p, r.d, Math.min(tw, step));
    if (hit || tw < step || r.life <= 0) {
      const t = hit ? hit.t : Math.min(tw, step);
      _h.copy(r.p).addScaledVector(r.d, t).addScaledVector(r.d, -0.25);
      scene.remove(r.m); list.splice(i, 1);
      explode(r, _h, hit);
      continue;
    }
    r.p.addScaledVector(r.d, step); r.m.position.copy(r.p);
    if ((r.trail -= dt) <= 0) { r.trail = 0.035; smoke(r.p.clone().addScaledVector(r.d, -0.4), 1, 0.25, 0xe9e2d2, 0.3); }
  }
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]; if ((b.t -= dt) > 0) continue;
    bombs.splice(i, 1); burst(b.p, 0xffa01f, 6, 6, 0.08); boom(b.p, 1.8, b.dmg, null);
  }
}
