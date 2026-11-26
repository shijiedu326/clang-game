// 局外成长 + 每日挑战
// 零件：打怪掉的货币，过关/结束时存进车库；车库里解锁开局武器、开局卡、永久天赋
// 每日挑战：按日期出种子，关卡和卡牌人人一样，外加两条特殊规则；车库加成不生效
import { save, saveProgress } from './save.js';
import { P } from './player.js';
import { mods } from './stats.js';
import { SK } from './skills.js';
import { giveWeapon } from './weapons.js';
import { POOL, applyCard } from './cards.js';
import { seeded, rand } from './rng.js';

// ---------- 车库：开局武器 ----------
export const G_WEAPONS = [
  { k: 'smg', name: '冲锋枪', cost: 60 }, { k: 'shotgun', name: '霰弹枪', cost: 80 }, { k: 'dual', name: '双持手枪', cost: 100 },
  { k: 'nail', name: '穿透钉枪', cost: 120 }, { k: 'rocket', name: '火箭筒', cost: 160 }, { k: 'arc', name: '蓄力电弧枪', cost: 160 },
];
// ---------- 车库：开局卡（从卡池里挑几张，开局直接生效） ----------
export const G_CARDS = [
  { id: 'm_dmg', cost: 50 }, { id: 'm_reload', cost: 40 }, { id: 'm_hp', cost: 40 }, { id: 'm_armor', cost: 40 },
  { id: 'm_rate', cost: 50 }, { id: 'm_leech', cost: 80 }, { id: 's_dash', cost: 90 }, { id: 's_hook', cost: 90 },
];
// ---------- 车库：永久天赋（每级价格递增） ----------
export const TALENTS = [
  { id: 'hp', name: '加固机身', glyph: '♥', per: '血量上限 +10', max: 5, base: 30, step: 20 },
  { id: 'armor', name: '备用钢板', glyph: '⛨', per: '护甲上限 +10', max: 3, base: 30, step: 25 },
  { id: 'dmg', name: '枪管打磨', glyph: '✚', per: '全部伤害 +4%', max: 5, base: 40, step: 25 },
  { id: 'reload', name: '熟练换弹', glyph: '↻', per: '换弹时间 -6%', max: 3, base: 30, step: 20 },
  { id: 'cd', name: '技能散热', glyph: '❄', per: '勾锁、冲刺冷却 -8%', max: 3, base: 35, step: 25 },
  { id: 'heal', name: '战地维修', glyph: '✜', per: '每过一关多回 8 血', max: 3, base: 30, step: 20 },
  { id: 'parts', name: '拆解专家', glyph: '⚙', per: '零件收益 +10%', max: 5, base: 50, step: 30 },
  { id: 'revive', name: '备用核心', glyph: '☢', per: '每局一次：倒下时半血复活', max: 1, base: 300, step: 0 },
];
export const tlv = id => save.talents[id] || 0;
export const talentCost = T => T.base + tlv(T.id) * T.step;
export const cardOf = id => POOL.find(c => c.id === id);

// 花零件：够就扣掉并存档
export function spend(cost) { if (save.parts < cost) return false; save.parts -= cost; saveProgress(); return true; }
export function buyUnlock(key, cost) { if (save.unlocks[key] || !spend(cost)) return false; save.unlocks[key] = 1; saveProgress(); return true; }
export function buyTalent(T) { if (tlv(T.id) >= T.max || !spend(talentCost(T))) return false; save.talents[T.id] = tlv(T.id) + 1; saveProgress(); return true; }
export function equip(slot, v) { save.loadout[slot] = save.loadout[slot] === v ? null : v; saveProgress(); }

