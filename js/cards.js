import { rand } from './rng.js';
import { mods, skills } from './stats.js';
import { P } from './player.js';
import { W, giveWeapon, refillAll, upgradeWeapon, wlv, UPG, DEFS } from './weapons.js';
import { ICON } from './hud.js';

// 卡牌池。kind: weapon 新武器 / mod 改装（可带负面）/ skill 技能
// rarity: 1 普通(绿) 2 稀有(蓝) 3 史诗(橙)
const boomBase = () => !!(mods.chain || mods.boomCrit || mods.he || W.owned.includes('rocket'));
// 武器升级卡：拿到这把枪才出现，1 级之后才出 2 级
const up = (k, n, rarity, glyph, en) => ({ id: `u_${k}${n}`, kind: 'up', rarity, name: `${DEFS[k].name} Lv.${n}`, en, icon: DEFS[k].icon, desc: UPG[k][n - 1] + '。', stats: [['武器等级', `${n} / 2`, 1]], ok: () => W.owned.includes(k) && wlv(k) === n - 1, apply: () => upgradeWeapon(k) });
const pct = v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
export const POOL = [
  // ---- 武器 ----
  { id: 'w_smg', kind: 'weapon', rarity: 1, name: '冲锋枪', en: 'BUZZ-SMG', icon: 'smg', desc: '全自动，射速 13 发/秒，弹匣 32。', stats: [['射速', '高', 1], ['单发伤害', '低', 0]], ok: () => !W.owned.includes('smg'), apply: () => giveWeapon('smg') },
  { id: 'w_shotgun', kind: 'weapon', rarity: 2, name: '霰弹枪', en: 'BOOM-STICK', icon: 'shotgun', desc: '近距离一枪轰飞，8 颗弹丸。', stats: [['近战', '爆炸', 1], ['换弹', '慢', 0]], ok: () => !W.owned.includes('shotgun'), apply: () => giveWeapon('shotgun') },
  { id: 'w_dual', kind: 'weapon', rarity: 3, name: '双持手枪', en: 'TWIN RATTLERS', icon: 'dual', desc: '两把一起打，600 RPM，左右交替开火。', stats: [['射速', '600 RPM', 1], ['散布', '+', 0]], ok: () => !W.owned.includes('dual') && W.owned.length >= 2, apply: () => giveWeapon('dual') },
  { id: 'w_nail', kind: 'weapon', rarity: 2, name: '穿透钉枪', en: 'NAIL DRIVER', icon: 'nail', desc: '全自动钉枪，一颗钉子能穿过一排 3 个敌人。', stats: [['穿透', '3 个', 1], ['打装甲', '会被挡住', 0]], ok: () => !W.owned.includes('nail') && W.owned.length >= 2, apply: () => giveWeapon('nail') },
  { id: 'w_rocket', kind: 'weapon', tag: 'boom', rarity: 3, name: '火箭筒', en: 'SCRAP ROCKET', icon: 'rocket', desc: '发射火箭，落点大爆炸。对着脚下打可以火箭跳。', stats: [['爆炸', '3.2 米', 1], ['弹匣', '3 发', 0]], ok: () => !W.owned.includes('rocket') && W.owned.length >= 2, apply: () => giveWeapon('rocket') },
  { id: 'w_arc', kind: 'weapon', tag: 'shock', rarity: 3, name: '蓄力电弧枪', en: 'ARC CANNON', icon: 'arc', desc: '按住蓄力、松手放电。光束穿过一整排敌人，蓄满伤害 5 倍，打护盾翻倍。', stats: [['蓄满伤害', '110', 1], ['需要蓄力', '1.1 秒', 0]], ok: () => !W.owned.includes('arc') && W.owned.length >= 2, apply: () => giveWeapon('arc') },
  up('nail', 1, 1, '', 'NAIL DRIVER +'), up('nail', 2, 2, '', 'NAIL DRIVER ++'),
  up('rocket', 1, 2, '', 'SCRAP ROCKET +'), up('rocket', 2, 3, '', 'SCRAP ROCKET ++'),
  up('arc', 1, 2, '', 'ARC CANNON +'), up('arc', 2, 3, '', 'ARC CANNON ++'),
  // ---- 技能 ----
  { id: 's_hook', kind: 'skill', rarity: 2, name: '勾锁', en: 'GRAPPLE', glyph: '⚓', desc: '长按 E 把自己拉过去；勾中小怪会把它直接拽到你面前。', stats: [['冷却', '2.5 秒', 1]], ok: () => !skills.hook, apply: () => { skills.hook = 1; } },
  { id: 's_dash', kind: 'skill', rarity: 2, name: '推进器', en: 'JET DASH', glyph: '➤', desc: '按 Shift 向移动方向冲刺一段。', stats: [['冷却', '2.2 秒', 1]], ok: () => !skills.dash, apply: () => { skills.dash = 1; } },
  { id: 's_chain', kind: 'skill', tag: 'boom', rarity: 3, name: '连锁爆破', en: 'CHAIN BLAST', glyph: '✹', desc: '敌人被击杀时爆炸，伤害周围 4 米内的敌人。', stats: [['爆炸伤害', '35', 1]], ok: () => !mods.chain, apply: () => { mods.chain = 35; } },
  // ---- 燃烧流派 ----
  { id: 'f_ign', kind: 'mod', tag: 'fire', rarity: 1, name: '燃烧弹', en: 'INCENDIARY', glyph: '♨', desc: '命中有概率点燃敌人，3 秒内持续掉血。', stats: [['点燃概率', '+20%', 1]], apply: () => { mods.burn += 0.2; } },
  { id: 'f_hot', kind: 'mod', tag: 'fire', rarity: 1, name: '枪管过热', en: 'HOT BARREL', glyph: '♒', desc: '枪管烧得通红：射速提高，还能点燃敌人。', stats: [['射速', pct(0.12), 1], ['点燃概率', '+10%', 1]], apply: () => { mods.rate *= 1.12; mods.burn += 0.1; } },
  { id: 'f_napalm', kind: 'mod', tag: 'fire', rarity: 2, name: '凝固汽油', en: 'NAPALM', glyph: '☀', desc: '火烧得更旺、更久。', stats: [['燃烧伤害', pct(0.6), 1], ['持续', '+2 秒', 1]], ok: () => mods.burn > 0, apply: () => { mods.burnDmg *= 1.6; mods.burnDur += 2; } },
  { id: 'f_pyro', kind: 'mod', tag: 'fire', rarity: 2, name: '纵火狂', en: 'PYROMANIAC', glyph: '♆', desc: '打正在燃烧的敌人，每一枪都更痛。', stats: [['对燃烧敌人', pct(0.3), 1]], ok: () => mods.burn > 0, apply: () => { mods.burnBonus += 0.3; } },
  { id: 'f_warm', kind: 'mod', tag: 'fire', rarity: 2, name: '烤火取暖', en: 'WARM UP', glyph: '♁', desc: '敌人被烧死时，你回复护甲。', stats: [['烧死回甲', '+6', 1]], ok: () => mods.burn > 0, apply: () => { mods.burnArmor += 6; } },
  { id: 'f_slow', kind: 'mod', tag: 'fire', rarity: 3, name: '文火慢炖', en: 'SLOW COOK', glyph: '♾', desc: '燃烧伤害翻倍还多，子弹本身变弱。', stats: [['燃烧伤害', pct(1.2), 1], ['伤害', pct(-0.15), 0]], ok: () => mods.burn > 0, apply: () => { mods.burnDmg *= 2.2; mods.dmg *= 0.85; } },
  // ---- 电击流派 ----
  { id: 'e_arc', kind: 'mod', tag: 'shock', rarity: 1, name: '电弧弹头', en: 'ARC ROUNDS', glyph: 'ϟ', desc: '命中有概率放电，电弧会跳到附近的敌人身上。', stats: [['放电概率', '+15%', 1], ['跳跃', '2 个', 1]], apply: () => { mods.arc += 0.15; } },
  { id: 'e_static', kind: 'mod', tag: 'shock', rarity: 1, name: '静电积累', en: 'STATIC BUILDUP', glyph: '≋', desc: '每打中 8 枪，必定放一次电。', stats: [['必定放电', '每 8 枪', 1]], ok: () => !mods.arcEvery, apply: () => { mods.arcEvery = 8; } },
  { id: 'e_cap', kind: 'mod', tag: 'shock', rarity: 2, name: '高压电容', en: 'CAPACITOR', glyph: '⊞', desc: '电弧伤害大幅提高。', stats: [['电弧伤害', pct(0.6), 1]], ok: () => mods.arc > 0 || mods.arcEvery > 0, apply: () => { mods.arcDmg *= 1.6; } },
  { id: 'e_cond', kind: 'mod', tag: 'shock', rarity: 2, name: '导体线圈', en: 'CONDUCTOR', glyph: '∿', desc: '电弧能跳得更多、更远。', stats: [['跳跃', '+2 个', 1], ['距离', '+3 米', 1]], ok: () => mods.arc > 0 || mods.arcEvery > 0, apply: () => { mods.arcJumps += 2; mods.arcRange += 3; } },
  { id: 'e_para', kind: 'mod', tag: 'shock', rarity: 2, name: '麻痹', en: 'PARALYZE', glyph: '⊘', desc: '被电到的小怪当场僵住。', stats: [['僵直', '+0.6 秒', 1]], ok: () => (mods.arc > 0 || mods.arcEvery > 0) && mods.arcStun < 1.2, apply: () => { mods.arcStun += 0.6; } },
  { id: 'e_over', kind: 'mod', tag: 'shock', rarity: 3, name: '超载', en: 'OVERLOAD', glyph: '⚠', desc: '电池开到最大，放电更频繁，换弹变慢。', stats: [['放电概率', '+25%', 1], ['换弹时间', pct(0.2), 0]], apply: () => { mods.arc += 0.25; mods.reload *= 1.2; } },
  // ---- 爆炸流派（连锁爆破也算）----
  { id: 'b_crit', kind: 'mod', tag: 'boom', rarity: 2, name: '爆头雷管', en: 'DETONATOR', glyph: '⊛', desc: '爆头时在命中点炸开，伤到周围的敌人。', stats: [['爆头爆炸', '20 伤害', 1]], ok: () => !mods.boomCrit, apply: () => { mods.boomCrit = 1; } },
  { id: 'b_he', kind: 'mod', tag: 'boom', rarity: 3, name: '高爆弹头', en: 'HE ROUNDS', glyph: '✸', desc: '每一枪的落点都会小爆炸，代价是射速。', stats: [['每枪爆炸', '1.6 米', 1], ['射速', pct(-0.15), 0]], ok: () => !mods.he, apply: () => { mods.he = 1; mods.rate *= 0.85; } },
  { id: 'b_tnt', kind: 'mod', tag: 'boom', rarity: 1, name: '炸药加量', en: 'MORE TNT', glyph: '⬣', desc: '你的所有爆炸伤害提高。', stats: [['爆炸伤害', pct(0.4), 1]], ok: () => boomBase(), apply: () => { mods.boomDmg *= 1.4; } },
  { id: 'b_frag', kind: 'mod', tag: 'boom', rarity: 2, name: '破片外壳', en: 'FRAG CASING', glyph: '✲', desc: '爆炸范围变大。', stats: [['爆炸范围', pct(0.35), 1]], ok: () => boomBase(), apply: () => { mods.boomR *= 1.35; } },
  { id: 'b_plate', kind: 'mod', tag: 'boom', rarity: 2, name: '冲击护甲', en: 'BLAST PLATING', glyph: '⛉', desc: '你的爆炸每炸到一个敌人，回复护甲（每次最多 3 个）。', stats: [['炸到回甲', '+2', 1]], ok: () => boomBase(), apply: () => { mods.boomArmor += 2; } },
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
// ---------- 流派套装：同一流派拿满 3 张就激活 ----------
export const TAGS = { fire: '燃烧', shock: '电击', boom: '爆炸' };
export const SETS = {
  fire: { name: '焚化炉', en: 'INCINERATOR', color: '#e8431f', desc: '点燃概率 +15%；烧死的敌人把火传给 4 米内的敌人' },
  shock: { name: '特斯拉线圈', en: 'TESLA COIL', color: '#2fa8d8', desc: '电弧多跳 2 个、远 3 米；每 2.5 秒自动电击身边的敌人' },
  boom: { name: '拆迁队', en: 'DEMOLITION', color: '#f08a1c', desc: '爆炸范围 +30%、伤害 +50%，还会把敌人炸飞' },
};
export const SET_N = 3;
export function tagCount(tag) { let n = 0; for (const [id, k] of taken) { const c = POOL.find(x => x.id === id); if (c && c.tag === tag) n += k; } return n; }

// 抽三张：同一张不重复；第 2 关必出一把武器；之后有一半概率给一张武器卡
export function draw(level) {
  const avail = POOL.filter(c => (!c.ok || c.ok()) && !(c.kind !== 'mod' && taken.get(c.id)));
  const out = [];
  const weapons = avail.filter(c => c.kind === 'weapon');
  if (weapons.length && (level <= 2 || rand() < 0.5)) out.push(weighted(weapons));
  while (out.length < 3) {
    const rest = avail.filter(c => !out.includes(c)); if (!rest.length) break;
    out.push(weighted(rest));
  }
  return out.sort(() => rand() - 0.5);
}
// 已经走了某个流派，同流派的卡更容易出现
function wt(c) { let w = RW[c.rarity]; if (c.tag) { const n = tagCount(c.tag); if (n) w *= mods.sets[c.tag] ? 1.5 : 1 + n * 1.2; } return w; }
function weighted(list) {
  let s = list.reduce((a, c) => a + wt(c), 0), r = rand() * s;
  for (const c of list) { r -= wt(c); if (r <= 0) return c; } return list[0];
}
// 返回新激活的套装（没有就是 null）
export function applyCard(c) {
  taken.set(c.id, (taken.get(c.id) || 0) + 1); c.apply();
  if (c.tag && !mods.sets[c.tag] && tagCount(c.tag) >= SET_N) { mods.sets[c.tag] = true; return { tag: c.tag, ...SETS[c.tag] }; }
  return null;
}

// ---------- 界面 ----------
const KIND = { weapon: '武器', mod: '改装', skill: '技能', up: '升级' };
const RAR = { 1: '普通', 2: '稀有', 3: '史诗' };
function tagHTML(c) {
  if (!c.tag) return '';
  const n = tagCount(c.tag), txt = mods.sets[c.tag] ? `${SETS[c.tag].name} ✓` : `${TAGS[c.tag]} ${Math.min(SET_N, n + 1)}/${SET_N}`;
  return `<span class="tg t-${c.tag}${!mods.sets[c.tag] && n + 1 >= SET_N ? ' full' : ''}">${txt}</span>`;
}
function cardHTML(c, i) {
  const art = c.icon ? `<svg viewBox="0 0 66 32"><path d="${ICON[c.icon]}"/></svg>` : `<b class="gl">${c.glyph}</b>`;
  const st = c.stats.map(([k, v, good]) => `<div class="st ${good ? 'g' : 'b'}"><span>${k}</span><em>${good ? '▲' : '▼'} ${v}</em></div>`).join('');
  return `<div class="cd r${c.rarity} k-${c.kind}" data-i="${i}">
    <div class="ch"><span>${KIND[c.kind]}</span><i>${RAR[c.rarity]}</i></div>
    <div class="art">${art}${tagHTML(c)}</div>
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
  for (const t in TAGS) { const n = tagCount(t); if (n) out.push({ html: mods.sets[t] ? `${SETS[t].name} ✓` : `${TAGS[t]} ${n}/${SET_N}`, cls: 't-' + t + (mods.sets[t] ? ' on' : '') }); }
  return out;
}
