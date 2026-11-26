import * as THREE from 'three';
import { enemies, spawn, blast, shieldHooks } from './enemies.js';
import { P, hurtPlayer } from './player.js';
import { warnCircle } from './hazards.js';
import { popText, smoke, flashStar, burst } from './fx.js';
import { NO_INK } from './post.js';
import { findSpot } from './world.js';

// 精英怪：第 6 关起，普通机器人有概率带一个词条。血 ×1.8、分 ×2.5、个头大一圈、脚下有彩色光圈
export const AFFIX = {
  shield:   { name: '护盾', en: 'SHIELDED', color: 0x4ab8ff, css: '#2f8fd0', tip: '先打碎蓝色护盾 · 电击打护盾伤害翻倍' },
  frenzy:   { name: '狂暴', en: 'FRENZIED', color: 0xff3a2a, css: '#e8431f', tip: '移动、攻击都快 50%' },
  volatile: { name: '自爆', en: 'VOLATILE', color: 0xffa01f, css: '#e07a10', tip: '被打死 0.8 秒后爆炸，离远点' },
  summon:   { name: '召唤', en: 'SUMMONER', color: 0x6ad84a, css: '#3f9a2a', tip: '每 6 秒叫来一只拾荒机，先打它' },
};
export const eliteHooks = { on: {} }; // first(affix) / summon(minion) / sfx(name)
const gate = {};
const say = (n) => { const t = performance.now(); if (t - (gate[n] || 0) < 60) return; gate[n] = t; eliteHooks.on.sfx && eliteHooks.on.sfx(n); };
let scene;
const vis = new Map(), pend = [], firstSeen = new Set();
export function initElites(s) { scene = s; }
export function eliteChance(lv) { return lv < 6 ? 0 : Math.min(0.06 + (lv - 6) * 0.012, 0.28) + (lv > 30 ? 0.08 : 0); }
export const ELITE_TYPES = ['grunt', 'spotter', 'hauler', 'shieldbot', 'splitter', 'spider'];

const ringG = new THREE.RingGeometry(0.78, 1, 40), shellG = new THREE.SphereGeometry(1, 22, 14);
const noInk = o => { o.layers.set(NO_INK); return o; };
export function makeElite(e, affix) {
  if (!affix) { const ks = Object.keys(AFFIX); affix = ks[(Math.random() * ks.length) | 0]; }
  const A = AFFIX[affix];
  e.elite = affix; e.hp *= 1.8; e.maxHp *= 1.8; e.scoreMul = 2.5; e.big = 1.15;
  if (affix === 'shield') e.shield = e.maxShield = e.maxHp * 0.6;
  if (affix === 'frenzy') e.spd = 1.5;
  if (affix === 'summon') { e.sumT = 2.5; e.minions = 0; }
  const ring = noInk(new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: A.color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })));
  ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(e.t.r * 1.5); scene.add(ring);
  const v = { ring, A, ph: Math.random() * 6 };
  if (affix === 'shield') {
    v.shell = noInk(new THREE.Mesh(shellG, new THREE.MeshBasicMaterial({ color: 0x6ac8ff, transparent: true, opacity: 0.22, depthWrite: false })));
    v.shell.scale.set(e.t.r * 1.7, e.t.h * 0.68, e.t.r * 1.7); scene.add(v.shell);
  }
  vis.set(e, v);
  setTimeout(() => !e.dead && popText('精英 · ' + A.name, new THREE.Vector3(e.pos.x, e.pos.y + e.t.h * 1.2 + 0.4, e.pos.z), 'elite'), 500);
  if (!firstSeen.has(affix)) { firstSeen.add(affix); eliteHooks.on.first && eliteHooks.on.first(affix); }
  return e;
}
shieldHooks.hit = e => { const v = vis.get(e); if (v && v.shell) v.flash = 1; say('shieldHit'); };
shieldHooks.broke = e => {
  const v = vis.get(e); if (v && v.shell) { scene.remove(v.shell); v.shell = null; }
  const c = new THREE.Vector3(e.pos.x, e.pos.y + e.t.h * 0.6, e.pos.z);
  burst(c, 0x9fe0ff, 18, 9, 0.1); popText('SHIELD BREAK!', c.clone().setY(c.y + 0.8), 'crit'); say('shieldBreak');
};
// 精英怪被打死
export function onEliteKill(e) {
  if (e.minionOf) e.minionOf.minions = Math.max(0, e.minionOf.minions - 1);
  if (e.elite === 'volatile') {
    const p = new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z);
    pend.push({ p, t: 0.8, beep: 0, mark: warnCircle(p.x, p.z, 3.6, 0.8) });
  }
}
export function clearElites() { for (const [, v] of vis) drop(v); vis.clear(); pend.length = 0; firstSeen.clear(); }
function drop(v) { scene.remove(v.ring); if (v.shell) scene.remove(v.shell); }

