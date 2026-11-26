import * as THREE from 'three';
import { buildWorld, skyMesh, findSpot, setMap, mapForLevel, MAPS, MAP } from './world.js';
import './maps.js';
import { initWeather, setWeather, updateWeather, wHooks as weatherHooks } from './weather.js';
import { InkPass } from './post.js';
import { P, keys, initInput, updatePlayer, resetPlayer, eyePos, playerHooks } from './player.js';
import { initFx, updateFx, clearDecals, flashStar, smoke, popText } from './fx.js';
import { enemies, initEnemies, updateEnemies, spawn, hooks, clearEnemies, blast, TYPES } from './enemies.js';
import { BUILD, animate } from './robots.js';
import { W, DEFS, updateWeapons, resetWeapons, switchTo, updateVM, vmScene, vmCam, wHooks, reloadProgress } from './weapons.js';
import { initHud, resetHud, updateHud, dossier, comic, banner, hitMarker, hurtFrom, setBuffSource, keyHint, bossIntro, sandBlind, rankOf, RANKS } from './hud.js';
import { mods, resetStats } from './stats.js';
import { draw, applyCard, showCards, resetCards, buffSummary } from './cards.js';
import { SK, initSkills, updateSkills, resetSkills } from './skills.js';
import { initHazards, updateHazards, clearHazards, dropCrate, hz, scrap } from './hazards.js';
import { bossHooks } from './bosses.js';
import { planLevel, SPECIALS, LAST, difficulty } from './levels.js';
import { initSpecials, setSpecial, updateSpecials } from './specials.js';
import { initAudio, sfx, setSfxVol, say } from './audio.js';
import { bgmSet, bgmUpdate, bgmToggleMute, bgmInfo, setMusicVol } from './bgm.js';
import { settings, save, seen, reach, record } from './save.js';
import { menu, showMenu, hideMenu } from './menu.js';
import { initElements, updateElements, clearElements, onElemKill, boom, el } from './elements.js';
import { initRockets, updateRockets, clearRockets, rHooks } from './rockets.js';
import { initCritters2, updateMines, clearMines, c2Hooks } from './critters2.js';
import { applyMeta, partsFor, bankParts, dailyInfo, dailyTry, dailyRecord, keyText, RULES } from './meta.js';
import { seeded } from './rng.js';
import { initElites, updateElites, clearElites, makeElite, onEliteKill, eliteHooks, eliteChance, ELITE_TYPES, AFFIX } from './elites.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
let DPR = Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(DPR);
renderer.autoClear = false;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 420);
camera.rotation.order = 'YXZ';
vmCam.near = 0.05; vmCam.far = 420;
renderer.setClearColor(0xf2dfb4);
const ink = new InkPass(renderer);
buildWorld(scene); initFx(scene, camera); initEnemies(scene); initHud(); initSkills(scene); initHazards(scene); initSpecials(scene); initElements(scene); initElites(scene); initRockets(scene); initCritters2(scene); initWeather(scene);
weatherHooks.thunder = () => sfx.thunder && sfx.thunder();
setBuffSource(buffSummary);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  const v = renderer.getDrawingBufferSize(new THREE.Vector2()); ink.setSize(v.x, v.y);
  camera.aspect = vmCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- 游戏状态 ----------
export const S = { level: 1, score: 0, toSpawn: [], total: 0, killed: 0, running: false, over: false, nextT: 0, spawnT: 0, time: 0, between: false, streak: [], shake: 0, hurtFx: 0 };
window.G = { S, P, enemies, W, scene, camera, setMap, MAPS, setWeather, mapOf: () => MAP };

