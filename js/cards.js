import { mods, skills } from './stats.js';
import { P } from './player.js';
import { W, giveWeapon, refillAll } from './weapons.js';
import { ICON } from './hud.js';

// 卡牌池。kind: weapon 新武器 / mod 改装（可带负面）/ skill 技能
// rarity: 1 普通(绿) 2 稀有(蓝) 3 史诗(橙)
const pct = v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
export const POOL = [
  // ---- 武器 ----
  { id: 'w_smg', kind: 'weapon', rarity: 1, name: '冲锋枪', en: 'BUZZ-SMG', icon: 'smg', desc: '全自动，射速 13 发/秒，弹匣 32。', stats: [['射速', '高', 1], ['单发伤害', '低', 0]], ok: () => !W.owned.includes('smg'), apply: () => giveWeapon('smg') },
  { id: 'w_shotgun', kind: 'weapon', rarity: 2, name: '霰弹枪', en: 'BOOM-STICK', icon: 'shotgun', desc: '近距离一枪轰飞，8 颗弹丸。', stats: [['近战', '爆炸', 1], ['换弹', '慢', 0]], ok: () => !W.owned.includes('shotgun'), apply: () => giveWeapon('shotgun') },
  { id: 'w_dual', kind: 'weapon', rarity: 3, name: '双持手枪', en: 'TWIN RATTLERS', icon: 'dual', desc: '两把一起打，600 RPM，左右交替开火。', stats: [['射速', '600 RPM', 1], ['散布', '+', 0]], ok: () => !W.owned.includes('dual') && W.owned.length >= 2, apply: () => giveWeapon('dual') },
  // ---- 技能 ----
  { id: 's_hook', kind: 'skill', rarity: 2, name: '勾锁', en: 'GRAPPLE', glyph: '⚓', desc: '长按 E 把自己拉过去；勾中小怪会把它直接拽到你面前。', stats: [['冷却', '2.5 秒', 1]], ok: () => !skills.hook, apply: () => { skills.hook = 1; } },
  { id: 's_dash', kind: 'skill', rarity: 2, name: '推进器', en: 'JET DASH', glyph: '➤', desc: '按 Shift 向移动方向冲刺一段。', stats: [['冷却', '2.2 秒', 1]], ok: () => !skills.dash, apply: () => { skills.dash = 1; } },
  { id: 's_chain', kind: 'skill', rarity: 3, name: '连锁爆破', en: 'CHAIN BLAST', glyph: '✹', desc: '敌人被击杀时爆炸，伤害周围 4 米内的敌人。', stats: [['爆炸伤害', '35', 1]], ok: () => !mods.chain, apply: () => { mods.chain = 35; } },
  // ---- 改装（纯增益）----
  { id: 'm_dmg', kind: 'mod', rarity: 1, name: '火力校准', en: 'CALIBRATED', glyph: '✚', desc: '所有武器伤害提高。', stats: [['伤害', pct(0.2), 1]], apply: () => { mods.dmg *= 1.2; } },
  { id: 'm_rate', kind: 'mod', rarity: 1, name: '轻量扳机', en: 'HAIR TRIGGER', glyph: '⚡', desc: '射速提高，后坐散布也跟着变大。', stats: [['射速', pct(0.25), 1], ['散布', pct(0.2), 0]], apply: () => { mods.rate *= 1.25; mods.spread *= 1.2; } },
  { id: 'm_mag', kind: 'mod', rarity: 1, name: '扩容弹匣', en: 'FAT MAG', glyph: '▤', desc: '弹匣变大，但换弹更慢。', stats: [['弹匣', pct(0.5), 1], ['换弹时间', pct(0.15), 0]], apply: () => { mods.mag *= 1.5; mods.reload *= 1.15; refillAll(); } },
  { id: 'm_reload', kind: 'mod', rarity: 1, name: '快手', en: 'QUICK HANDS', glyph: '↻', desc: '换弹速度大幅提高。', stats: [['换弹时间', pct(-0.35), 1]], apply: () => { mods.reload *= 0.65; } },
  { id: 'm_spread', kind: 'mod', rarity: 1, name: '稳定器', en: 'STABILIZER', glyph: '◎', desc: '弹道更集中。', stats: [['散布', pct(-0.4), 1]], apply: () => { mods.spread *= 0.6; } },
  { id: 'm_head', kind: 'mod', rarity: 2, name: '光学瞄具', en: 'HEAD HUNTER', glyph: '⌖', desc: '爆头伤害倍率提高。', stats: [['爆头倍率', '×2 → ×' + '2.6', 1]], apply: () => { mods.headMul += 0.6; } },
  { id: 'm_ap', kind: 'mod', rarity: 2, name: '穿甲弹头', en: 'AP ROUNDS', glyph: '➶', desc: '打重装机正面装甲也能造成像样的伤害。', stats: [['对装甲', '×3', 1]], ok: () => mods.armorK < 0.5, apply: () => { mods.armorK = Math.min(0.6, mods.armorK * 3); } },
  { id: 'm_pellet', kind: 'mod', rarity: 2, name: '散射改装', en: 'SCATTER KIT', glyph: '⁂', desc: '霰弹枪每发多 3 颗弹丸。', stats: [['弹丸', '+3', 1]], ok: () => W.owned.includes('shotgun'), apply: () => { mods.pellets += 3; } },
  { id: 'm_speed', kind: 'mod', rarity: 1, name: '跑鞋', en: 'SNEAKERS', glyph: '»', desc: '移动更快。', stats: [['移速', pct(0.15), 1]], apply: () => { P.speed *= 1.15; } },
  { id: 'm_jump', kind: 'mod', rarity: 1, name: '弹簧靴', en: 'SPRING BOOTS', glyph: '⇑', desc: '跳得更高，可以直接跳上集装箱。', stats: [['跳跃', pct(0.35), 1]], ok: () => P.jump < 12, apply: () => { P.jump *= 1.35; } },
  { id: 'm_armor', kind: 'mod', rarity: 1, name: '加厚钢板', en: 'PLATED', glyph: '⛨', desc: '护甲上限提高并回满。', stats: [['护甲上限', '+25', 1]], apply: () => { P.maxArmor += 25; P.armor = P.maxArmor; } },
  { id: 'm_hp', kind: 'mod', rarity: 1, name: '备用电池', en: 'SPARE CELL', glyph: '♥', desc: '血量上限提高并回满。', stats: [['血量上限', '+25', 1]], apply: () => { P.maxHp += 25; P.hp = P.maxHp; } },
  { id: 'm_leech', kind: 'mod', rarity: 2, name: '回收芯片', en: 'SCRAP LEECH', glyph: '✜', desc: '每击杀一个敌人回复血量。', stats: [['击杀回血', '+4', 1]], apply: () => { mods.lifesteal += 4; } },
  { id: 'm_asteal', kind: 'mod', rarity: 2, name: '废铁装甲', en: 'SCRAP ARMOR', glyph: '⛭', desc: '每击杀一个敌人回复护甲。', stats: [['击杀回甲', '+5', 1]], apply: () => { mods.armorSteal += 5; } },
  // ---- 改装（带负面）----
  { id: 'm_heavy', kind: 'mod', rarity: 2, name: '重型弹头', en: 'HEAVY SLUGS', glyph: '⬢', desc: '每一发都更痛，但打得更慢。', stats: [['伤害', pct(0.4), 1], ['射速', pct(-0.15), 0]], apply: () => { mods.dmg *= 1.4; mods.rate *= 0.85; } },
  { id: 'm_berserk', kind: 'mod', rarity: 3, name: '狂战模式', en: 'BERSERK', glyph: '☠', desc: '伤害暴涨，代价是血量上限。', stats: [['伤害', pct(0.5), 1], ['血量上限', '-25', 0]], ok: () => P.maxHp > 60, apply: () => { mods.dmg *= 1.5; P.maxHp -= 25; P.hp = Math.min(P.hp, P.maxHp); } },
  { id: 'm_glass', kind: 'mod', rarity: 3, name: '玻璃大炮', en: 'GLASS CANNON', glyph: '◇', desc: '射速和伤害都提高，护甲上限降低。', stats: [['伤害', pct(0.25), 1], ['射速', pct(0.25), 1], ['护甲上限', '-25', 0]], ok: () => P.maxArmor > 25, apply: () => { mods.dmg *= 1.25; mods.rate *= 1.25; P.maxArmor -= 25; P.armor = Math.min(P.armor, P.maxArmor); } },
  { id: 'm_spray', kind: 'mod', rarity: 2, name: '泼水射击', en: 'SPRAY & PRAY', glyph: '☄', desc: '射速大涨，准头大降。', stats: [['射速', pct(0.4), 1], ['散布', pct(0.6), 0]], apply: () => { mods.rate *= 1.4; mods.spread *= 1.6; } },
];
const RW = { 1: 10, 2: 5, 3: 2 };
const taken = new Map();
export function resetCards() { taken.clear(); }
export const pickCount = id => taken.get(id) || 0;

