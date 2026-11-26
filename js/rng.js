// 可播种随机数：平时就是 Math.random；每日挑战时按种子出，保证同一天关卡和卡牌一样
let st = 0, on = false;
export function rand() {
  if (!on) return Math.random();
  st = (st + 0x6D2B79F5) | 0; let t = st;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function seedRng(n) { st = n | 0; on = true; }
export function unseed() { on = false; }
// 在固定种子下跑一段代码，跑完恢复成普通随机
export function seeded(n, fn) { const was = on, ws = st; seedRng(n); try { return fn(); } finally { on = was; st = ws; } }
