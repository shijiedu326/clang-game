import * as THREE from 'three';
import { P, eyePos, hurtPlayer } from './player.js';
import { rayWorld, groundAt, findSpot } from './world.js';
import { smoke, burst, flashStar, popText } from './fx.js';
import { cmat, K } from './robots.js';
import { NO_INK } from './post.js';

// 弹体、地面冲击波、炮击落点、激光扫射、补给空投
let scene;
const shots = [], rings = [], marks = [], beams = [], crates = [], scraps = [];
export const hz = { on: {} }; // on.blind / on.pickup / on.boom
export function initHazards(s) { scene = s; }
export function clearHazards() {
  for (const a of [shots, rings, marks, beams, crates, scraps]) { a.forEach(o => scene.remove(o.m)); a.length = 0; }
}
// ---------- 零件掉落：螺丝/齿轮/螺母弹几下后飞向玩家 ----------
const gearG = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 8), boltG = new THREE.CylinderGeometry(0.05, 0.05, 0.26, 6), nutG = new THREE.CylinderGeometry(0.09, 0.09, 0.07, 6);
export function scrap(pos, n) {
  for (let i = 0; i < n && scraps.length < 160; i++) {
    const k = i % 3, m = new THREE.Mesh([gearG, boltG, nutG][k], cmat([0xf5c518, 0xb8c4cc, 0xd99a1c][k], 'metal'));
    m.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * 0.6, 0.3 + Math.random() * 0.5, (Math.random() - .5) * 0.6)); scene.add(m);
    const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 4;
    scraps.push({ m, v: new THREE.Vector3(Math.cos(a) * s, 5 + Math.random() * 5, Math.sin(a) * s), w: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), t: 0 });
  }
}

