import * as THREE from 'three';
import { enemies, damageEnemy, blast } from './enemies.js';
import { mods } from './stats.js';
import { P } from './player.js';
import { popText, smoke, flashStar, burst } from './fx.js';
import { NO_INK } from './post.js';

// 三条流派：燃烧（持续伤害、烧死传火）、电击（电弧在敌人之间跳）、爆炸（范围伤害）
// 武器每开一枪调 onShot()，主循环每帧调 updateElements()，击杀时调 onElemKill()
let scene;
export const el = { on: {} }; // on.ignite / on.zap / on.boom：给音效用
export function initElements(s) { scene = s; }

const box = new THREE.BoxGeometry(1, 1, 1);
const mats = {}, mat = c => mats[c] || (mats[c] = new THREE.MeshBasicMaterial({ color: c }));
const fx = [];
function addFx(m, life, v) { m.layers.set(NO_INK); scene.add(m); fx.push({ m, t: life, life, v, s0: m.scale.x }); }
export function clearElements() { fx.forEach(f => scene.remove(f.m)); fx.length = 0; teslaT = 2; arcN = 0; }

const center = e => new THREE.Vector3(e.pos.x, e.pos.y + e.t.h * 0.55, e.pos.z);
const top = e => new THREE.Vector3(e.pos.x, e.pos.y + e.t.h + 0.25, e.pos.z);
let sfxGate = { ignite: 0, zap: 0, boom: 0 };
function snd(k) { const t = performance.now(); if (t - sfxGate[k] > 70) { sfxGate[k] = t; el.on[k] && el.on[k](); } }

// ---------- 燃烧 ----------
export function ignite(e, power = 1) {
  if (e.dead || e.invuln) return;
  const dps = 8 * mods.burnDmg * mods.dmg * power;
  if (!e.burn) { e.burn = { t: mods.burnDur, dps, tick: 0.5, fx: 0 }; popText('BURN!', top(e), 'el-burn big'); snd('ignite'); }
  else { e.burn.t = Math.max(e.burn.t, mods.burnDur); e.burn.dps = Math.max(e.burn.dps, dps); }
}
const burnChance = () => mods.burn + (mods.sets.fire ? 0.15 : 0);

// ---------- 电击：从一个敌人开始，依次跳到最近的下一个 ----------
export function bolt(a, b, k = 1) {
  const n = Math.max(5, Math.min(14, Math.round(a.distanceTo(b) / 1.5))), pts = [a.clone()];
  const L = a.distanceTo(b);
  for (let i = 1; i < n; i++) { const j = .7 * Math.min(1, L * i / n / 4); pts.push(a.clone().lerp(b, i / n).add(new THREE.Vector3((Math.random() - .5) * j, (Math.random() - .5) * j, (Math.random() - .5) * j))); }
  pts.push(b.clone());
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], len = p.distanceTo(q);
    for (const [c, w] of [[0x5fd8ff, 0.09 * k], [0xf2fdff, 0.035 * k]]) {
      const m = new THREE.Mesh(box, mat(c)); m.scale.set(w, w, len); m.position.copy(p).lerp(q, .5); m.lookAt(q); addFx(m, 0.13 + (k - 1) * 0.05, null);
    }
  }
  burst(b, 0x9fe8ff, 5, 5, 0.06);
}
export function zap(e0, from) {
  const dmg = 15 * mods.arcDmg * mods.dmg, range = mods.arcRange + (mods.sets.shock ? 3 : 0);
  const jumps = mods.arcJumps + (mods.sets.shock ? 2 : 0);
  const hit = new Set([e0]); let cur = e0, a = from ? from.clone() : center(e0);
  bolt(a, center(e0)); shock(e0, dmg);
  for (let i = 0; i < jumps; i++) {
    let best = null, bd = range;
    const c = center(cur);
    for (const o of enemies) { if (o.dead || hit.has(o)) continue; const d = c.distanceTo(center(o)); if (d < bd) { bd = d; best = o; } }
    if (!best) break;
    bolt(c, center(best)); shock(best, dmg * Math.pow(0.85, i + 1)); hit.add(best); cur = best;
  }
  snd('zap');
}
function shock(e, d) {
  if (e.dead) return;
  damageEnemy(e, d, false, null, true, 'shock');
  if (mods.arcStun && !e.dead && (!e.t.ai || e.t.stunOK) && !e.t.boss) e.stun = Math.max(e.stun || 0, mods.arcStun);
  e.shockT = 0.5;
}

