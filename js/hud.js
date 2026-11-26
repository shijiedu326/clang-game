import { P } from './player.js';
import { W, DEFS, magSize, reloadProgress } from './weapons.js';
import { enemies, TYPES } from './enemies.js';
import { skills } from './stats.js';
import { SK } from './skills.js';
import { difficulty, SPECIALS, LAST } from './levels.js';
// Boss 登场横幅
let introT = 0;
export function bossIntro(type, img) {
  const t = TYPES[type], el = $('bossintro');
  el.innerHTML = `<div class="rib"><div class="tg">BOSS</div><img src="${img}"><div class="tx"><b>${t.name}</b><i>${t.en}</i><span>${t.sub || ''}</span></div></div>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); introT = 2.8;
}
let blindT = 0;
export function sandBlind() { $('sandblind').classList.add('on'); blindT = 2.2; }
let lastTrack = '';
// 连杀评级：D C B A S SS SSS
export const RANKS = [[0, 'D', '#9a9a9a'], [3, 'C', '#7fd36b'], [6, 'B', '#3ac1ff'], [10, 'A', '#f5c518'], [16, 'S', '#ff8a1f'], [25, 'SS', '#ff4a2a'], [40, 'SSS', '#ff4ad8']];
export function rankOf(c) { let r = 0; RANKS.forEach((x, i) => { if (c >= x[0]) r = i; }); return r; }
let lastRank = -1;
function comboHud(S) {
  const el = $('combo'), r = rankOf(S.combo || 0), rk = el.querySelector('.rk');
  el.classList.toggle('on', (S.combo || 0) > 0);
  if (r !== lastRank) { rk.textContent = RANKS[r][1]; rk.style.color = RANKS[r][2]; rk.style.fontSize = RANKS[r][1].length > 2 ? '32px' : RANKS[r][1].length > 1 ? '40px' : '52px'; if (r > lastRank && lastRank >= 0) { rk.classList.remove('pop'); void rk.offsetWidth; rk.classList.add('pop'); } lastRank = r; }
  el.querySelector('.cn').textContent = S.combo || 0;
  el.querySelector('.clv').textContent = Math.min(9, Math.floor((S.combo || 0) / 5) + 1);
  el.querySelector('.mul').textContent = (1 + r * 0.1).toFixed(1);
  el.querySelector('u').style.width = Math.max(0, (S.comboT || 0) / 4 * 100) + '%';
}
let buffFn = () => [];
export function setBuffSource(fn) { buffFn = fn; }
let lastBuff = '';
let hintT = 0;
export function keyHint(key, text, sec = 5, lab = "HOLD") { const h = $("hint"); h.innerHTML = `<span class="kc">${key}</span>${lab ? `<b>${lab}</b>` : ""}<span>${text}</span>`; h.classList.add('on'); hintT = sec; }

const $ = id => document.getElementById(id);
export const ICON = {
  pistol: 'M6 7h44v9H26l-3 14H11l3-14H6z',
  smg: 'M2 8h52v9h-8v4h-6l-2 9h-8l2-9H22l-2 7H9l1-7H2z',
  shotgun: 'M0 9h64v5H34v4H22l-7 10H3l8-11H0z',
  dual: 'M2 5h26v6H16l-2 9H7l2-9H2zM34 13h26v6H48l-2 9h-7l2-9h-7z',
};
const svg = k => `<svg viewBox="0 0 66 32"><path d="${ICON[k]}"/></svg>`;

let lastSlots = '', lastMag = '', lastHp = -1, slotsInit = false;
const hpN = 10;
export function initHud() {
  $('hpcells').innerHTML = '<i></i>'.repeat(hpN);
}
const seen = new Set();
export function resetHud() { seen.clear(); }

// 敌人首次出现弹档案卡
let dossT = 0;
export function dossier(type, img) {
  if (seen.has(type)) return; seen.add(type);
  const t = TYPES[type]; const blk = n => '■'.repeat(n) + '□'.repeat(5 - n);
  $('dossier').innerHTML = `<div class="hd"><span>目标档案 #${String(t.no).padStart(2, '0')}</span><em>THREAT</em></div>
    ${img ? `<div class="pt"><img src="${img}"><i>${t.en}</i></div>` : ''}
    <div class="nm"><b>${t.name}</b><span>${t.en}</span></div>
    <table><tr><td>攻击</td><td>${t.atk}</td></tr>${t.armor ? `<tr><td>正面</td><td>${t.armor}</td></tr>` : ''}
    <tr><td>弱点</td><td>${t.weak}</td></tr><tr><td>血量</td><td class="blk">${blk(Math.min(5, Math.ceil(t.hp / 30)))}</td></tr></table>`;
  $('dossier').classList.add('on'); dossT = 4.5;
}
let comicT = 0;
export function comic(text, color) {
  const c = $('comic'); c.firstChild.textContent = text; c.firstChild.style.background = color || '';
  c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
}
let bannerT = 0;
export function banner(text, sec = 1.8) { $('bannertxt').textContent = text; $('banner').classList.add('on'); bannerT = sec; }
let hitT = 0;
export function hitMarker(kind) { const h = $('hitm'); h.className = 'on ' + (kind === 3 ? 'armor' : kind === 'kill' ? 'kill' : ''); hitT = kind === 'kill' ? 0.25 : 0.1; }
let hurtT = 0;
export function hurtFrom(src) {
  if (!src) return;
  const a = Math.atan2(src.x - P.pos.x, src.z - P.pos.z); // 世界角
  const rel = -(a - Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)));
  const el = $('hurtdir'); el.style.transform = `rotate(${rel}rad)`; el.classList.add('on'); hurtT = 0.1;
}

// 雷达
const rc = $('radar').getContext('2d');
function radar(t) {
  const W2 = 200, c = W2 / 2, R = 92, range = 40;
  rc.clearRect(0, 0, W2, W2);
  rc.fillStyle = 'rgba(28,26,24,.9)'; rc.beginPath(); rc.arc(c, c, R, 0, 7); rc.fill();
  rc.lineWidth = 5; rc.strokeStyle = '#000'; rc.stroke(); rc.lineWidth = 2.5; rc.strokeStyle = '#c99a10'; rc.beginPath(); rc.arc(c, c, R - 3, 0, 7); rc.stroke();
  rc.strokeStyle = 'rgba(255,255,255,.18)'; rc.lineWidth = 1.5;
  for (const r of [R * .33, R * .66]) { rc.beginPath(); rc.arc(c, c, r, 0, 7); rc.stroke(); }
  rc.beginPath(); rc.moveTo(c - R, c); rc.lineTo(c + R, c); rc.moveTo(c, c - R); rc.lineTo(c, c + R); rc.stroke();
  const g = rc.createRadialGradient(c, c, 0, c, c, R); g.addColorStop(0, 'rgba(245,197,24,.55)'); g.addColorStop(1, 'rgba(245,197,24,0)');
  rc.fillStyle = g; rc.beginPath(); rc.moveTo(c, c); rc.arc(c, c, R - 4, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); rc.fill();
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  for (const e of enemies) {
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
    let x = dx * cy - dz * sy, y = dx * sy + dz * cy;
    const d = Math.hypot(x, y), k = (R - 10) / range;
    let px = x * k, py = y * k; if (d > range) { px = x / d * (R - 10); py = y / d * (R - 10); }
    if (e.invuln && !e.t.boss) continue;
    rc.fillStyle = e.t.boss ? '#b01e8a' : e.type === 'hauler' ? '#ffb000' : '#ff3b2f'; rc.strokeStyle = '#000'; rc.lineWidth = 2;
    rc.beginPath(); rc.arc(c + px, c + py, e.t.boss ? 10 : e.type === 'hauler' ? 7 : 5, 0, 7); rc.fill(); rc.stroke();
    if (e.lock > 0 && Math.floor(t * 12) % 2) { rc.strokeStyle = '#ff3b2f'; rc.beginPath(); rc.arc(c + px, c + py, 10, 0, 7); rc.stroke(); }
  }
  rc.fillStyle = '#f5c518'; rc.strokeStyle = '#000'; rc.lineWidth = 2;
  rc.beginPath(); rc.moveTo(c, c - 11); rc.lineTo(c + 8, c + 7); rc.lineTo(c, c + 3); rc.lineTo(c - 8, c + 7); rc.closePath(); rc.fill(); rc.stroke();
}

let fpsAcc = 0, fpsN = 0, fpsT = 0;
export function updateHud(dt, S, ev) {
  // 计时器
  if (dossT > 0 && (dossT -= dt) <= 0) $('dossier').classList.remove('on');
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('on');
  if (hitT > 0 && (hitT -= dt) <= 0) $('hitm').className = '';
  if (hurtT > 0 && (hurtT -= dt) <= 0) $('hurtdir').classList.remove('on');
  fpsAcc += dt; fpsN++; if ((fpsT += dt) > 0.5) { $('fps').firstChild.textContent = Math.round(fpsN / fpsAcc); fpsAcc = fpsN = fpsT = 0; }
  // 顶条
  comboHud(S);
  $('lvl').textContent = S.level; $('left').textContent = S.toSpawn.length + enemies.length + (S.bossPending ? 1 : 0); $('score').textContent = S.score;
  $('topbar').querySelector('.tag').textContent = difficulty(S.level);
  const sp = $('special'); const stxt = S.plan && S.plan.boss ? '★ BOSS 战' : S.special ? '特殊关卡 · ' + SPECIALS[S.special] : '';
  sp.hidden = !stxt; if (stxt && sp.textContent !== stxt) sp.textContent = stxt;
  // Boss 进度条：5 10 15 20 25 30
  const base = Math.floor((S.level - 1) / LAST) * LAST, tk = base + '|' + (S.bossesDown || []).join() + '|' + S.level;
  if (tk !== lastTrack) {
    lastTrack = tk;
    $('btrack').innerHTML = '<b>BOSS</b>' + [5, 10, 15, 20, 25, 30].map(n => { const L = base + n; const done = (S.bossesDown || []).includes(L); const cur = !done && S.level <= L && S.level > L - 5; return `<i class="${done ? 'done' : cur ? 'cur' : ''}">${L}</i>`; }).join('');
  }
  // Boss 血条
  const be = S.bossE, bb = $('bossbar');
  if (be && !be.dead) {
    bb.classList.add('on'); bb.querySelector('b').textContent = be.t.name + '  ' + be.t.en;
    bb.querySelector('.f').style.width = Math.max(0, be.hp / be.maxHp * 100) + '%';
    bb.querySelector('em').textContent = be.invuln ? '钻地中' : be.exposed ? '弱点暴露!' : be.phase ? '阶段 ' + (be.phase + 1) : '';
  } else bb.classList.remove('on');
  if (introT > 0 && (introT -= dt) <= 0) $('bossintro').classList.remove('on');
  if (blindT > 0) { blindT -= dt; $('sandblind').style.opacity = Math.min(1, blindT / 1.2); if (blindT <= 0) $('sandblind').classList.remove('on'); }
  // 护甲 / 血
  $('arbar').style.width = (P.armor / P.maxArmor * 100) + '%'; $('artxt').textContent = Math.ceil(P.armor);
  const hpk = Math.max(0, P.hp) / P.maxHp, cells = Math.ceil(hpk * hpN);
  if (cells !== lastHp) { lastHp = cells; [...$('hpcells').children].forEach((c, i) => c.className = i < cells ? (hpk < 0.3 ? 'low' : '') : 'off'); }
  // 弹药
  const m = W.ammo[W.cur], ms = magSize(W.cur), key = W.cur + m + '/' + ms;
  if (key !== lastMag) {
    lastMag = key; $('mag').textContent = m; $('mag').classList.toggle('low', m <= ms * 0.25);
    $('wname').textContent = DEFS[W.cur].name;
    const mc = $('magcells'); mc.classList.toggle('many', ms > 20);
    mc.innerHTML = Array.from({ length: ms }, (_, i) => `<i${i < m ? '' : ' class="off"'}></i>`).join('');
  }
  const rp = reloadProgress(); $('reload').style.display = rp >= 0 ? 'block' : 'none'; if (rp >= 0) $('reload').firstChild.style.setProperty('--p', (rp * 100) + '%');
  // 武器栏
  const sk = W.owned.join() + W.cur;
  if (sk !== lastSlots) {
    lastSlots = sk;
    $('slots').innerHTML = W.owned.map((k, i) => `<div class="slot${k === W.cur ? ' on' : ''}"><span class="n">${i + 1}</span>${svg(DEFS[k].icon)}<span class="t">${DEFS[k].name}</span></div>`).join('');
  }
  // 准星扩散
  const spread = 7 + (W.bloom + DEFS[W.cur].spread) * 420 + (P.onGround ? 0 : 6) + Math.min(6, Math.hypot(P.vel.x, P.vel.z) * 0.5);
  $('cross').style.setProperty('--s', spread.toFixed(1) + 'px');
  $('speed').classList.toggle('on', !!P.hook || P.dashT > 0);
  if (hintT > 0 && (hintT -= dt) <= 0) $('hint').classList.remove('on');
  // 技能 + 增益栏
  const chips = [];
  if (skills.hook) chips.push(`<span class="key${SK.hookCd > 0 ? ' cool' : ''}" style="--c:${(SK.hookCd / SK.hookMax * 100).toFixed(0)}%">E</span><span class="buff sk">勾锁</span>`);
  if (skills.dash) chips.push(`<span class="key${SK.dashCd > 0 ? ' cool' : ''}" style="--c:${(SK.dashCd / SK.dashMax * 100).toFixed(0)}%">⇧</span><span class="buff sk">冲刺</span>`);
  for (const b of buffFn()) chips.push(typeof b === 'string' ? `<span class="buff">${b}</span>` : `<span class="buff ${b.cls}">${b.html}</span>`);
  const bh = chips.length ? chips.join('') : '<span class="buff off">暂无增益</span>';
  if (bh !== lastBuff) { lastBuff = bh; $('buffs').innerHTML = bh; }
  radar(S.time);
}