// 抽三张：同一张不重复；第 2 关必出一把武器；之后有一半概率给一张武器卡
export function draw(level) {
  const avail = POOL.filter(c => (!c.ok || c.ok()) && !(c.kind !== 'mod' && taken.get(c.id)));
  const out = [];
  const weapons = avail.filter(c => c.kind === 'weapon');
  if (weapons.length && (level <= 2 || Math.random() < 0.5)) out.push(weighted(weapons));
  while (out.length < 3) {
    const rest = avail.filter(c => !out.includes(c)); if (!rest.length) break;
    out.push(weighted(rest));
  }
  return out.sort(() => Math.random() - 0.5);
}
function weighted(list) {
  let s = list.reduce((a, c) => a + RW[c.rarity], 0), r = Math.random() * s;
  for (const c of list) { r -= RW[c.rarity]; if (r <= 0) return c; } return list[0];
}
export function applyCard(c) { taken.set(c.id, (taken.get(c.id) || 0) + 1); c.apply(); }

// ---------- 界面 ----------
const KIND = { weapon: '武器', mod: '改装', skill: '技能' };
const RAR = { 1: '普通', 2: '稀有', 3: '史诗' };
function cardHTML(c, i) {
  const art = c.icon ? `<svg viewBox="0 0 66 32"><path d="${ICON[c.icon]}"/></svg>` : `<b class="gl">${c.glyph}</b>`;
  const st = c.stats.map(([k, v, good]) => `<div class="st ${good ? 'g' : 'b'}"><span>${k}</span><em>${good ? '▲' : '▼'} ${v}</em></div>`).join('');
  return `<div class="cd r${c.rarity} k-${c.kind}" data-i="${i}">
    <div class="ch"><span>${KIND[c.kind]}</span><i>${RAR[c.rarity]}</i></div>
    <div class="art">${art}</div>
    <div class="nm">${c.name}<small>${c.en}</small></div>
    <div class="ds">${c.desc}</div>
    <div class="sts">${st}</div>
    <div class="key">${i + 1}</div>
  </div>`;
}
export function showCards(level, cards, onPick) {
  const el = document.getElementById('cards');
  el.querySelector('.ttl').innerHTML = `第 ${level} 关通过 · 选择一张卡<small>STAGE CLEAR · PICK ONE</small>`;
  const row = el.querySelector('.row3'); row.innerHTML = cards.map(cardHTML).join('');
  el.classList.add('on');
  let done = false;
  const pick = i => { if (done || !cards[i]) return; done = true; removeEventListener('keydown', key);
    row.children[i].classList.add('picked'); [...row.children].forEach((n, k) => k !== i && n.classList.add('gone'));
    setTimeout(() => { el.classList.remove('on'); onPick(cards[i]); }, 450); };
  const key = e => { const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]; if (n !== undefined) pick(n); };
  addEventListener('keydown', key);
  [...row.children].forEach((n, i) => { n.onclick = () => pick(i); n.style.animationDelay = (i * 0.09) + 's'; });
  return pick;
}
// HUD 增益栏的汇总
export function buffSummary() {
  const out = [];
  const f = (v, name) => { const p = Math.round((v - 1) * 100); if (p) out.push(`${name} ${p > 0 ? '+' : ''}${p}%`); };
  f(mods.dmg, '火力'); f(mods.rate, '射速'); if (mods.mag !== 1) f(mods.mag, '弹匣');
  if (mods.chain) out.push('连锁爆破'); if (mods.lifesteal) out.push('击杀回血');
  return out;
}