// ---------- 爆炸 ----------
export function boom(c, radius, dmg, src = null) {
  const set = mods.sets.boom, R = radius * mods.boomR * (set ? 1.3 : 1), D = dmg * mods.boomDmg * (set ? 1.5 : 1);
  flashStar(c, Math.min(3.6, R * 0.7)); smoke(c, Math.min(7, 2 + Math.round(R)), R * 0.5, 0xffcf7a, 2);
  const n = blast(c, R, D, src, 'boom', set ? 9 : 0);
  if (mods.boomArmor && n) P.armor = Math.min(P.maxArmor, P.armor + mods.boomArmor * Math.min(n, 3));
  snd('boom'); el.on.shake && el.on.shake(Math.min(0.6, R * 0.12));
  return n;
}

// ---------- 每开一枪：hits=[{e,p,head}]，wall=子弹打在墙上的点 ----------
let arcN = 0;
export function onShot(def, hits, wall) {
  const rk = Math.max(0.45, Math.min(1.2, 6 / def.rate)); // 射速越高，每发触发概率越低
  if (mods.he) {
    const p = hits.length ? hits[0].p : wall;
    if (p) boom(p, 1.6, Math.max(def.dmg * def.pellets, 14) * 0.45 * mods.dmg, null);
  }
  if (!hits.length) return;
  if (mods.burn) { const seen = new Set(); for (const h of hits) if (!seen.has(h.e)) { seen.add(h.e); if (!h.e.dead && Math.random() < burnChance() * rk) ignite(h.e); } }
  const first = hits.find(h => !h.e.dead) || null;
  let doArc = mods.arc && Math.random() < mods.arc * rk;
  if (mods.arcEvery && ++arcN >= mods.arcEvery) { arcN = 0; doArc = true; }
  if (doArc && first) zap(first.e, null);
  if (mods.boomCrit) { const hh = hits.find(h => h.head); if (hh) boom(hh.p, 2.6, 20 * mods.dmg, null); }
}
// 对燃烧敌人的增伤（纵火狂）
export const burnBonus = e => (e.burn && mods.burnBonus ? 1 + mods.burnBonus : 1);

// ---------- 击杀 ----------
export function onElemKill(e) {
  if (!e.burn) return;
  if (mods.burnArmor) P.armor = Math.min(P.maxArmor, P.armor + mods.burnArmor);
  if (mods.sets.fire) { // 焚化炉：烧死的敌人把火传给 4 米内的敌人
    const c = new THREE.Vector3(e.pos.x, e.pos.y + 0.6, e.pos.z);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; flame(c.clone().add(new THREE.Vector3(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2)), 1.4); }
    for (const o of enemies) if (!o.dead && o !== e && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 4 + o.t.r) ignite(o);
  }
}

// ---------- 每帧 ----------
function flame(p, k = 1) {
  const m = new THREE.Mesh(box, mat(Math.random() < 0.5 ? 0xff7a1a : Math.random() < 0.6 ? 0xffc21f : 0xe8431f));
  m.scale.setScalar((0.12 + Math.random() * 0.12) * k); m.position.copy(p); m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  addFx(m, 0.35 + Math.random() * 0.25, new THREE.Vector3((Math.random() - .5) * 0.6, 2 + Math.random() * 1.5, (Math.random() - .5) * 0.6));
}
let teslaT = 2;
export function updateElements(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    const b = e.burn;
    if (b) {
      b.t -= dt; b.tick -= dt; b.fx -= dt;
      if (b.fx <= 0) {
        b.fx = 0.06; const r = e.t.r * 0.8;
        flame(new THREE.Vector3(e.pos.x + (Math.random() - .5) * r * 2, e.pos.y + Math.random() * e.t.h, e.pos.z + (Math.random() - .5) * r * 2), Math.min(2, 0.8 + e.t.r * 0.3));
      }
      if (b.tick <= 0) { b.tick = 0.5; damageEnemy(e, b.dps * 0.5, false, null, true, 'burn'); if (e.dead) continue; }
      if (b.t <= 0) e.burn = null;
    }
    if (e.shockT > 0) { e.shockT -= dt; if (Math.random() < 0.35) burst(new THREE.Vector3(e.pos.x + (Math.random() - .5) * e.t.r * 2, e.pos.y + Math.random() * e.t.h, e.pos.z + (Math.random() - .5) * e.t.r * 2), 0x9fe8ff, 1, 3, 0.05); }
  }
  // 特斯拉线圈：每 2.5 秒自动电身边 10 米内最近的敌人
  if (mods.sets.shock && (teslaT -= dt) <= 0) {
    let best = null, bd = 10;
    for (const o of enemies) { if (o.dead) continue; const d = Math.hypot(o.pos.x - P.pos.x, o.pos.z - P.pos.z); if (d < bd) { bd = d; best = o; } }
    if (best) { teslaT = 2.5; zap(best, new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z)); } else teslaT = 0.4;
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t -= dt;
    if (f.v) { f.m.position.addScaledVector(f.v, dt); f.m.scale.setScalar(f.s0 * Math.max(0.05, f.t / f.life)); }
    if (f.t <= 0) { scene.remove(f.m); fx.splice(i, 1); }
  }
}