function startLevel(lv) {
  const D = S.daily, plan = D ? seeded(D.key * 1000 + lv, () => planLevel(lv)) : planLevel(lv); if (!D) reach(lv); clearMines();
  if (D && D.rules.includes('rich')) { plan.hpMul = (plan.hpMul || 1) * 1.3; plan.bossMul = (plan.bossMul || 1) * 1.3; }
  // 每 10 关换一张地图：换图时把人送回出生点，清掉地上的弹孔和箱子
  const mid = mapForLevel(lv), moved = setMap(mid), M = MAPS[mid];
  if (moved) { P.pos.set(0, 0, 8); P.vel.set(0, 0, 0); clearDecals(); clearHazards(); }
  setWeather(M.weather);
  S.level = lv; S.plan = plan; S.toSpawn = plan.list; S.total = plan.list.length + (plan.boss ? 1 : 0); S.killed = 0; S.between = false; S.spawnT = 1.8;
  S.special = plan.special; S.scoreMul = (plan.special === 'supply' ? 2 : 1) * (D && D.rules.includes('rich') ? 1.5 : 1); setSpecial(plan.special);
  S.dropT = plan.special === 'supply' ? 6 : plan.boss ? 20 : 30;
  S.bossPending = plan.boss; S.bossE = null;
  bgmSet(plan.boss ? (((lv / 5 - 1) % 6) < 3 ? 'boss1' : 'boss2') : plan.special === 'storm' ? 'storm' : 'fight');
  if (plan.boss) { bossIntro(plan.boss, portrait(plan.boss)); S.bossIntroT = 2.8; sfx.roar(); setTimeout(() => say('boss_incoming'), 350); }
  else { banner(moved && lv > 1 ? `LEVEL ${String(lv).padStart(2, '0')} · ${M.en}` : `LEVEL ${String(lv).padStart(2, '0')} · GAME START!`, moved ? 2.6 : 1.8); sfx.jingle(true); }
  if (moved && lv > 1) comic('新地图 · ' + M.name + '!', mid === 'mill' ? '#e8731f' : '#3a7ca5');
  if (plan.special) setTimeout(() => comic(SPECIALS[plan.special] + '!', plan.special === 'supply' ? '#2f8a2f' : '#a8743e'), moved && lv > 1 ? 1500 : 0);
}
function newGame(from, mode) {
  clearShowcase();
  resetStats(); resetCards(); clearEnemies(); clearDecals(); clearHazards(); resetPlayer(); resetWeapons(); resetHud(); resetSkills(); clearElements(); clearElites(); clearRockets(); clearMines();
  S.score = 0; S.over = false; S.running = true; S.streak = []; S.picking = false; S.cardAt = 0; S.cards = []; S.bossesDown = []; S.complete = false; S.endless = false;
  S.combo = 0; S.comboT = 0; S.bestCombo = 0; S.parts = 0; S.banked = 0;
  // 每日挑战：固定从第 1 关开始，种子=日期
  S.daily = mode === 'daily' ? dailyInfo() : null; if (S.daily) dailyTry(S.daily.key);
  for (const id of applyMeta(S)) { S.cards.push(id); seen('card', id); }
  const L = S.daily ? 1 : from || window.__startLevel || 1;
  S.startLevel = L;
  // 跳关：按每两关一张补发卡牌，优先给武器
  if (L > 1) {
    const n = Math.floor((L - 1) / 2);
    for (let i = 0; i < n; i++) { const cs = draw(i * 2 + 2); const c = cs.find(x => x.kind === 'weapon') || cs[(Math.random() * cs.length) | 0]; if (c) { applyCard(c); S.cards.push(c.id); seen('card', c.id); } }
    for (let l = 5; l < L; l += 5) S.bossesDown.push(l);
    setTimeout(() => comic(`补发 ${n} 张卡!`, '#2f8a2f'), 2600);
  }
  startLevel(L);
}
// ---------- 设置 ----------
function applySettings() {
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  setMusicVol(settings.music); setSfxVol(settings.sfx);
  const q = settings.quality;
  DPR = q === 'high' ? Math.min(devicePixelRatio, 1.5) : q === 'mid' ? 1 : 0.75;
  renderer.setPixelRatio(DPR); resize();
  const sh = q !== 'low';
  if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
}
menu.on.apply = applySettings;
function spawnBoss(type) {
  const p = findSpot(P.pos.x, P.pos.z, 16, 26, 3) || findSpot(0, 0, 0, 30, 3) || { x: 0, z: -20 };
  const e = spawn(type, p.x, p.z, S.plan.bossMul || 1); S.bossE = e; S.bossPending = null;
  if (e && S.daily && S.daily.rules.includes('fast')) e.spd = (e.spd || 1) * 1.25;
  shakeK(1); sfx.roar();
}
// 通关：第 30 关 Boss 倒下后
function runComplete() {
  S.complete = true; S.picking = true; bgmSet('title'); say('run_complete');
  if (!window.__bot && document.pointerLockElement) document.exitPointerLock();
  const m = document.createElement('div'); m.id = 'complete'; m.className = 'over'; document.body.appendChild(m);
  m.innerHTML = `<div class="card"><div class="runc">RUN COMPLETE · 全部通关</div><div class="logo" style="font-size:54px">SCRAP RIOT!</div><p class="sub">全部通关 · 30 关 · 6 BOSS</p>
    <p class="tag3">分数 ${S.score} · 卡牌 ${S.cards.length} 张 · 武器 ${W.owned.length} 把</p>
    <button id="endless">无尽模式 ▶</button> <button id="restart" style="background:#333;color:#ddd">重新开始</button></div>`;
  $('endless').onclick = () => { m.remove(); S.picking = false; S.complete = false; S.nextT = 1; canvas.requestPointerLock(); };
  $('restart').onclick = () => { bankParts(S); location.reload(); };
}
window.G.runComplete = runComplete;
// ---------- 档案卡头像：用同一套描边渲染机器人半身像 ----------
const PS = 256, pInk = new InkPass(renderer); pInk.setSize(PS, PS); pInk.mat.uniforms.thick.value = 1.6;
const pRT = new THREE.WebGLRenderTarget(PS, PS); pRT.texture.colorSpace = THREE.SRGBColorSpace;
const pEmpty = new THREE.Scene(), pCache = {};
function portrait(type) {
  if (pCache[type]) return pCache[type];
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff3d6, 0x9a7448, 1.2));
  const l = new THREE.DirectionalLight(0xffffff, 3.2); l.position.set(-2, 3, -3); sc.add(l);
  const T = TYPES[type], rig = (T.build || BUILD[type])(), h = Math.max(T.h, T.boss ? T.r * 2.4 : 0); sc.add(rig.g);
  if (!T.build) animate(rig, 0.4, 0, {});
  if (rig.mound) rig.mound.visible = false;
  if (type === 'maw' || type === 'worm') rig.body.position.y = 0;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 420);
  const hl = type === 'hauler' || T.boss, d = h * (hl ? 2.9 : 2.1);
  cam.position.set(-d * (hl ? 0.62 : 0.45), h * (hl ? 1.35 : 0.75), -d * (hl ? 0.8 : 1)); cam.lookAt(0, h * (type === 'spotter' ? 0.64 : hl ? 0.5 : 0.52), hl ? 0.1 : 0);
  pInk.render(sc, cam, pEmpty, cam, pRT);
  const buf = new Uint8Array(PS * PS * 4); renderer.readRenderTargetPixels(pRT, 0, 0, PS, PS, buf);
  const c = document.createElement('canvas'); c.width = c.height = PS; const g = c.getContext('2d'), img = g.createImageData(PS, PS);
  for (let y = 0; y < PS; y++) img.data.set(buf.subarray((PS - 1 - y) * PS * 4, (PS - y) * PS * 4), y * PS * 4);
  g.putImageData(img, 0, 0);
  return (pCache[type] = c.toDataURL());
}
window.G.portrait = portrait;
// ---------- 选卡 ----------
let pickFn = null;
function openCards() {
  S.picking = true; mouseUp();
  if (!window.__bot && document.pointerLockElement) document.exitPointerLock();
  sfx.card();
  const hand = S.daily ? seeded(S.daily.key * 1000 + S.level + 500, () => draw(S.level)) : draw(S.level); hand.forEach(c => seen('card', c.id));
  pickFn = showCards(S.level, hand, c => {
    const set = applyCard(c); sfx.pick(); pickFn = null; S.cards.push(c.id);
    if (set) { setTimeout(() => { comic(set.name + '!', set.color); banner(`套装激活 · ${set.name} ${set.en}`, 2.4); keyHint('★', set.desc, 7, ''); sfx.setOn(); }, 250); }
    if (c.kind === 'weapon') { banner('NEW WEAPON!', 2.2); comic(c.name + '!'); sfx.boom(); say('new_weapon'); }
    if (c.id === 's_hook') keyHint('E', '长按 E，把自己拉过去', 6);
    if (c.id === 's_dash') keyHint('⇧', '按 Shift 冲刺', 5);
    S.picking = false; S.nextT = 1.6;
    if (!window.__bot) canvas.requestPointerLock();
  });
}
function mouseUp() { dispatchEvent(new MouseEvent('mouseup', { button: 0 })); }
window.G.pickCard = i => pickFn && pickFn(i);
window.G.newGame = newGame; window.G.step = dt => step(dt);