// ---------- 弹体 ----------
const sphG = new THREE.SphereGeometry(1, 12, 9);
const glowM = c => new THREE.MeshBasicMaterial({ color: c });
function jarMesh() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(sphG, cmat(0xd9b77a, 'plain')); b.scale.set(0.22, 0.26, 0.22); g.add(b);
  const n = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8), cmat(0x8a5a2a, 'plain')); n.position.y = 0.26; g.add(n);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.06, 12), cmat(0xd8432a, 'plain')); g.add(band);
  return g;
}
function orbMesh(c) { const g = new THREE.Group(); const a = new THREE.Mesh(sphG, glowM(c)); a.scale.setScalar(0.22); g.add(a); const b = new THREE.Mesh(sphG, glowM(0xffffff)); b.scale.setScalar(0.11); g.add(b); g.traverse(o => o.layers.set(NO_INK)); return g; }
function shellMesh() { const g = new THREE.Group(); const a = new THREE.Mesh(sphG, cmat(0x2b2626, 'metal')); a.scale.set(0.3, 0.3, 0.3); g.add(a); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6), glowM(0xff8a1f)); f.position.y = 0.3; g.add(f); return g; }
function missileMesh() {
  const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), cmat(0xf2e2bf, 'metal')); a.rotation.x = Math.PI / 2; g.add(a);
  const n = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), cmat(0xd8432a)); n.rotation.x = -Math.PI / 2; n.position.z = -0.4; g.add(n);
  const f = new THREE.Mesh(sphG, glowM(0xffb000)); f.scale.set(0.09, 0.09, 0.2); f.position.z = 0.36; f.layers.set(NO_INK); g.add(f);
  return g;
}
/* kind: jar(抛物线沙罐，迷眼减速) / orb(直线光弹) / shell(炮弹，落点范围伤害) / missile(慢速追踪) */
export function fire(kind, from, target, o = {}) {
  let m, v, grav = 0, r = 0.3, dmg = o.dmg || 14, life = 6;
  if (kind === 'jar' || kind === 'shell') {
    const T = o.time || 1.2; grav = 20;
    v = new THREE.Vector3((target.x - from.x) / T, (target.y - from.y) / T + 0.5 * grav * T, (target.z - from.z) / T);
    m = kind === 'jar' ? jarMesh() : shellMesh();
    if (kind === 'shell') { const mk = mark(target.x, target.z, o.radius || 3, T); }
  } else if (kind === 'orb') { v = target.clone().sub(from).normalize().multiplyScalar(o.speed || 16); m = orbMesh(o.color || 0xff3b2f); r = 0.25; }
  else { v = target.clone().sub(from).normalize().multiplyScalar(o.speed || 9); m = missileMesh(); life = 7; }
  m.position.copy(from); scene.add(m);
  shots.push({ kind, m, v, grav, r, dmg, life, radius: o.radius || 3, spin: Math.random() * 6 });
}
function explode(p, radius, dmg, color = 0xff8a1f) {
  flashStar(p.clone().setY(Math.max(p.y, 0.6)), radius * 0.9); smoke(p.clone().setY(Math.max(p.y, 0.3)), 6, radius * 0.7, 0xd8d0c0, 2);
  burst(p, color, 12, 9, 0.12);
  const d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z), dy = Math.abs(P.pos.y + 0.8 - p.y);
  if (d < radius && dy < radius + 1) hurtPlayer(dmg * (1 - d / radius * 0.5), p, true);
  hz.on.boom && hz.on.boom(radius);
}
// ---------- 地面冲击波（跳起来躲） ----------
const ringG = new THREE.TorusGeometry(1, 0.12, 6, 48);
export function shockwave(x, z, o = {}) {
  const m = new THREE.Mesh(ringG, glowM(o.color || 0xffb000)); m.rotation.x = Math.PI / 2; m.position.set(x, 0.15, z); m.layers.set(NO_INK); scene.add(m);
  rings.push({ m, x, z, r: 0.5, speed: o.speed || 13, max: o.max || 22, dmg: o.dmg || 20, hit: false });
  smoke(new THREE.Vector3(x, 0.3, z), 8, 2.5, 0xe6d3a8, 1);
}
// ---------- 炮击落点 ----------
const discG = new THREE.CircleGeometry(1, 32);
function mark(x, z, radius, t) {
  const m = new THREE.Mesh(discG, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.35, depthWrite: false })); m.rotation.x = -Math.PI / 2;
  m.position.set(x, groundAt(x, z, 0.1, 50) + 0.04, z); m.scale.setScalar(radius); m.layers.set(NO_INK); scene.add(m);
  const o = { m, t, t0: t }; marks.push(o); return o;
}
export function warnCircle(x, z, radius, t) { return mark(x, z, radius, t); }
// ---------- 激光扫射：水平光束绕施放者转，贴地高度，跳起来躲 ----------
export function sweep(owner, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glowM(0xff2a1a)); m.layers.set(NO_INK); scene.add(m);
  const core = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glowM(0xffe0d0)); core.layers.set(NO_INK); scene.add(core);
  beams.push({ m, core, owner, ang: o.from ?? 0, speed: o.speed || 1.4, dur: o.dur || 3, t: 0, y: o.y ?? 0.7, len: o.len || 34, dmg: o.dmg || 18, warn: o.warn ?? 0.7, oy: o.oy ?? 1.2 });
}
// ---------- 补给空投 ----------
function crateMesh(kind) {
  const g = new THREE.Group();
  K.RB(g, 1.0, 0.8, 1.0, kind === 'hp' ? 0xd8432a : 0x2f7f9a, 0, 0.4, 0, 0, 0, 0, 0.08, 'rusty');
  K.RB(g, 1.04, 0.14, 1.04, 0xf5c518, 0, 0.4, 0, 0, 0, 0, 0.04, 'hazard');
  const sym = K.decal(g, K.DECAL.tag(kind === 'hp' ? '+HP' : '+AR', '#f2e2bf', '#1b1715'), 0.6, 0.6, 0, 0.62, -0.53, Math.PI);
  K.decal(g, K.DECAL.tag(kind === 'hp' ? '+HP' : '+AR', '#f2e2bf', '#1b1715'), 0.6, 0.6, 0, 0.62, 0.53, 0);
  const chute = new THREE.Group(); chute.position.y = 2.6; g.add(chute); g.userData.chute = chute;
  const can = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cmat(0xf2e2bf)); can.scale.y = 0.6; chute.add(can);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.2, 0.02), glowM(0x333333)); l.position.set(x * 0.6, -1.1, z * 0.6); l.rotation.set(z * 0.25, 0, -x * 0.25); l.layers.set(NO_INK); chute.add(l); }
  return g;
}
export function dropCrate(x, z, kind) {
  if (x === undefined) { const p = findSpot(P.pos.x, P.pos.z, 5, 14, 1) || { x: P.pos.x + 4, z: P.pos.z }; x = p.x; z = p.z; }
  kind = kind || (P.hp / P.maxHp < P.armor / P.maxArmor ? 'hp' : 'ar');
  const m = crateMesh(kind); m.position.set(x, 26, z); scene.add(m);
  crates.push({ m, kind, g: groundAt(x, z, 0.6, 30), vy: -5, landed: false, life: 30 });
  popText('补给空投!', new THREE.Vector3(x, 6, z), 'ko');
}

