import * as THREE from 'three';
import { P, eyePos, hurtPlayer } from './player.js';
import { BOSS_TYPES } from './bosses.js';
import { CRITTER_TYPES } from './critters.js';
import { resolve, groundAt, rayWorld, findSpot } from './world.js';
import { burst, graffiti, popText, tracer, smoke, flashStar, scatter } from './fx.js';
import { BUILD, setFlash, animate } from './robots.js';
import { NO_INK } from './post.js';
import { mods } from './stats.js';
import { PLATFORMS } from './props.js';

// 玩家站在高台上时，近战敌人先去最近的楼梯口，再顺楼梯爬上去
function onPlat(x, z, y) { for (const p of PLATFORMS) if (x > p.x0 - 0.4 && x < p.x1 + 0.4 && z > p.z0 - 0.4 && z < p.z1 + 0.4 && y > p.top - 0.7) return p; return null; }
export function navGoal(e) {
  if (P.pos.y < 1.2) return null;
  const pf = onPlat(P.pos.x, P.pos.z, P.pos.y); if (!pf || e.pos.y > pf.top - 0.7) return null;
  for (const s of pf.stairs) if (e.pos.x > s.x0 - 0.5 && e.pos.x < s.x1 + 0.5 && e.pos.z > s.z0 - 0.3 && e.pos.z < s.z1 + 0.3 && e.pos.y > 0.2) return { x: s.tx, z: s.tz };
  let best = null, bd = 1e9;
  for (const s of pf.stairs) { const d = Math.hypot(e.pos.x - s.bx, e.pos.z - s.bz) + Math.hypot(P.pos.x - s.tx, P.pos.z - s.tz) * 0.5; if (d < bd) { bd = d; best = s; } }
  if (Math.hypot(e.pos.x - best.bx, e.pos.z - best.bz) < 1.4) return { x: best.tx, z: best.tz };
  return { x: best.bx, z: best.bz };
}

export const enemies = [];
let scene;
export const hooks = { onKill: null, onHurt: null, onSpawn: null, onLaser: null, onShot: null };
export function initEnemies(s) { scene = s; }

export const TYPES = {
  grunt:  { name: '拾荒机', en: 'SCRAPPER', no: 1, hp: 30, speed: 4.6, r: 0.55, h: 1.75, head: [0.55, 0.8], color: 0xd8432a, score: 100, atk: '冲上来用大钳子夹', weak: '独眼', threat: 1 },
  spotter:{ name: '远射机', en: 'SPOTTER', no: 4, hp: 22, speed: 3.2, r: 0.45, h: 2.3, head: [0.78, 1], color: 0x2f7f9a, score: 200, atk: '红色激光锁定 → 高速光弹', weak: '头部镜头', threat: 2 },
  hauler: { name: '重装机', en: 'HAULER', no: 5, hp: 150, speed: 2.6, r: 1.1, h: 2.3, color: 0xf0a51c, score: 400, frontArmor: true, heavy: true, atk: '推土铲撞击', weak: '背后散热口', armor: '正面推土铲装甲 · 减伤 88%', threat: 3 },
};

Object.assign(TYPES, CRITTER_TYPES, BOSS_TYPES);

const laserGeo = new THREE.BoxGeometry(1, 1, 1);
export function spawn(type, x, z, hpMul = 1) {
  const t = TYPES[type]; const rig = (t.build || BUILD[type])();
  const y = t.fly ? (t.flyY || 3) : groundAt(x, z, t.r, 0);
  rig.g.position.set(x, y, z); scene.add(rig.g);
  rig.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const e = { type, t, rig, mesh: rig.g, hp: t.hp * hpMul, maxHp: t.hp * hpMul, pos: rig.g.position, vel: new THREE.Vector3(), yaw: Math.atan2(-(P.pos.x - x), -(P.pos.z - z)), cd: 1 + Math.random(), lock: 0, flash: 0, walk: Math.random() * 6, dead: false, spawnT: 0.5 };
  if (type === 'spotter') {
    e.laser = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a })); e.laser.layers.set(NO_INK); e.laser.visible = false; scene.add(e.laser);
  }
  rig.g.scale.setScalar(0.01);
  smoke(new THREE.Vector3(x, y + 0.5, z), 4, 0.9, 0xe6d3a8, 1);
  enemies.push(e); hooks.onSpawn && hooks.onSpawn(e); return e;
}