let chainDepth = 0;
hooks.onKill = e => {
  // 连杀：4 秒内接着杀就累计，评级越高分数倍率越高
  if (!e.noScore) { const r0 = rankOf(S.combo); S.combo++; S.comboT = 4; S.bestCombo = Math.max(S.bestCombo || 0, S.combo); const r1 = rankOf(S.combo); if (r1 > r0 && r1 >= 3) { sfx.pick(); if (r1 >= 4) comic(RANKS[r1][1] + ' RANK!', RANKS[r1][2]); } }
  S.killed++; if (!e.noScore) S.score += Math.round(e.t.score * (e.scoreMul || 1) * (S.scoreMul || 1) * (1 + rankOf(S.combo) * 0.1)); sfx.kill(e.type === 'hauler' || e.t.boss); hitMarker('kill');
  if (e.t.boss) bossDown(e);
  // 顿帧：爆头击杀、Boss 倒下时画面停一下；掉零件
  S.hitstop = Math.max(S.hitstop || 0, e.t.boss ? 0.3 : e.lastHead ? 0.07 : e.type === 'hauler' ? 0.06 : 0.025);
  if (!e.noScore) scrap(new THREE.Vector3(e.pos.x, e.pos.y + 0.8, e.pos.z), e.t.boss ? 30 : e.type === 'hauler' ? 8 : e.type === 'drone' ? 1 : 3);
  if (!e.noScore) S.parts += partsFor(e) * (S.partsMul || 1);
  if (mods.lifesteal) P.hp = Math.min(P.maxHp, P.hp + mods.lifesteal);
  if (S.daily && S.daily.rules.includes('noheal')) P.hp = Math.min(P.maxHp, P.hp + 3);
  if (mods.armorSteal) P.armor = Math.min(P.maxArmor, P.armor + mods.armorSteal);
  if (mods.chain && chainDepth < 3) {
    const c = new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z);
    chainDepth++; boom(c, 4, mods.chain, e); chainDepth--;
  }
  onElemKill(e); onEliteKill(e);
  S.streak.push(S.time); S.streak = S.streak.filter(t => S.time - t < 2.5);
  if (S.streak.length === 3) { comic('RAMPAGE!'); sfx.boom(); S.score += 300; say('rampage', { droppable: true }); }
  else if (S.streak.length === 5) { comic('UNSTOPPABLE!', '#3a7ca5'); sfx.boom(); S.score += 600; say('unstoppable', { droppable: true }); }
};
playerHooks.onHurt = (n, from) => { if (n >= 8 && S.combo) { S.combo = Math.floor(S.combo / 2); S.comboT = Math.min(S.comboT, 2); } S.hurtFx = Math.min(1, S.hurtFx + 0.5 + n / 40); S.shake = Math.max(S.shake, 0.5); sfx.hurt(); hurtFrom(from); };
hooks.onSpawn = e => { dossier(e.type, portrait(e.type)); sfx.spawn(); seen('foe', e.type); };
hooks.onLaser = () => sfx.laser();
hooks.onShot = () => sfx.laserShot();
wHooks.onCharge = c => sfx.charge(c);
rHooks.hit = h => { if (h === 3) sfx.clang(); else sfx.hit(h === 2); hitMarker(h); };
wHooks.onFire = (k, hit) => { sfx.shot(k); if (hit === 3) sfx.clang(); else if (hit) sfx.hit(hit === 2); if (hit) hitMarker(hit); };
wHooks.onReload = (k, t) => sfx.reload(t);
SK.on.fire = () => sfx.hookFire();
SK.on.latch = () => sfx.latch();
SK.on.grab = e => { sfx.latch(); popText('过来!', new THREE.Vector3(e.pos.x, e.pos.y + e.t.h + 0.3, e.pos.z), 'ko'); };
SK.on.dash = () => { sfx.dash(); S.shake = Math.max(S.shake, 0.3); };
wHooks.onSwitch = () => sfx.swap();
const shakeK = k => { S.shake = Math.max(S.shake, k); };
bossHooks.sfx = n => sfx[n] ? sfx[n]() : n === 'slam' ? sfx.boom() : n === 'laser' ? sfx.laser() : 0;
bossHooks.shake = shakeK;
bossHooks.phase = e => { comic(e.phase === 2 ? 'ENRAGED!' : 'PHASE ' + (e.phase + 1) + '!', '#7a1010'); sfx.roar(); shakeK(1); };
hz.on.blind = () => sandBlind();
hz.on.pickup = k => { sfx.pick(); popText(k === 'hp' ? '+35 HP' : '+35 护甲', new THREE.Vector3(P.pos.x, P.pos.y + 2, P.pos.z - 1), 'ko'); };
hz.on.boom = r => shakeK(Math.min(1, r * 0.2));
hz.on.scrap = () => { S.score += 10; S.scrap = (S.scrap || 0) + 1; sfx.tink(); };
function bossDown(e) {
  S.bossesDown.push(S.level); S.score += 2000;
  comic('BOSS DOWN!', '#e8431f'); sfx.bossDown(); shakeK(1.5); setTimeout(() => say('boss_down'), 250);
  setTimeout(() => { if (!S.complete && !S.over) bgmSet('fight'); }, 2600);
  // 小弟全部跟着爆掉，掉一堆补给
  setTimeout(() => { for (const m of [...enemies]) if (!m.dead) { m.noScore = true; m.hp = 0; blast(m.pos, 0.1, 999); } }, 400);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; dropCrate(e.pos.x + Math.cos(a) * 3, e.pos.z + Math.sin(a) * 3, i ? 'ar' : 'hp'); }
  for (let i = 0; i < 6; i++) setTimeout(() => flashStar(e.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 4, 1 + Math.random() * 3, (Math.random() - .5) * 4)), 2), i * 120);
}

