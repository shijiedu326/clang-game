// 合成音效（WebAudio，无外部文件）
let ac = null, out = null, noiseBuf = null, comp = null;
// 给背景音乐用：同一个 AudioContext 和压限器
export const bus = () => (ac ? { ac, comp } : null);
let sfxVol = 0.55;
export function setSfxVol(v) { sfxVol = v; if (out) out.gain.value = v; }
// 音量探针：压限器输出的峰值（0~1），自检用
let meter = null; const mbuf = new Float32Array(2048);
export function peak() { if (!meter) return 0; meter.getFloatTimeDomainData(mbuf); let p = 0; for (const v of mbuf) p = Math.max(p, Math.abs(v)); return p; }
// ---------- 播报员配音：voice/*.mp3，排队播放，播的时候背景音乐压低 ----------
const VOICES = ['stage_clear', 'boss_down', 'new_weapon', 'rampage', 'boss_incoming', 'game_over', 'run_complete', 'unstoppable'];
const vbuf = {}; let vgain = null, vq = [], vBusyUntil = 0;
export const voiceState = { duckUntil: 0 };
function loadVoices() {
  vgain = ac.createGain(); vgain.gain.value = 1.15; vgain.connect(comp);
  for (const n of VOICES) fetch('voice/' + n + '.mp3').then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b)).then(d => { vbuf[n] = d; }).catch(() => {});
}
// 正在播就排队；队里最多等 2 句，可丢弃的（连杀喊话）忙时直接不播
export function say(name, { droppable = false } = {}) {
  if (!ac || !vbuf[name]) return;
  const busy = ac.currentTime < vBusyUntil;
  if (busy) { if (droppable || vq.length >= 2) return; vq.push(name); return; }
  const s = ac.createBufferSource(); s.buffer = vbuf[name]; s.connect(vgain); s.start();
  vBusyUntil = ac.currentTime + vbuf[name].duration + 0.15;
  voiceState.duckUntil = performance.now() + (vbuf[name].duration + 0.4) * 1000;
  s.onended = () => { setTimeout(() => { const n = vq.shift(); if (n) say(n); }, 120); };
}
export function initAudio() {
  if (ac) { ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  // 最后一级限幅：再多声音叠在一起也不超过 1，不削波
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
  comp.connect(lim); lim.connect(ac.destination);
  meter = ac.createAnalyser(); meter.fftSize = 2048; lim.connect(meter);
  out = ac.createGain(); out.gain.value = sfxVol; out.connect(comp);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  loadVoices();
}
const now = () => ac.currentTime;
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function noise(t, dur, peak, type, f0, f1, q = 1, dest = out) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); env(g, t, 0.002, peak, dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function tone(t, dur, peak, type, f0, f1, dest = out, a = 0.003) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); env(g, t, a, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
}
const ok = () => ac && ac.state === 'running';