const _a = new THREE.Vector3(), _b = new THREE.Vector3();
export function updateEnemies(dt, t) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) continue;
    if (e.flash > 0) { e.flash -= dt; if (e.flash <= 0) setFlash(e.rig, false); }
    // 中弹击退
    if (e.kb && e.kb.lengthSq() > 0.01) { e.pos.addScaledVector(e.kb, dt); resolve(e.pos, e.t.r, e.t.h); e.kb.multiplyScalar(Math.exp(-9 * dt)); }
    if (e.spawnT > 0) { e.spawnT -= dt; const k = 1 - Math.max(0, e.spawnT) / 0.5; e.mesh.scale.setScalar((k < 1 ? 0.01 + k * (1.15 - 0.15 * k) : 1) * (e.big || 1)); if (e.spawnT > 0.2) continue; }
    // Boss 和特殊小怪自己管移动与攻击
    if (e.t.ai) { e.t.ai(e, dt, t); continue; }
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dist = Math.hypot(dx, dz) || 1;
    // 兜底：连续 12 秒看不见玩家（卡在某处）就换到玩家附近的空地
    e.losT = (e.losT || 0) + dt; e.losCk = (e.losCk || 0) - dt;
    if (e.losCk <= 0) {
      e.losCk = 0.5; eyePos(_b); _a.set(e.pos.x, e.pos.y + e.t.h * 0.7, e.pos.z);
      const d = _b.clone().sub(_a), len = d.length();
      if (rayWorld(_a, d.normalize(), len) >= len - 0.3) e.losT = 0;
    }
    if (e.losT > 12) {
      const p = findSpot(P.pos.x, P.pos.z, 12, 22, e.t.r + 0.5);
      if (p) { smoke(e.pos.clone(), 3, 0.8); e.pos.set(p.x, groundAt(p.x, p.z, e.t.r, 0), p.z); smoke(e.pos.clone().setY(e.pos.y + 0.5), 4, 0.9, 0xe6d3a8, 1); }
      e.losT = 0;
    }
    const goal = (e.type === 'grunt' || e.type === 'hauler') ? navGoal(e) : null;
    const gdx = goal ? goal.x - e.pos.x : dx, gdz = goal ? goal.z - e.pos.z : dz, gd = Math.hypot(gdx, gdz) || 1;
    e.nav = !!goal;
    const ty = Math.atan2(-gdx, -gdz);
    if (e.type === 'hauler') {
      let df = ty - e.yaw; df = Math.atan2(Math.sin(df), Math.cos(df));
      e.yaw += Math.max(-1.0 * dt, Math.min(1.0 * dt, df));
    } else e.yaw = ty;
    let want = 0;
    if (e.type === 'grunt' || e.type === 'hauler') want = 1;
    else want = dist > 18 ? 1 : dist < 11 ? -1 : 0;
    if (e.type === 'spotter' && e.lock > 0) want = 0;
    // 被勾锁拽过来：飞向玩家，落地后晕一下
    if (e.pulled > 0) {
      e.pulled -= dt; e.stun = 0.9; e.lock = 0; if (e.laser) e.laser.visible = false;
      const k = Math.min(1, dist / 3);
      e.vel.set(dx / dist * 20 * k, 0, dz / dist * 20 * k);
      e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; resolve(e.pos, e.t.r, e.t.h);
      e.mesh.position.y = groundAt(e.pos.x, e.pos.z, e.t.r * .8, e.pos.y) + Math.sin(Math.min(1, e.pulled / 0.5) * Math.PI) * 1.2;
      e.mesh.rotation.x = -0.5; e.mesh.rotation.y = ty0(dx, dz);
      if (dist < 2.6) e.pulled = 0;
      continue;
    }
    if (e.stun > 0) { e.stun -= dt; e.mesh.rotation.x = 0; e.mesh.rotation.z = Math.sin(e.stun * 30) * 0.15; e.vel.multiplyScalar(0.8); continue; }
    const sp = e.t.speed * (e.spd || 1) * (e.type === 'hauler' && dist < 6 ? 1.6 : 1);
    let mx = e.type === 'hauler' ? -Math.sin(e.yaw) : gdx / gd, mz = e.type === 'hauler' ? -Math.cos(e.yaw) : gdz / gd;
    if (e.detour > 0) {
      e.detour -= dt; const a = e.side * 1.35, c = Math.cos(a), s = Math.sin(a);
      [mx, mz] = [mx * c - mz * s, mx * s + mz * c];
    } else if (want !== 0) {
      const moved = Math.hypot(e.pos.x - (e.px ?? e.pos.x), e.pos.z - (e.pz ?? e.pos.z));
      e.stuck = moved < e.t.speed * dt * 0.25 ? (e.stuck || 0) + dt : 0;
      if (e.stuck > 0.3) { e.detour = 1.0 + Math.random() * 0.8; e.side = Math.random() < .5 ? -1 : 1; e.stuck = 0; }
    }
    e.px = e.pos.x; e.pz = e.pos.z;
    e.vel.x += (mx * want * sp - e.vel.x) * Math.min(1, dt * 6);
    e.vel.z += (mz * want * sp - e.vel.z) * Math.min(1, dt * 6);
    for (const o of enemies) if (o !== e && !o.dead) {
      const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d2 = ox * ox + oz * oz, rr = e.t.r + o.t.r;
      if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2); e.vel.x += ox / d * 60 * dt; e.vel.z += oz / d * 60 * dt; }
    }
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    resolve(e.pos, e.t.r, e.t.h);
    e.pos.y = groundAt(e.pos.x, e.pos.z, e.t.r * .8, e.pos.y);
    const spd = Math.hypot(e.vel.x, e.vel.z);
    e.walk += dt * (4 + spd * 2.2);
    animate(e.rig, e.walk, spd, { locking: e.lock > 0 });
    if (e.rig.stacks && (e.puff = (e.puff || 0) - dt) <= 0) {
      e.puff = 0.35 + Math.random() * 0.2; e.mesh.updateMatrixWorld();
      const sp = e.rig.stacks[(Math.random() * 2) | 0].clone().applyMatrix4(e.mesh.matrixWorld);
      smoke(sp, 1, 0.28, 0x6a625a, 1.6);
    }
    e.mesh.rotation.y = e.yaw;
    e.mesh.rotation.z = e.type === 'hauler' ? Math.sin(e.walk * 3) * 0.01 : 0;
    if (e.type === 'grunt' || e.type === 'hauler') {
      const reach = e.t.r + P.r + 0.5;
      if (dist < reach && Math.abs(P.pos.y - e.pos.y) < 1.6) {
        e.cd -= dt;
        if (e.cd <= 0) {
          hurtPlayer(e.type === 'hauler' ? 28 : 10, e.pos);
          if (e.type === 'hauler') { P.vel.x += dx / dist * 14; P.vel.z += dz / dist * 14; P.vel.y = 5; }
          e.cd = 0.9 / (e.spd || 1);
        }
      }
    } else {
      eyePos(_b); e.mesh.updateMatrixWorld(); _a.copy(e.rig.eyeLocal).applyMatrix4(e.mesh.matrixWorld);
      e.cd -= dt;
      if (e.lock > 0) {
        e.lock -= dt;
        const d = _b.clone().sub(_a); const len = d.length();
        // 激光停在玩家面前 1.2 米、略低处，避免贴脸变成一大片红
        const end = _a.clone().addScaledVector(d, Math.max(0, len - 1.2) / len); end.y -= 0.3;
        const ld = end.clone().sub(_a), ll = ld.length();
        e.laser.visible = true; e.laser.position.copy(_a).addScaledVector(ld, .5);
        const th = e.lock < 0.35 ? 0.035 : 0.018; e.laser.scale.set(th, th, ll); e.laser.lookAt(end);
        e.laser.material.color.setHex(Math.floor(t * (e.lock < 0.35 ? 30 : 12)) % 2 ? 0xff2a1a : 0xffd0c0);
        if (e.lock <= 0) {
          e.laser.visible = false;
          const dir = d.clone().normalize();
          tracer(_a, _b, 0xff4a2a); flashStar(_a.clone().addScaledVector(dir, 0.3), 0.5);
          hooks.onShot && hooks.onShot(e);
          if (rayWorld(_a, dir, len) >= len - 0.3) hurtPlayer(22, e.pos);
          e.cd = (2.2 + Math.random()) / (e.spd || 1);
        }
      } else if (e.cd <= 0 && dist < 34) {
        const d = _b.clone().sub(_a); const len = d.length();
        if (rayWorld(_a, d.normalize(), len) >= len - 0.3) { e.lock = 1.1 / (e.spd || 1); hooks.onLaser && hooks.onLaser(e); } else e.cd = 0.4;
      }
    }
  }
}

