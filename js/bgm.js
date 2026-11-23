import { bus, voiceState } from './audio.js';

// 背景音乐：Suno 生成的曲子放在 music/，tracks.json 记每首的循环点（结尾淡出前）。
// 两个 <audio> 轮流用：换歌单或到循环点时交叉淡入淡出。歌单内按顺序轮播。
const LISTS = {
  fight: ['fight_1', 'fight2_1', 'fight_2', 'fight2_2'],
  storm: ['storm_1', 'storm_2'],
  boss1: ['boss_1', 'boss_2'],
  boss2: ['boss_2', 'boss_1'],
  title: ['title_1', 'title_2'],
};
const M = { meta: {}, els: [], gains: [], cur: 0, list: null, name: null, level: [0, 0], vol: 0.62, mute: false };
fetch('music/tracks.json').then(r => r.json()).then(j => { M.meta = j; if (M.pending) { const p = M.pending; M.pending = null; bgmSet(p); } }).catch(() => {});

function els() {
  if (M.els.length) return M.els;
  const b = bus(); if (!b) return [];
  for (let i = 0; i < 2; i++) {
    const a = new Audio(); a.preload = 'auto'; a.crossOrigin = 'anonymous';
    const src = b.ac.createMediaElementSource(a), g = b.ac.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(b.comp);
    M.els.push(a); M.gains.push(g);
  }
  return M.els;
}
function play(name, at = 0) {
  const e = els(); if (!e.length) return;
  const nxt = 1 - M.cur, a = e[nxt];
  if (a.dataset.n !== name) { a.dataset.n = name; a.src = 'music/' + name + '.mp3'; }
  try { a.currentTime = at; } catch (er) {}
  a.play().catch(() => {});
  M.cur = nxt; M.name = name;
}
// 切歌单；已经在放同一张就不动
export function bgmSet(list) {
  if (!Object.keys(M.meta).length) { M.pending = list; return; }
  if (M.list === list) return;
  M.list = list; const L = LISTS[list] || [];
  const first = L.find(n => M.meta[n]); if (first) play(first, 0);
}
// 自检用：把当前曲拨到循环点前 sec 秒
export function bgmSeekEnd(sec = 1.5) { const m = M.meta[M.name]; if (m) M.els[M.cur].currentTime = m.end - sec; }
export function setMusicVol(v) { M.vol = v; }
export function bgmToggleMute() { M.mute = !M.mute; return M.mute; }
export const bgmInfo = () => ({ list: M.list, name: M.name, level: M.level.map(v => +v.toFixed(2)), t: M.els[M.cur] ? +M.els[M.cur].currentTime.toFixed(1) : 0 });

// 每帧：duck 0~1 为压低比例（选卡/暂停时压到一半）
export function bgmUpdate(dt, duck = 0) {
  if (!M.els.length) return;
  const b = bus(), cur = M.els[M.cur];
  const meta = M.meta[M.name];
  if (meta && cur.currentTime > meta.end) { // 到循环点，接歌单下一首
    const L = (LISTS[M.list] || []).filter(n => M.meta[n]); const i = L.indexOf(M.name);
    play(L.length ? L[(i + 1) % L.length] : M.name, 0.05);
  }
  for (let i = 0; i < 2; i++) {
    const vduck = performance.now() < voiceState.duckUntil ? 0.45 : 1; // 播报时压低音乐
    const target = (i === M.cur && M.name && !M.mute && !document.hidden) ? (1 - duck * 0.55) * vduck : 0;
    const rate = target > M.level[i] ? 0.9 : vduck < 1 ? 5 : 1.6;
    M.level[i] += (target - M.level[i]) * Math.min(1, dt * rate * 2);
    if (M.level[i] < 0.005 && target === 0) { M.level[i] = 0; if (!M.els[i].paused) M.els[i].pause(); }
    else if (M.els[i].paused && target > 0) M.els[i].play().catch(() => {});
    M.gains[i].gain.setTargetAtTime(M.level[i] * M.vol, b.ac.currentTime, 0.05);
  }
}