export function updateElites(dt, S) {
  for (const [e, v] of vis) {
    if (e.dead || !enemies.includes(e)) { drop(v); vis.delete(e); continue; }
    v.ph += dt;
    const pulse = e.elite === 'volatile' ? 1 + Math.sin(v.ph * 12) * 0.12 : 1 + Math.sin(v.ph * 3) * 0.06;
    v.ring.position.set(e.pos.x, e.pos.y + 0.06, e.pos.z); v.ring.scale.setScalar(e.t.r * 1.5 * pulse); v.ring.rotation.z += dt;
    if (v.shell) {
      v.shell.position.set(e.pos.x, e.pos.y + e.t.h * 0.55, e.pos.z);
      v.flash = Math.max(0, (v.flash || 0) - dt * 5);
      v.shell.material.opacity = 0.16 + 0.1 * (e.shield / e.maxShield) + v.flash * 0.35;
    }
    if (e.elite === 'frenzy' && Math.random() < dt * 14) burst(new THREE.Vector3(e.pos.x + (Math.random() - .5) * e.t.r * 2, e.pos.y + Math.random() * e.t.h, e.pos.z + (Math.random() - .5) * e.t.r * 2), 0xff3a2a, 1, 2, 0.07);
    if (e.elite === 'summon' && !(e.stun > 0) && (e.sumT -= dt) <= 0) {
      e.sumT = 6;
      if (e.minions < 2 && enemies.length < 22) {
        const p = findSpot(e.pos.x, e.pos.z, 1.5, 5, 0.8);
        if (p) {
          const m = spawn('grunt', p.x, p.z, (S.plan && S.plan.hpMul) || 1); m.minionOf = e; e.minions++;
          smoke(new THREE.Vector3(p.x, 0.6, p.z), 5, 1, 0x8ad86a, 1.4); burst(new THREE.Vector3(p.x, 1, p.z), 0x6ad84a, 10, 6, 0.08);
          eliteHooks.on.summon && eliteHooks.on.summon(m);
        }
      }
    }
  }
  for (let i = pend.length - 1; i >= 0; i--) {
    const o = pend[i]; o.t -= dt;
    if ((o.beep -= dt) <= 0) { o.beep = o.t > 0.3 ? 0.2 : 0.08; say('beep'); }
    if (o.t <= 0) {
      pend.splice(i, 1);
      const c = o.p.clone().setY(o.p.y + 1);
      flashStar(c, 3.6); smoke(c, 8, 2.4, 0xffb060, 2); burst(c, 0xffa01f, 20, 11, 0.12); say('boom');
      eliteHooks.on.shake && eliteHooks.on.shake(0.8);
      if (Math.hypot(P.pos.x - o.p.x, P.pos.z - o.p.z) < 3.6 + P.r && Math.abs(P.pos.y - o.p.y) < 3) hurtPlayer(24, o.p);
      blast(c, 3.6, 40, null, 'boom');
    }
  }
}