const ty0 = (dx, dz) => Math.atan2(-dx, -dz);
// 范围伤害（连锁爆破用）
// kind: 'boom' 时有伤害数字；kb>0 时把敌人炸飞。返回打中几个
export function blast(center, radius, dmg, src, kind = '', kb = 0) {
  let n = 0;
  for (const e of [...enemies]) {
    if (e.dead || e === src) continue;
    const d = Math.hypot(e.pos.x - center.x, e.pos.z - center.z);
    if (d < radius + e.t.r) {
      const dir = new THREE.Vector3(e.pos.x - center.x, 0, e.pos.z - center.z).normalize();
      damageEnemy(e, dmg * (1 - d / (radius + e.t.r) * 0.5), false, dir, true, kind); n++;
      if (kb && !e.dead && !e.t.heavy && !e.t.ai) { e.kb = e.kb || new THREE.Vector3(); e.kb.addScaledVector(dir, kb); }
    }
  }
  return n;
}
// 精英护盾先挡伤害（电击打护盾翻倍），返回穿过护盾剩下的伤害
export const shieldHooks = { hit: null, broke: null };
function absorb(e, d, kind) {
  if (!(e.shield > 0)) return d;
  const k = kind === 'shock' ? 2 : 1, take = Math.min(e.shield, d * k);
  e.shield -= take; shieldHooks.hit && shieldHooks.hit(e);
  if (e.shield <= 0) { e.shield = 0; shieldHooks.broke && shieldHooks.broke(e); }
  return Math.max(0, d - take / k);
}
// 射线检测：返回 {e,t,head}
export function rayEnemies(o, d, max) {
  let best = null;
  for (const e of enemies) {
    if (e.dead) continue;
    const r = e.t.r + 0.1, y0 = e.pos.y, y1 = e.pos.y + e.t.h;
    const ox = o.x - e.pos.x, oz = o.z - e.pos.z;
    const a = d.x * d.x + d.z * d.z; if (a < 1e-8) continue;
    const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r;
    const disc = b * b - a * c; if (disc < 0) continue;
    let t = (-b - Math.sqrt(disc)) / a; if (t < 0) t = (-b + Math.sqrt(disc)) / a;
    if (t < 0 || t > max) continue;
    const y = o.y + d.y * t; if (y < y0 || y > y1) continue;
    const hd = e.t.head;
    if (!best || t < best.t) best = { e, t, head: !!hd && y > y0 + e.t.h * hd[0] && y < y0 + e.t.h * hd[1] };
  }
  return best;
}

