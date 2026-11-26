import * as THREE from 'three';
import { P, eyePos, lookDir, mouse, keys } from './player.js';
import { rayWorld } from './world.js';
import { rayEnemies, rayEnemiesAll, damageEnemy } from './enemies.js';
import { tracer, burst, impact } from './fx.js';
import { buildVM, fireVM, muzzleSide, vmState } from './viewmodel.js';
import { mods } from './stats.js';
import { onShot, burnBonus, zap, bolt } from './elements.js';
import { fireRocket } from './rockets.js';
export { mods };
export { vmScene, vmCam, updateVM } from './viewmodel.js';

// pierce：钉子能穿几个敌人；proj：发射弹体（火箭）；charge：按住蓄力、松手发射（秒数是蓄满时间）
export const DEFS = {
  pistol:  { name: '手枪', dmg: 14, rate: 4.5, mag: 12, reload: 1.0, pellets: 1, spread: 0.004, bloom: 0.012, auto: false, kick: 0.9, shake: 0.25, icon: 'pistol' },
  smg:     { name: '冲锋枪', dmg: 9, rate: 13, mag: 32, reload: 1.3, pellets: 1, spread: 0.014, bloom: 0.006, auto: true, kick: 0.45, shake: 0.18, icon: 'smg' },
  shotgun: { name: '霰弹枪', dmg: 9, rate: 1.4, mag: 6, reload: 1.8, pellets: 8, spread: 0.07, bloom: 0, auto: false, kick: 1.4, shake: 0.8, icon: 'shotgun' },
  dual:    { name: '双持手枪', dmg: 10, rate: 10, mag: 40, reload: 1.4, pellets: 1, spread: 0.016, bloom: 0.006, auto: true, kick: 0.7, shake: 0.2, icon: 'dual' },
  nail:    { name: '穿透钉枪', dmg: 15, rate: 6.5, mag: 30, reload: 1.6, pellets: 1, spread: 0.005, bloom: 0.004, auto: true, kick: 0.55, shake: 0.16, icon: 'nail', pierce: 3 },
  rocket:  { name: '火箭筒', dmg: 70, rate: 1.0, mag: 3, reload: 2.3, pellets: 1, spread: 0.002, bloom: 0, auto: false, kick: 1.8, shake: 0.7, icon: 'rocket', proj: 1 },
  arc:     { name: '电弧枪', dmg: 22, rate: 2.4, mag: 10, reload: 1.7, pellets: 1, spread: 0.002, bloom: 0, auto: false, kick: 1.2, shake: 0.3, icon: 'arc', charge: 1.1 },
};
// 武器等级（升级卡）：0 / 1 / 2
export const W = { owned: ['pistol'], cur: 'pistol', ammo: {}, cd: 0, reloading: 0, fired: false, bloom: 0, lv: {}, charge: 0, chTick: 0 };
export const wlv = k => W.lv[k] || 0;
export const UPG = {
  nail: ['穿透 +2，伤害 +20%', '钉子有 30% 概率把小怪钉住 0.6 秒，射速 +20%'],
  rocket: ['伤害 +35%，爆炸范围 +25%', '子母弹：爆炸后再散出 3 颗小炸弹'],
  arc: ['蓄力快 40%，伤害 +25%', '蓄满时电弧在被打中的敌人之间连锁跳'],
};
export const wHooks = { onFire: null, onReload: null, onSwitch: null, onCharge: null };