export const sfx = {
  shot(kind) {
    if (!ok()) return; const t = now(), j = 1 + (Math.random() - .5) * 0.08;
    if (kind === 'shotgun') { noise(t, 0.35, 0.9, 'lowpass', 3000, 300, 0.7); tone(t, 0.25, 0.9, 'sine', 110, 38); noise(t + 0.32, 0.06, 0.25, 'bandpass', 2500, 0, 4); noise(t + 0.42, 0.06, 0.25, 'bandpass', 1800, 0, 4); return; }
    if (kind === 'smg') { noise(t, 0.08, 0.45, 'bandpass', 2200 * j, 900, 0.8); tone(t, 0.07, 0.4, 'sine', 160 * j, 60); return; }
    noise(t, 0.14, 0.65, 'bandpass', 1700 * j, 600, 0.7); tone(t, 0.12, 0.65, 'sine', 140 * j, 45); noise(t, 0.02, 0.4, 'highpass', 4000);
  },
  clang() {
    if (!ok()) return; const t = now();
    [523, 1271, 1987, 2843, 3611].forEach((f, i) => tone(t, 0.45 - i * 0.06, 0.16 / (i * 0.5 + 1), i % 2 ? 'square' : 'sine', f * (0.97 + Math.random() * 0.06)));
    noise(t, 0.03, 0.4, 'highpass', 3000);
  },
  // 命中：打穿金属壳的脆响 + 机器人身体的低频闷响 + 金属余振；爆头再加一声清亮的叮
  hit(head) {
    if (!ok()) return; const t = now(), j = 0.92 + Math.random() * 0.16;
    noise(t, 0.05, 0.68, 'highpass', 2200 * j, 0, 0.7);
    noise(t, 0.09, 0.52, 'bandpass', 900 * j, 300, 1.2);
    tone(t, 0.13, 0.72, 'sine', 210 * j, 70);
    tone(t, 0.07, 0.26, 'square', 150 * j, 60);
    [1130, 1790, 2630].forEach((f, i) => tone(t + 0.005, 0.16 - i * 0.03, 0.09, i ? 'sine' : 'triangle', f * j));
    if (head) { tone(t, 0.28, 0.28, 'triangle', 2700 * j, 2450); tone(t + 0.02, 0.22, 0.15, 'sine', 4050 * j, 3900); noise(t, 0.06, 0.4, 'bandpass', 4200, 0, 2); }
  },
  kill(big) {
    if (!ok()) return; const t = now();
    noise(t, big ? 0.9 : 0.55, 0.9, 'lowpass', 2400, 120, 0.8); tone(t, big ? 0.5 : 0.3, 0.9, 'sine', 120, 30);
    for (let i = 0; i < (big ? 7 : 4); i++) { const tt = t + 0.08 + Math.random() * 0.5; tone(tt, 0.12, 0.08, 'square', 600 + Math.random() * 2400); noise(tt, 0.03, 0.2, 'bandpass', 3000 + Math.random() * 2000, 0, 3); }
  },
  hurt() { if (!ok()) return; const t = now(); tone(t, 0.2, 0.4, 'sawtooth', 180, 70); noise(t, 0.15, 0.4, 'lowpass', 900, 200); },
  laser() { if (!ok()) return; const t = now(); tone(t, 1.05, 0.08, 'sine', 500, 1800, out, 0.05); for (let i = 0; i < 6; i++) tone(t + i * 0.17, 0.05, 0.08, 'square', 1500 + i * 150); },
  laserShot() { if (!ok()) return; const t = now(); tone(t, 0.25, 0.35, 'sawtooth', 2200, 180); noise(t, 0.1, 0.3, 'highpass', 2000); },
  reload(dur) { if (!ok()) return; const t = now(); noise(t + 0.05, 0.05, 0.4, 'bandpass', 1400, 0, 5); tone(t + 0.05, 0.03, 0.15, 'square', 400); noise(t + dur * 0.75, 0.06, 0.5, 'bandpass', 2200, 0, 5); tone(t + dur * 0.75, 0.04, 0.2, 'square', 700); },
  spawn() { if (!ok()) return; const t = now(); noise(t, 0.25, 0.25, 'lowpass', 1200, 200); tone(t, 0.18, 0.12, 'square', 220, 440); },
  swap() { if (!ok()) return; const t = now(); noise(t, 0.05, 0.3, 'bandpass', 1800, 0, 4); noise(t + 0.12, 0.05, 0.3, 'bandpass', 2600, 0, 4); },
  step() { if (!ok()) return; noise(now(), 0.05, 0.08, 'lowpass', 600, 200); },
  jingle(up = true) {
    if (!ok()) return; const t = now(); const n = up ? [523, 659, 784, 1047] : [784, 659, 523, 392];
    n.forEach((f, i) => { tone(t + i * 0.09, 0.18, 0.18, 'square', f); tone(t + i * 0.09, 0.18, 0.1, 'triangle', f / 2); });
  },
  hookFire() { if (!ok()) return; const t = now(); noise(t, 0.18, 0.35, 'bandpass', 900, 3000, 2); tone(t + 0.12, 0.08, 0.2, 'square', 1800); },
  latch() { if (!ok()) return; const t = now(); tone(t, 0.12, 0.25, 'square', 900); noise(t, 0.05, 0.4, 'bandpass', 2500, 0, 3); noise(t + 0.02, 0.5, 0.2, 'bandpass', 400, 1600, 1); },
  dash() { if (!ok()) return; const t = now(); noise(t, 0.3, 0.5, 'bandpass', 500, 2500, 1.2); tone(t, 0.2, 0.12, 'sawtooth', 120, 260); },
  card() { if (!ok()) return; const t = now(); [0, 0.09, 0.18].forEach(d => noise(t + d, 0.06, 0.3, 'highpass', 3000)); },
  pick() { if (!ok()) return; const t = now(); [659, 880, 1319].forEach((f, i) => tone(t + i * 0.06, 0.25, 0.16, 'triangle', f)); },
  roar() { if (!ok()) return; const t = now(); tone(t, 1.0, 0.5, 'sawtooth', 90, 55, out, 0.08); tone(t, 1.0, 0.3, 'square', 135, 70, out, 0.08); noise(t, 1.0, 0.4, 'lowpass', 600, 200, 1); },
  charge() { if (!ok()) return; const t = now(); tone(t, 0.6, 0.35, 'sawtooth', 80, 220); noise(t, 0.8, 0.5, 'bandpass', 300, 1200, 1); },
  saw() { if (!ok()) return; const t = now(); tone(t, 0.4, 0.25, 'sawtooth', 900, 1400); noise(t, 0.35, 0.4, 'bandpass', 3000, 0, 2); },
  rumble() { if (!ok()) return; const t = now(); noise(t, 1.0, 0.6, 'lowpass', 200, 90, 1); tone(t, 1.0, 0.4, 'sine', 45, 38, out, 0.2); },
  erupt() { if (!ok()) return; const t = now(); noise(t, 1.2, 0.9, 'lowpass', 1800, 150, 0.8); tone(t, 0.6, 0.7, 'sine', 70, 30); tone(t, 0.9, 0.3, 'sawtooth', 160, 60, out, 0.05); },
  spit() { if (!ok()) return; const t = now(); noise(t, 0.25, 0.4, 'bandpass', 700, 300, 2); tone(t, 0.15, 0.2, 'square', 200, 120); },
  mortar() { if (!ok()) return; const t = now(); tone(t, 0.3, 0.8, 'sine', 70, 35); noise(t, 0.4, 0.6, 'lowpass', 900, 200); noise(t + 0.25, 0.9, 0.12, 'bandpass', 2400, 900, 6); },
  orb() { if (!ok()) return; const t = now(); for (let i = 0; i < 3; i++) tone(t + i * 0.05, 0.12, 0.12, 'square', 1200 - i * 200, 600); },
  hatch() { if (!ok()) return; const t = now(); noise(t, 0.4, 0.4, 'bandpass', 500, 1500, 3); tone(t + 0.3, 0.3, 0.2, 'square', 300, 150); },
  missile() { if (!ok()) return; const t = now(); noise(t, 0.8, 0.35, 'bandpass', 800, 2400, 1.5); },
  chain() { if (!ok()) return; const t = now(); for (let i = 0; i < 6; i++) noise(t + i * 0.07, 0.05, 0.25, 'bandpass', 3000 + i * 300, 0, 6); },
  bossDown() { if (!ok()) return; const t = now(); noise(t, 1.6, 0.9, 'lowpass', 2500, 80, 0.7); tone(t, 1.0, 0.8, 'sine', 80, 25); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + 0.5 + i * 0.1, 0.35, 0.18, 'square', f)); },
  tink() { if (!ok()) return; const t = now(); tone(t, 0.06, 0.06, 'triangle', 2400 + Math.random() * 1200); },
  boom() { if (!ok()) return; const t = now(); noise(t, 0.6, 0.6, 'lowpass', 1500, 100); tone(t, 0.4, 0.5, 'sine', 90, 35); tone(t, 0.3, 0.12, 'square', 880, 1320); },
};