// 返回 'kill' | 'armor' | 'hit'
// kind: 元素伤害（burn / shock / boom）会弹出对应颜色的小数字，并且打不动无敌状态
export function damageEnemy(e, dmg, head, fromDir, splash = false, kind = '') {
  let m = 1, tag = '', cls = '', res = 'hit';
  if (splash) {
    if (kind && e.invuln) return 'armor';
    if (kind && e.armorAll && !e.exposed) dmg *= 0.5;
    e.hp -= absorb(e, dmg, kind);
    if (kind !== 'burn') { e.flash = 0.06; setFlash(e.rig, true); }
    if (kind && dmg >= 1) popText(String(Math.round(dmg)), new THREE.Vector3(e.pos.x + (Math.random() - .5) * .6, e.pos.y + e.t.h * (0.5 + Math.random() * .4), e.pos.z), 'el-' + kind);
    if (e.hp <= 0) { killEnemy(e, fromDir); return 'kill'; } return 'hit';
  }
  if (e.invuln) { if (Math.random() < 0.3) popText('MISS', new THREE.Vector3(e.pos.x, e.pos.y + 0.5, e.pos.z), 'clang'); return 'armor'; }
  if (head) { m *= mods.headMul; tag = 'CRIT!'; cls = 'crit'; }
  if (e.exposed) { m *= 2; tag = tag || 'WEAK!'; cls = 'crit'; }
  if (e.t.bodyArmor && !head) m *= e.t.bodyArmor;
  if (e.armorAll && !head && !e.exposed) { m *= e.armorAll; res = 'armor'; tag = 'TINK!'; cls = 'clang'; }
  if (e.t.frontArmor) {
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    const dot = -(fromDir.x * fx + fromDir.z * fz);
    if (dot > 0.3) { m *= mods.armorK; tag = 'TINK!'; cls = 'clang'; res = 'armor'; } else { m *= 1.6; tag = 'BACK!'; cls = 'crit'; }
  }
  const dealt = dmg * m;
  e.hp -= absorb(e, dealt); e.flash = 0.06; setFlash(e.rig, true); e.hitT = 0; e.lastHead = head;
  if (!e.t.heavy && !e.t.fly && fromDir) { e.kb = e.kb || new THREE.Vector3(); e.kb.x += fromDir.x * Math.min(5, dealt * 0.3); e.kb.z += fromDir.z * Math.min(5, dealt * 0.3); }
  const pos = new THREE.Vector3(e.pos.x, e.pos.y + e.t.h * (head ? .92 : .6), e.pos.z);
  popText(tag || String(Math.round(dealt)), pos.clone().add(new THREE.Vector3((Math.random() - .5) * .5, .3, 0)), cls || 'num');
  burst(pos, res === 'armor' ? 0xfff1a0 : head ? 0xff4a2a : 0xffd21f, res === 'armor' ? 8 : head ? 9 : 4, 6);
  if (e.hp <= 0) { killEnemy(e, fromDir); return 'kill'; }
  return res;
}
export function killEnemy(e, dir) {
  e.dead = true;
  const c = new THREE.Vector3(e.pos.x, e.pos.y + e.t.h * 0.5, e.pos.z);
  setFlash(e.rig, false);
  scatter(e.mesh, c.clone().addScaledVector(dir || new THREE.Vector3(), -0.5), dir ? new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(e.t.boss ? 3 : 7) : null);
  scene.remove(e.mesh); if (e.laser) scene.remove(e.laser);
  flashStar(c, e.type === 'hauler' ? 2.4 : 1.4);
  smoke(c, e.type === 'hauler' ? 9 : 5, e.type === 'hauler' ? 1.5 : 0.9, 0xd8d0c0, 1.8);
  burst(c, 0xffb000, 14, 9, 0.12);
  graffiti(e.pos.x, e.pos.z, e.type === 'hauler' ? 1.6 : 1);
  popText('KO!', c.clone().add(new THREE.Vector3(0, e.t.h * 0.6, 0)), 'ko');
  const k = enemies.indexOf(e); if (k >= 0) enemies.splice(k, 1);
  hooks.onKill && hooks.onKill(e);
}
export function clearEnemies() { for (const e of enemies) { scene.remove(e.mesh); if (e.laser) scene.remove(e.laser); } enemies.length = 0; }
