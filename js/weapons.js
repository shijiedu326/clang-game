import * as THREE from 'three';
import { P, eyePos, lookDir, mouse, keys } from './player.js';
import { rayWorld } from './world.js';
import { rayEnemies, damageEnemy } from './enemies.js';
import { tracer, burst, impact } from './fx.js';
import { buildVM, fireVM, muzzleSide } from './viewmodel.js';
import { mods } from './stats.js';
import { onShot, burnBonus } from './elements.js';
export { mods };
export { vmScene, vmCam, updateVM } from './viewmodel.js';

export const DEFS = {
  pistol:  { name: '手枪', dmg: 14, rate: 4.5, mag: 12, reload: 1.0, pellets: 1, spread: 0.004, bloom: 0.012, auto: false, kick: 0.9, shake: 0.25, icon: 'pistol' },
  smg:     { name: '冲锋枪', dmg: 9, rate: 13, mag: 32, reload: 1.3, pellets: 1, spread: 0.014, bloom: 0.006, auto: true, kick: 0.45, shake: 0.18, icon: 'smg' },
  shotgun: { name: '霰弹枪', dmg: 9, rate: 1.4, mag: 6, reload: 1.8, pellets: 8, spread: 0.07, bloom: 0, auto: false, kick: 1.4, shake: 0.8, icon: 'shotgun' },
  dual:    { name: '双持手枪', dmg: 10, rate: 10, mag: 40, reload: 1.4, pellets: 1, spread: 0.016, bloom: 0.006, auto: true, kick: 0.7, shake: 0.2, icon: 'dual' },
};
export const W = { owned: ['pistol'], cur: 'pistol', ammo: {}, cd: 0, reloading: 0, fired: false, bloom: 0 };
export const wHooks = { onFire: null, onReload: null, onSwitch: null };

export const magSize = k => Math.round(DEFS[k].mag * mods.mag);
export function resetWeapons() {
  W.owned = ['pistol']; W.cur = 'pistol'; W.cd = 0; W.reloading = 0; W.ammo = {}; W.bloom = 0;
  for (const k in DEFS) W.ammo[k] = magSize(k);
  buildVM('pistol');
}
export function giveWeapon(k) { if (!W.owned.includes(k)) W.owned.push(k); W.ammo[k] = magSize(k); switchTo(k); }
export function switchTo(k) {
  if (W.owned.includes(k) && W.cur !== k) { W.cur = k; W.reloading = 0; W.cd = 0.25; buildVM(k); wHooks.onSwitch && wHooks.onSwitch(k); }
}
const reloadTime = k => DEFS[k].reload * mods.reload;
export const reloadProgress = () => W.reloading > 0 ? 1 - W.reloading / reloadTime(W.cur) : -1;
// 弹匣容量变了（卡牌）后把所有枪补满
export function refillAll() { for (const k in DEFS) W.ammo[k] = magSize(k); }

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
export function updateWeapons(dt, ev) {
  W.cd -= dt;
  const def = DEFS[W.cur];
  W.bloom = Math.max(0, W.bloom - dt * 0.12);
  if (W.reloading > 0) { W.reloading -= dt; if (W.reloading <= 0) W.ammo[W.cur] = magSize(W.cur); return; }
  if ((keys.KeyR && W.ammo[W.cur] < magSize(W.cur)) || (W.ammo[W.cur] <= 0 && W.cd <= 0)) {
    W.reloading = reloadTime(W.cur); wHooks.onReload && wHooks.onReload(W.cur, W.reloading); return;
  }
  const want = def.auto ? mouse.down : (mouse.down && !W.fired);
  if (!mouse.down) W.fired = false;
  if (!(want && W.cd <= 0 && W.ammo[W.cur] > 0)) return;
  W.fired = true; W.cd = 1 / (def.rate * mods.rate); W.ammo[W.cur]--;
  fireVM(def.kick);
  P.kick += 0.006 + def.kick * 0.01; ev.shake = Math.max(ev.shake || 0, def.shake);
  eyePos(_o); lookDir(_d);
  const right = new THREE.Vector3().crossVectors(_d, UP).normalize(), up = new THREE.Vector3().crossVectors(right, _d);
  const side = muzzleSide();
  const mz = _o.clone().addScaledVector(right, 0.22 * side).addScaledVector(up, -0.17).addScaledVector(_d, 0.7);
  const sp = (def.spread + W.bloom) * mods.spread + (P.onGround ? 0 : 0.01);
  const pellets = def.pellets + (def.pellets > 1 ? mods.pellets : 0);
  let hitAny = 0, killAny = 0, wall = null; const hits = [];
  for (let i = 0; i < pellets; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
    const dir = _d.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    const tw = rayWorld(_o, dir, 140), hit = rayEnemies(_o, dir, Math.min(tw, 140));
    const t = hit ? hit.t : Math.min(tw, 140);
    _h.copy(_o).addScaledVector(dir, t);
    if (i < 3) tracer(mz, _h.clone());
    if (hit) {
      const res = damageEnemy(hit.e, def.dmg * mods.dmg * P.dmgMul * burnBonus(hit.e), hit.head, dir);
      hits.push({ e: hit.e, p: _h.clone(), head: hit.head });
      hitAny = Math.max(hitAny, hit.head ? 2 : 1); if (res === 'kill') killAny = 1; if (res === 'armor') hitAny = 3;
    } else if (tw < 140) { impact(_h, dir); if (!wall) wall = _h.clone().addScaledVector(dir, -0.3); }
  }
  onShot(def, hits, wall);
  W.bloom = Math.min(0.05, W.bloom + def.bloom);
  ev.hit = Math.max(ev.hit || 0, hitAny); ev.kill = ev.kill || killAny;
  wHooks.onFire && wHooks.onFire(W.cur, hitAny);
}
