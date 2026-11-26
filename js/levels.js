import { BOSS_ORDER } from './bosses.js';

// 关卡规划：每 5 关一个 Boss；第 7/9/12 关固定特殊关，之后随机；30 关后进入无尽（循环加强）
export const LAST = 30;
export const SPECIALS = { storm: '沙尘暴', nest: '沙虫巢穴', supply: '双倍补给' };
export function difficulty(lv) { return lv > LAST ? '无尽' : lv > 20 ? '噩梦' : lv > 10 ? '困难' : '普通'; }

export function planLevel(lv) {
  const cycle = Math.floor((lv - 1) / LAST);
  const hpMul = 1 + lv * 0.04 + cycle * 0.5;
  if (lv % 5 === 0) {
    const boss = BOSS_ORDER[(lv / 5 - 1) % BOSS_ORDER.length];
    return { boss, list: [], special: null, hpMul, bossMul: 1 + cycle * 0.7 };
  }
  let special = null;
  if (lv === 7) special = 'storm'; else if (lv === 9) special = 'supply'; else if (lv === 12) special = 'nest';
  else if (lv > 12 && Math.random() < 0.3) { const pool = Math.floor((lv - 1) / 10) % 3 === 0 ? ['storm', 'nest', 'supply'] : ['nest', 'supply']; special = pool[(Math.random() * pool.length) | 0]; } // 沙尘暴只在废品场
  const n = Math.min(6 + lv * 2, 40) + cycle * 6, list = [];
  for (let i = 0; i < n; i++) {
    let t = 'grunt'; const r = Math.random();
    const w = {
      spotter: lv >= 2 ? Math.min(0.15 + lv * 0.015, 0.32) : 0,
      hauler: lv >= 3 ? Math.min(0.06 + lv * 0.01, 0.2) : 0,
      husk: special === 'storm' ? 0.35 : lv >= 8 ? 0.1 : 0,
      worm: special === 'nest' ? 0.45 : special === 'storm' ? 0.1 : lv >= 11 ? 0.07 : 0,
      drone: lv >= 16 ? 0.08 : 0,
      shieldbot: lv >= 4 ? Math.min(0.05 + lv * 0.006, 0.14) : 0,
      splitter: lv >= 6 ? Math.min(0.05 + lv * 0.005, 0.12) : 0,
      medic: lv >= 8 ? 0.05 : 0,
      spider: lv >= 10 ? 0.06 : 0,
    };
    let acc = 0; for (const k in w) { acc += w[k]; if (r < acc) { t = k; break; } }
    list.push(t);
  }
  if (lv === 2 && !list.includes('spotter')) list[1] = 'spotter';
  if (lv === 3 && !list.includes('hauler')) list[2] = 'hauler';
  // 新敌人第一次出现的关卡保证至少有一只
  for (const [L, t, i] of [[4, 'shieldbot', 3], [6, 'splitter', 4], [8, 'medic', 5], [10, 'spider', 6]]) if (lv === L && !list.includes(t)) list[i] = t;
  return { boss: null, list, special, hpMul };
}