function spawnOne() {
  const type = S.toSpawn.shift();
  const p = findSpot(P.pos.x, P.pos.z, 18, 36) || findSpot(P.pos.x, P.pos.z, 10, 60) || { x: 0, z: -14 };
  const e = spawn(type, p.x, p.z, S.plan.hpMul), R = S.daily ? S.daily.rules : [];
  const ch = R.includes('elite') ? Math.max(0.12, eliteChance(S.level)) * 2 : eliteChance(S.level);
  if (e && ELITE_TYPES.includes(type) && Math.random() < ch) makeElite(e);
  if (e && R.includes('fast')) e.spd = (e.spd || 1) * 1.25;
}
// 元素/精英的音效和震屏
el.on.ignite = () => sfx.ignite(); el.on.zap = () => sfx.zap(); el.on.boom = () => sfx.boom(); el.on.shake = k => shakeK(k);
eliteHooks.on.sfx = n => sfx[n] && sfx[n]();
eliteHooks.on.shake = k => shakeK(k);
eliteHooks.on.summon = () => { S.total++; };
c2Hooks.spawned = () => { S.total++; };
c2Hooks.sfx = n => sfx[n] && sfx[n]();
c2Hooks.shake = k => shakeK(k);
let firstQ = 0; // 第一次见到某个词条：漫画字+提示，多个同时出现就排队
eliteHooks.on.first = a => { const A = AFFIX[a], now = performance.now(), at = Math.max(now + 700, firstQ); firstQ = at + 2600; setTimeout(() => { if (!S.running) return; comic('精英 · ' + A.name + '!', A.css); keyHint('!', A.tip, 4, ''); }, at - now); };
window.G.makeElite = makeElite;

