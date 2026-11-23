// 本地存档：设置 + 进度（最高分、到过的关、图鉴解锁）。都存 localStorage，坏了就用默认值
const KS = 'clang_settings', KP = 'clang_save';
export const DEFAULTS = { sens: 1, fov: 78, music: 0.62, sfx: 0.55, quality: 'high' }; // quality: high / mid / low
const load = (k, d) => { try { return Object.assign(structuredClone(d), JSON.parse(localStorage.getItem(k) || '{}')); } catch { return structuredClone(d); } };
export const settings = load(KS, DEFAULTS);
export const save = load(KP, { best: 0, bestLevel: 0, reached: [1], codex: {}, cards: {}, runs: 0 });
export function saveSettings() { try { localStorage.setItem(KS, JSON.stringify(settings)); } catch {} }
export function saveProgress() { try { localStorage.setItem(KP, JSON.stringify(save)); } catch {} }
export function seen(kind, id) { const m = kind === 'card' ? save.cards : save.codex; if (!m[id]) { m[id] = 1; saveProgress(); } }
export function reach(level) {
  // 可选的起点：第 1 关 + 每个到过的 Boss 关
  if (level % 5 === 0 && !save.reached.includes(level)) { save.reached.push(level); save.reached.sort((a, b) => a - b); }
  if (level > save.bestLevel) save.bestLevel = level;
  saveProgress();
}
export function record(score) { if (score > save.best) save.best = score; save.runs++; saveProgress(); }