// ---------- 每帧 ----------
const _t = new THREE.Vector3();
export function updateHazards(dt, time, enemiesRef) {
  updateScrap(dt);
  const eye = eyePos(new THREE.Vector3());
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt;
    if (s.kind === 'missile') { // 追踪：慢慢转向
      _t.copy(eye).sub(s.m.position).normalize().multiplyScalar(9);
      s.v.lerp(_t, 1 - Math.exp(-1.6 * dt)); s.m.lookAt(s.m.position.clone().sub(s.v));
      if (Math.random() < 0.5) smoke(s.m.position.clone(), 1, 0.15, 0xcfc6b4, 0.3);
    }
    s.v.y -= s.grav * dt;
    const step = s.v.clone().multiplyScalar(dt), len = step.length();
    const wt = rayWorld(s.m.position, step.clone().normalize(), len);
    s.m.position.add(step); s.spin += dt * 8;
    if (s.kind === 'jar' || s.kind === 'shell') s.m.rotation.set(s.spin, s.spin * 0.7, 0);
    const pd = s.m.position.distanceTo(eye);
    const hitP = pd < s.r + 0.55 || (Math.hypot(s.m.position.x - P.pos.x, s.m.position.z - P.pos.z) < s.r + 0.45 && s.m.position.y > P.pos.y && s.m.position.y < P.pos.y + 1.8);
    if (hitP || wt < len || s.m.position.y < 0.05 || s.life <= 0) {
      const p = s.m.position;
      if (s.kind === 'jar') {
        smoke(p.clone(), 7, 1.6, 0xe0c890, 0.8); burst(p, 0xd9b77a, 10, 6, 0.1);
        if (p.distanceTo(eye) < 2.6) { hurtPlayer(s.dmg, p); P.slowT = 2.5; hz.on.blind && hz.on.blind(); }
      } else if (s.kind === 'shell') explode(p, s.radius, s.dmg);
      else if (s.kind === 'missile') explode(p, 2.2, s.dmg, 0xffb000);
      else { burst(p, 0xff3b2f, 6, 4, 0.08); if (hitP) hurtPlayer(s.dmg, p); }
      scene.remove(s.m); shots.splice(i, 1);
    }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.r += r.speed * dt; r.m.scale.setScalar(r.r);
    r.m.material.color.setHex(Math.floor(time * 20) % 2 ? 0xffb000 : 0xff3b2f);
    const d = Math.hypot(P.pos.x - r.x, P.pos.z - r.z);
    if (!r.hit && Math.abs(d - r.r) < 0.7 && P.pos.y < 0.6) { r.hit = true; hurtPlayer(r.dmg, new THREE.Vector3(r.x, 0, r.z), true); P.vel.y = 6; }
    if (r.r > r.max) { scene.remove(r.m); rings.splice(i, 1); }
  }
  for (let i = marks.length - 1; i >= 0; i--) {
    const k = marks[i]; k.t -= dt; k.m.material.opacity = 0.25 + 0.3 * (Math.floor(time * (k.t < 0.4 ? 20 : 8)) % 2);
    if (k.t <= 0) { scene.remove(k.m); marks.splice(i, 1); }
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.t += dt;
    if (b.owner.dead || b.t > b.dur + b.warn) { scene.remove(b.m); scene.remove(b.core); beams.splice(i, 1); continue; }
    const live = b.t > b.warn; if (live) b.ang += b.speed * dt;
    const o = b.owner.pos, dir = new THREE.Vector3(Math.sin(b.ang), 0, Math.cos(b.ang));
    const from = new THREE.Vector3(o.x, b.y + (o.y || 0) * 0, o.z).addScaledVector(dir, b.owner.t.r);
    const wl = Math.min(b.len, rayWorld(from, dir, b.len));
    const th = live ? 0.16 : 0.03;
    b.m.scale.set(th, th, wl); b.m.position.copy(from).addScaledVector(dir, wl / 2); b.m.lookAt(from.clone().addScaledVector(dir, wl));
    b.core.visible = live; b.core.scale.set(th * 0.4, th * 0.4, wl); b.core.position.copy(b.m.position); b.core.quaternion.copy(b.m.quaternion);
    b.m.material.color.setHex(live ? 0xff2a1a : (Math.floor(time * 16) % 2 ? 0xff2a1a : 0xffd0c0));
    if (live) {
      // 玩家到光束的水平距离
      const rx = P.pos.x - from.x, rz = P.pos.z - from.z, along = rx * dir.x + rz * dir.z, perp = Math.abs(rx * dir.z - rz * dir.x);
      if (along > 0 && along < wl && perp < 0.6 && P.pos.y < b.y + 0.15) hurtPlayer(b.dmg, from);
      if (Math.random() < 0.3) burst(from.clone().addScaledVector(dir, wl), 0xffb000, 2, 3, 0.06);
    }
  }
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    if (!c.landed) {
      c.m.position.y += c.vy * dt; c.m.rotation.y += dt * 0.6; c.m.userData.chute.rotation.z = Math.sin(time * 2) * 0.08;
      if (c.m.position.y <= c.g) { c.m.position.y = c.g; c.landed = true; c.m.remove(c.m.userData.chute); smoke(c.m.position.clone(), 5, 1.2, 0xe6d3a8, 0.6); }
    } else {
      c.life -= dt; c.m.rotation.y += dt;
      if (Math.hypot(P.pos.x - c.m.position.x, P.pos.z - c.m.position.z) < 1.6 && Math.abs(P.pos.y - c.m.position.y) < 1.5) {
        if (c.kind === 'hp') P.hp = Math.min(P.maxHp, P.hp + 35); else P.armor = Math.min(P.maxArmor, P.armor + 35);
        burst(c.m.position.clone().setY(c.m.position.y + 0.6), 0xf5c518, 14, 6); hz.on.pickup && hz.on.pickup(c.kind);
        scene.remove(c.m); crates.splice(i, 1); continue;
      }
      if (c.life <= 0) { scene.remove(c.m); crates.splice(i, 1); }
    }
  }
}
export const activeBeams = () => beams.length;
function updateScrap(dt) {
  const tgt = new THREE.Vector3(P.pos.x, P.pos.y + 1.0, P.pos.z);
  for (let i = scraps.length - 1; i >= 0; i--) {
    const s = scraps[i]; s.t += dt;
    const d = s.m.position.distanceTo(tgt);
    if (s.t > 0.7 && (d < 9 || s.t > 1.6)) { // 磁吸：越飞越快
      const sp = 8 + (s.t - 0.7) * 30; s.v.copy(tgt).sub(s.m.position).normalize().multiplyScalar(Math.min(40, sp));
    } else { s.v.y -= 22 * dt; }
    s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt;
    if (s.m.position.y < 0.06 && s.v.y < 0) { s.m.position.y = 0.06; s.v.y *= -0.45; s.v.x *= 0.6; s.v.z *= 0.6; }
    if (d < 1.1 && s.t > 0.4) { scene.remove(s.m); scraps.splice(i, 1); hz.on.scrap && hz.on.scrap(); }
  }
}