// ---------- 输入 ----------
// 菜单动作：开始（可选起始关）、继续、回主菜单
let pendingStart = 0, pendingMode = null;
menu.portrait = t => portrait(t);
menu.on.start = (lv, mode) => { initAudio(); applySettings(); pendingStart = lv; pendingMode = mode || null; S.running = false; canvas.requestPointerLock(); };
menu.on.resume = () => { initAudio(); canvas.requestPointerLock(); };
menu.on.quit = () => toMain();
function toMain() {
  if (S.running || S.over) bankParts(S);
  S.running = false; S.over = false; S.picking = false; clearEnemies(); clearHazards(); clearElements(); clearElites(); clearRockets(); clearMines(); setMap('yard'); setWeather(null); setSpecial(null);
  $('hud').style.display = 'none'; const c = $('complete'); if (c) c.remove();
  P.pos.set(0, 0, 8); bgmSet('title'); buildShowcase(); showMenu('main');
}
function gameOver() {
  const prev = save.best; record(S.score); say('game_over'); const got = bankParts(S);
  let info = `撑到第 <b>${S.level}</b> 关 · <b>${S.score}</b> 分 · 最高连杀 <b>${S.bestCombo || 0}</b>`;
  if (S.daily) {
    // 每日挑战：和今天之前的自己比
    const r = dailyRecord(S.daily.key, S.score, S.level);
    info = `<span class="dy-tag">每日挑战 ${keyText(S.daily.key)}</span><br>` + info + (r.isBest ? (r.prevBest ? ` · <b>刷新今日最佳!</b>（原 ${r.prevBest}）` : ' · <b>今日首个成绩</b>') : ` · 今日最佳 <b>${r.rec.best}</b>`) + ` · 第 <b>${r.rec.tries}</b> 次`;
  } else info += S.score > prev ? ' · <b>新纪录!</b>' : ` · 最高分 <b>${save.best}</b>`;
  info += `<br><span class="gr-earn">⚙ 带出零件 <b>+${got}</b> · 车库共 <b>${save.parts}</b></span>`;
  showMenu('over', info);
  menu.lastStart = S.startLevel; menu.lastMode = S.daily ? 'daily' : null; bgmSet('title');
}
// 第一次点击页面就开声音，主菜单放标题曲
addEventListener('pointerdown', () => { initAudio(); setSfxVol(settings.sfx); if (!S.running) bgmSet('title'); });
initInput(canvas, locked => {
  $('hud').style.display = locked || S.running ? 'block' : 'none';
  if (locked) { hideMenu(); if (pendingStart) { const L = pendingStart; pendingStart = 0; newGame(L, pendingMode); } return; }
  if (S.picking || S.complete) return;
  if (S.over) { S.running = false; gameOver(); return; }
  if (S.running) showMenu('pause');
});
addEventListener('keydown', e => {
  const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6 }[e.code];
  if (n !== undefined && W.owned[n] && !S.picking) switchTo(W.owned[n]);
});
addEventListener('keydown', e => { if (e.code === 'KeyM') keyHint('M', bgmToggleMute() ? '音乐已关' : '音乐已开', 1.5, ''); });
window.G.bgm = bgmInfo;
addEventListener('wheel', e => {
  if (document.pointerLockElement !== canvas || W.owned.length < 2) return;
  const i = W.owned.indexOf(W.cur), n = W.owned.length;
  switchTo(W.owned[(i + (e.deltaY > 0 ? 1 : n - 1)) % n]);
});