export const magSize = k => Math.round(DEFS[k].mag * mods.mag);
export function resetWeapons() {
  W.owned = ['pistol']; W.cur = 'pistol'; W.cd = 0; W.reloading = 0; W.ammo = {}; W.bloom = 0; W.lv = {}; W.charge = 0;
  for (const k in DEFS) W.ammo[k] = magSize(k);
  buildVM('pistol');
}
export function giveWeapon(k) { if (!W.owned.includes(k)) W.owned.push(k); W.ammo[k] = magSize(k); switchTo(k); }
export function upgradeWeapon(k) { W.lv[k] = wlv(k) + 1; W.ammo[k] = magSize(k); switchTo(k); }
export function switchTo(k) {
  if (W.owned.includes(k) && W.cur !== k) { W.cur = k; W.reloading = 0; W.cd = 0.25; W.charge = 0; buildVM(k); wHooks.onSwitch && wHooks.onSwitch(k); }
}
const reloadTime = k => DEFS[k].reload * mods.reload;
export const reloadProgress = () => W.reloading > 0 ? 1 - W.reloading / reloadTime(W.cur) : -1;
// 弹匣容量变了（卡牌）后把所有枪补满
export function refillAll() { for (const k in DEFS) W.ammo[k] = magSize(k); }
const rateOf = k => DEFS[k].rate * mods.rate * (k === 'nail' && wlv(k) >= 2 ? 1.2 : 1);
const chargeTime = () => DEFS.arc.charge * (wlv('arc') >= 1 ? 0.6 : 1) / Math.sqrt(mods.rate);

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
export function updateWeapons(dt, ev) {
  W.cd -= dt;
  const def = DEFS[W.cur];
  W.bloom = Math.max(0, W.bloom - dt * 0.12);
  vmState.loaded = W.ammo[W.cur] > 0 && W.reloading <= 0;
  if (W.reloading > 0) { W.reloading -= dt; if (W.reloading <= 0) W.ammo[W.cur] = magSize(W.cur); return; }
  if ((keys.KeyR && W.ammo[W.cur] < magSize(W.cur)) || (W.ammo[W.cur] <= 0 && W.cd <= 0)) {
    W.charge = 0; vmState.charge = 0;
    W.reloading = reloadTime(W.cur); wHooks.onReload && wHooks.onReload(W.cur, W.reloading); return;
  }
  // 电弧枪：按住蓄力，松手发射
  let charge = 0;
  if (def.charge) {
    if (mouse.down && W.cd <= 0) {
      W.charge = Math.min(1, W.charge + dt / chargeTime()); vmState.charge = W.charge;
      if ((W.chTick -= dt) <= 0) { W.chTick = 0.12; wHooks.onCharge && wHooks.onCharge(W.charge); }
      return;
    }
    if (W.charge <= 0) return;
    charge = W.charge; W.charge = 0; vmState.charge = 0;
  } else {
    const want = def.auto ? mouse.down : (mouse.down && !W.fired);
    if (!mouse.down) W.fired = false;
    if (!(want && W.cd <= 0 && W.ammo[W.cur] > 0)) return;
  }
  W.fired = true; W.cd = 1 / rateOf(W.cur); W.ammo[W.cur]--;
  fireVM(def.kick * (def.charge ? 0.5 + charge : 1));
  P.kick += 0.006 + def.kick * 0.01; ev.shake = Math.max(ev.shake || 0, def.shake * (def.charge ? 0.5 + charge * 1.5 : 1));
  eyePos(_o); lookDir(_d);
  const right = new THREE.Vector3().crossVectors(_d, UP).normalize(), up = new THREE.Vector3().crossVectors(right, _d);
  const side = muzzleSide();
  const mz = _o.clone().addScaledVector(right, 0.22 * side).addScaledVector(up, -0.17).addScaledVector(_d, 0.7);
  const sp = (def.spread + W.bloom) * mods.spread + (P.onGround ? 0 : 0.01);
  const res = def.proj ? fireProj(def, mz, sp, right, up) : def.charge ? fireArc(def, mz, charge) : def.pierce ? fireNail(def, mz, sp, right, up) : fireHitscan(def, mz, sp, right, up);
  W.bloom = Math.min(0.05, W.bloom + def.bloom);
  ev.hit = Math.max(ev.hit || 0, res.hit); ev.kill = ev.kill || res.kill;
  wHooks.onFire && wHooks.onFire(W.cur, res.hit, charge);
}
function jitter(sp, right, up) {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
  return _d.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
}
const dmgOf = (def, e) => def.dmg * mods.dmg * P.dmgMul * burnBonus(e);