// ---------- 每日挑战 ----------
export const RULES = {
  glass: { name: '玻璃大炮', glyph: '✦', desc: '伤害 ×1.6，但血量上限只有 60' },
  fast: { name: '急行军', glyph: '»', desc: '敌人移动和出手都快 25%' },
  elite: { name: '精英横行', glyph: '★', desc: '第 1 关起就有精英怪，概率翻倍' },
  moon: { name: '低重力', glyph: '☾', desc: '跳得高很多' },
  rocket: { name: '火箭开局', glyph: '➶', desc: '开局直接拿到火箭筒' },
  noheal: { name: '不回血', glyph: '✕', desc: '过关不回血，改成每次击杀回 3 血' },
  head: { name: '只认脑袋', glyph: '◎', desc: '爆头伤害 ×2，其余伤害 -30%' },
  rich: { name: '高风险', glyph: '$', desc: '敌人血量 +30%，分数 ×1.5' },
  cards: { name: '卡牌雨', glyph: '♠', desc: '每过一关都能选卡' },
};
export const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const keyText = k => `${Math.floor(k / 10000)}-${String(Math.floor(k / 100) % 100).padStart(2, '0')}-${String(k % 100).padStart(2, '0')}`;
export function dailyRules(key) {
  return seeded(key * 7 + 3, () => {
    const ks = Object.keys(RULES).sort(), out = [];
    while (out.length < 2) { const r = ks[Math.floor(rand() * ks.length)]; if (!out.includes(r)) out.push(r); }
    return out;
  });
}
export function dailyInfo(key = dayKey()) { return { key, rules: dailyRules(key), rec: save.daily[key] || null }; }
// 过去 n 天（含今天）的记录
export function dailyHistory(n = 14) {
  const out = [], d = new Date();
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i), k = dayKey(x); out.push({ key: k, rec: save.daily[k] || null }); }
  return out;
}
export function dailyBest() {
  let b = null; for (const k in save.daily) { const r = save.daily[k]; if (!b || r.best > b.best) b = { key: +k, ...r }; } return b;
}
export function dailyTry(key) {
  const r = save.daily[key] || (save.daily[key] = { best: 0, level: 0, tries: 0 }); r.tries++;
  // 只留最近 90 天
  const ks = Object.keys(save.daily).map(Number).sort((a, b) => b - a); for (const k of ks.slice(90)) delete save.daily[k];
  saveProgress();
}
// 返回 { rec, prevBest, isBest }
export function dailyRecord(key, score, level) {
  const r = save.daily[key] || (save.daily[key] = { best: 0, level: 0, tries: 1 }), prevBest = r.best;
  if (score > r.best) { r.best = score; r.level = level; }
  saveProgress(); return { rec: r, prevBest, isBest: score > prevBest };
}

// ---------- 开局：普通模式吃车库加成，每日模式吃规则 ----------
// 返回开局时拿到的卡 id 列表（给 S.cards）
export function applyMeta(S) {
  const got = [];
  if (S.daily) {
    const R = S.daily.rules;
    if (R.includes('glass')) { mods.dmg *= 1.6; P.maxHp = 60; P.hp = 60; }
    if (R.includes('moon')) P.jump *= 1.35;
    if (R.includes('head')) { mods.headMul *= 2; mods.dmg *= 0.7; }
    if (R.includes('rocket')) giveWeapon('rocket');
    S.partsMul = 1; S.revive = 0; S.healBonus = 0;
    SK.hookMax = 2.5; SK.dashMax = 2.2;
    return got;
  }
  P.maxHp += 10 * tlv('hp'); P.hp = P.maxHp;
  P.maxArmor += 10 * tlv('armor'); P.armor = P.maxArmor;
  mods.dmg *= 1 + 0.04 * tlv('dmg');
  mods.reload *= 1 - 0.06 * tlv('reload');
  SK.hookMax = 2.5 * (1 - 0.08 * tlv('cd')); SK.dashMax = 2.2 * (1 - 0.08 * tlv('cd'));
  S.healBonus = 8 * tlv('heal'); S.partsMul = 1 + 0.1 * tlv('parts'); S.revive = tlv('revive');
  const w = save.loadout.weapon; if (w && save.unlocks['w:' + w]) giveWeapon(w);
  const cid = save.loadout.card, c = cid && save.unlocks['c:' + cid] && cardOf(cid);
  if (c && (!c.ok || c.ok())) { applyCard(c); got.push(c.id); }
  return got;
}
// 打一个敌人给多少零件
export function partsFor(e) {
  const t = e.t; let n = t.boss ? 25 : t.score >= 400 ? 3 : t.score >= 200 ? 2 : 1;
  if (e.elite) n += 3;
  return n;
}
// 把这局赚的零件存进车库（可以多次调用，只存新增的部分）
export function bankParts(S) {
  const n = Math.floor(S.parts || 0) - (S.banked || 0);
  if (n > 0) { save.parts += n; save.partsAll += n; S.banked = (S.banked || 0) + n; saveProgress(); }
  return S.banked || 0;
}