// ---------- 主循环 ----------
let last = performance.now(), stepT = 0;
const ev = { hit: 0, kill: 0, shake: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let sdt = dt;
  if (S.hitstop > 0) { S.hitstop -= dt; sdt = dt * 0.05; }
  if (!window.__freeze && ((S.running && document.pointerLockElement === canvas) || window.__bot)) step(sdt);
  bgmUpdate(dt, S.picking || S.over || (S.running && !window.__bot && document.pointerLockElement !== canvas) ? 1 : 0);
  render(dt);
}
function step(dt) {
  S.time += dt;
  if (S.combo && (S.comboT -= dt) <= 0) S.combo = 0;
  const wasAir = !P.onGround;
  updateSkills(dt);
  updatePlayer(dt);
  if (wasAir && P.onGround) { S.shake = Math.max(S.shake, 0.15); sfx.step(); }
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround && sp > 3) { stepT += dt * sp; if (stepT > 2.6) { stepT = 0; sfx.step(); } }
  ev.hit = 0; ev.kill = 0; ev.shake = 0; updateWeapons(dt, ev);
  if (ev.shake) S.shake = Math.max(S.shake, ev.shake);
  updateEnemies(dt, S.time); updateFx(dt); updateHazards(dt, S.time); updateSpecials(dt); updateElements(dt); updateElites(dt, S); updateRockets(dt); updateMines(dt); updateWeather(dt, camera);
  // Boss 登场
  if (S.bossPending && !S.between) { S.bossIntroT -= dt; if (S.bossIntroT <= 0) spawnBoss(S.bossPending); }
  // 补给空投
  if (!S.between && (S.dropT -= dt) <= 0) { S.dropT = S.special === 'supply' ? 9 : S.plan.boss ? 22 : 32; dropCrate(); sfx.hatch(); }
  if (S.toSpawn.length && !S.between) {
    S.spawnT -= dt;
    const cap = Math.min(8 + S.level, 18);
    if (S.spawnT <= 0 && enemies.length < cap) { spawnOne(); S.spawnT = Math.max(0.5, 2.0 - S.level * 0.05); }
  }
  if (!S.between && !S.toSpawn.length && !enemies.length && !S.bossPending && S.running) {
    S.between = true; S.nextT = 3.2; clearMines(); banner('STAGE CLEAR!', 2.4); sfx.jingle(true); setTimeout(() => say('stage_clear'), 300);
    if (!(S.daily && S.daily.rules.includes('noheal'))) { P.armor = Math.min(P.maxArmor, P.armor + 20); P.hp = Math.min(P.maxHp, P.hp + 15 + (S.healBonus || 0)); }
    S.parts += Math.ceil(S.level / 3) * (S.partsMul || 1); bankParts(S);
    setSpecial(null);
    if (S.level === LAST && !S.endless) { S.endless = true; S.cardAt = 0; setTimeout(runComplete, 2200); }
    else if (S.level % 2 === 0 || (S.daily && S.daily.rules.includes('cards'))) S.cardAt = 1.4; // 每过两关选一张卡
  }
  if (S.cardAt > 0 && (S.cardAt -= dt) <= 0) openCards();
  if (S.between && !S.picking && !(S.cardAt > 0)) { S.nextT -= dt; if (S.nextT <= 0) startLevel(S.level + 1); }
  if (P.hp <= 0 && !S.over && S.revive > 0) { S.revive--; P.hp = Math.ceil(P.maxHp / 2); P.armor = P.maxArmor; comic('备用核心启动!', '#2f8a2f'); banner('REVIVED!', 1.6); sfx.setOn(); S.shake = 1; for (const m of enemies) if (!m.dead && !m.t.heavy && m.pos.distanceTo(P.pos) < 7) { const d = new THREE.Vector3(m.pos.x - P.pos.x, 0, m.pos.z - P.pos.z).normalize(); m.kb = (m.kb || new THREE.Vector3()).addScaledVector(d, 16); } }
  if (P.hp <= 0 && !S.over) { S.over = true; document.exitPointerLock && document.exitPointerLock(); }
  updateVM(dt, { moving: sp > 1 && P.onGround, air: !P.onGround, lookDX: P.lookDX / Math.max(dt, 0.008) * 0.016, lookDY: P.lookDY / Math.max(dt, 0.008) * 0.016, reload: reloadProgress() });
  P.lookDX = P.lookDY = 0;
  updateHud(dt, S, ev);
}
// ---------- 主菜单背景：场景里站着几只机器人，镜头慢慢摇 ----------
const SHOW = new THREE.Group(); scene.add(SHOW); let showRigs = [], menuT = 0;
const emptyVM = new THREE.Scene();
function buildShowcase() {
  clearShowcase();
  for (const [type, x, z, ry] of [['butcher', 15, -5.5, 0.15], ['hauler', 18.6, -2, -0.4], ['grunt', 12.6, -0.4, 0.25], ['spotter', 16, 0.6, -0.1], ['grunt', 11, -3.4, 0.55]]) {
    const T = TYPES[type], rig = (T.build || BUILD[type])();
    rig.g.position.set(x, 0, z); rig.g.rotation.y = Math.PI + ry; rig.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    SHOW.add(rig.g); showRigs.push({ rig, ph: Math.random() * 6, T });
  }
}
function clearShowcase() { showRigs.forEach(s => SHOW.remove(s.rig.g)); showRigs = []; }
function menuCamera(dt) {
  menuT += dt;
  const a = 0.22 + Math.sin(menuT * 0.12) * 0.3, R = 8.6;
  camera.position.set(15 + Math.sin(a) * R, 2.4 + Math.sin(menuT * 0.2) * 0.4, -1.8 + Math.cos(a) * R);
  camera.lookAt(11.8 + Math.sin(a) * 1.5, 2.1, -2.2);
  for (const s of showRigs) {
    if (!s.T.build) animate(s.rig, menuT * 2 + s.ph, 0, {});
    if (s.rig.saws) s.rig.saws.forEach(w => w.rotation.y += dt * 4);
    if (s.rig.body) s.rig.body.position.y = Math.abs(Math.sin(menuT * 1.6 + s.ph)) * 0.05;
    if (s.rig.head) s.rig.head.rotation.y = Math.sin(menuT * 0.7 + s.ph) * 0.3;
  }
}
function render(dt) {
  if (!S.running && !window.__bot) {
    menuCamera(dt); updateFx(dt);
    if (skyMesh) skyMesh.position.copy(camera.position);
    ink.mat.uniforms.hurt.value = 0; ink.render(scene, camera, emptyVM, vmCam); return;
  }
  camera.rotation.order = 'YXZ';
  eyePos(camera.position);
  const sp = P.onGround ? Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 9) : 0;
  camera.position.y += Math.sin(S.time * 10) * 0.035 * sp;
  S.shake *= Math.exp(-10 * dt); S.hurtFx *= Math.exp(-3 * dt);
  const sh = S.shake * 0.03;
  camera.rotation.set(P.pitch + P.kick + (Math.random() - .5) * sh, P.yaw + (Math.random() - .5) * sh, (Math.random() - .5) * sh * 0.5);
  if (skyMesh) skyMesh.position.copy(camera.position);
  ink.mat.uniforms.hurt.value = Math.min(0.8, S.hurtFx);
  ink.render(scene, camera, vmScene, vmCam);
}
// 开发用：按指定尺寸渲染一帧并存盘 _shots/name.png
window.G.shot = async (name, w = 1280, h = 800) => {
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); ink.setSize(w, h);
  camera.aspect = vmCam.aspect = w / h; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
  render(0); const url = canvas.toDataURL('image/png');
  renderer.setPixelRatio(DPR); resize();
  await fetch('/__shot?name=' + name, { method: 'POST', body: url }); return 'saved';
};
window.G.bankParts = () => bankParts(S); window.G.save = save;
window.G.render = render; window.G.renderer = renderer; window.G.toMain = toMain;
applySettings(); buildShowcase(); showMenu('main');
requestAnimationFrame(frame);