function fireHitscan(def, mz, sp, right, up) {
  const pellets = def.pellets + (def.pellets > 1 ? mods.pellets : 0);
  let hitAny = 0, killAny = 0, wall = null; const hits = [];
  for (let i = 0; i < pellets; i++) {
    const dir = jitter(sp, right, up);
    const tw = rayWorld(_o, dir, 140), hit = rayEnemies(_o, dir, Math.min(tw, 140));
    const t = hit ? hit.t : Math.min(tw, 140);
    _h.copy(_o).addScaledVector(dir, t);
    if (i < 3) tracer(mz, _h.clone());
    if (hit) {
      const res = damageEnemy(hit.e, dmgOf(def, hit.e), hit.head, dir);
      hits.push({ e: hit.e, p: _h.clone(), head: hit.head });
      hitAny = Math.max(hitAny, hit.head ? 2 : 1); if (res === 'kill') killAny = 1; if (res === 'armor') hitAny = 3;
    } else if (tw < 140) { impact(_h, dir); if (!wall) wall = _h.clone().addScaledVector(dir, -0.3); }
  }
  onShot(def, hits, wall);
  return { hit: hitAny, kill: killAny };
}
// 钉枪：一颗钉子穿过一串敌人，每穿一个伤害 ×0.85，打到正面装甲就停
function fireNail(def, mz, sp, right, up) {
  const L = wlv('nail'), n = def.pierce + (L >= 1 ? 2 : 0), dm = L >= 1 ? 1.2 : 1;
  const dir = jitter(sp, right, up);
  const tw = rayWorld(_o, dir, 140), list = rayEnemiesAll(_o, dir, Math.min(tw, 140));
  let hitAny = 0, killAny = 0, k = 1, end = Math.min(tw, 140); const hits = [];
  for (let i = 0; i < list.length && i < n; i++) {
    const h = list[i], p = _o.clone().addScaledVector(dir, h.t);
    const res = damageEnemy(h.e, dmgOf(def, h.e) * dm * k, h.head, dir);
    hits.push({ e: h.e, p, head: h.head }); k *= 0.85;
    hitAny = Math.max(hitAny, h.head ? 2 : 1); if (res === 'kill') killAny = 1;
    if (L >= 2 && res !== 'kill' && (!h.e.t.ai || h.e.t.stunOK) && !h.e.t.boss && Math.random() < 0.3) h.e.stun = Math.max(h.e.stun || 0, 0.6);
    if (res === 'armor') { hitAny = 3; end = h.t; break; }
    if (i === n - 1) end = h.t;
  }
  _h.copy(_o).addScaledVector(dir, end);
  tracer(mz, _h.clone(), 0xd8e0e6);
  if (end >= tw - 0.01 && tw < 140) impact(_h, dir);
  onShot(def, hits, hits.length ? null : (tw < 140 ? _h.clone().addScaledVector(dir, -0.3) : null));
  return { hit: hitAny, kill: killAny };
}
// 火箭筒：发射弹体，命中反馈在 rockets.js 里
function fireProj(def, mz, sp, right, up) {
  const L = wlv('rocket'), dir = jitter(sp, right, up);
  // 从枪口飞向准星指的点，近处也打得准
  const tw = rayWorld(_o, dir, 140), hit = rayEnemies(_o, dir, Math.min(tw, 140));
  const aim = _o.clone().addScaledVector(dir, hit ? hit.t : Math.min(tw, 140));
  const start = _o.clone().addScaledVector(dir, 1.3).addScaledVector(right, 0.12).addScaledVector(up, -0.08);
  const d = aim.distanceTo(start) > 2 ? aim.sub(start).normalize() : dir;
  fireRocket(start, d, { dmg: def.dmg * mods.dmg * P.dmgMul * (L >= 1 ? 1.35 : 1), r: 3.2 * (L >= 1 ? 1.25 : 1), speed: 42, bomblets: L >= 2 });
  return { hit: 0, kill: 0 };
}
// 电弧枪：一道光束穿过线上所有敌人。伤害随蓄力 22→110，蓄满还会连锁
function fireArc(def, mz, c) {
  const L = wlv('arc'), dir = _d.clone();
  const tw = rayWorld(_o, dir, 90), list = rayEnemiesAll(_o, dir, Math.min(tw, 90));
  const dmg = def.dmg * (1 + c * 4) * (L >= 1 ? 1.25 : 1) * mods.dmg * P.dmgMul;
  let hitAny = 0, killAny = 0; const hits = [];
  for (const h of list) {
    const p = _o.clone().addScaledVector(dir, h.t);
    const res = damageEnemy(h.e, dmg * burnBonus(h.e), h.head, dir, false, 'shock');
    h.e.shockT = 0.5; hits.push({ e: h.e, p, head: h.head });
    hitAny = Math.max(hitAny, h.head ? 2 : 1); if (res === 'kill') killAny = 1;
  }
  _h.copy(_o).addScaledVector(dir, Math.min(tw, 90));
  bolt(mz, _h.clone(), 0.5 + c * 1.6);
  if (tw < 90) { impact(_h, dir); burst(_h, 0x9fe8ff, 6 + c * 10, 6, 0.07); }
  if (L >= 2 && c >= 0.99) hits.slice(0, 3).forEach(h => !h.e.dead && zap(h.e, null));
  onShot(def, hits, hits.length ? null : (tw < 90 ? _h.clone().addScaledVector(dir, -0.3) : null));
  return { hit: hitAny, kill: killAny };
}
