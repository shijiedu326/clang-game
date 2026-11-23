import * as THREE from 'three';

// ---------- 程序化手绘贴图 ----------
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// 金属/涂漆：边缘压暗、污渍、锈迹流痕、划痕
function grime(g, w, h, rust = 0.5) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  const eg = 0.13 * w;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, eg, 0, 0, 0, eg, h], [w, 0, w - eg, 0, w - eg, 0, eg, h], [0, 0, 0, eg, 0, 0, w, eg], [0, h, 0, h - eg, 0, h - eg, w, eg]]) {
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(70,50,30,.45)'); gr.addColorStop(1, 'rgba(70,50,30,0)');
    g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(${90 + rnd() * 40 | 0},${60 + rnd() * 20 | 0},40,${0.06 + rnd() * 0.12})`;
    g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * w * 0.12, 4 + rnd() * h * 0.08, rnd() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < 9 * rust; i++) {
    const x = rnd() * w, y = rnd() * h * 0.5, len = h * (0.2 + rnd() * 0.5);
    const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(150,70,25,.55)'); gr.addColorStop(1, 'rgba(150,70,25,0)');
    g.fillStyle = gr; g.fillRect(x, y, 2 + rnd() * 5, len);
  }
  g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) { const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 40, y + (rnd() - .5) * 14); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.08)';
  for (let i = 0; i < 400; i++) g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
}
export const TEX = {};
TEX.metal = canvasTex(256, 256, (g, w, h) => grime(g, w, h, 0.4));
TEX.rusty = canvasTex(256, 256, (g, w, h) => grime(g, w, h, 1.6));
TEX.plain = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(80,60,40,.07)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(rnd() * w, rnd() * h, 6 + rnd() * 20, 0, 7); g.fill(); } });
TEX.wood = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(90,45,15,${0.15 + rnd() * 0.25})`; g.lineWidth = 1 + rnd() * 2.5; g.beginPath();
    let y = rnd() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 16) { y += (rnd() - .5) * 4; g.lineTo(x, y); } g.stroke();
  }
});
// 集装箱瓦楞
TEX.ribbed = canvasTex(256, 256, (g, w, h) => {
  grime(g, w, h, 1);
  for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 7, 0, 3, h); }
});
// 地面：水泥板 + 裂缝 + 沙
TEX.ground = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#e9cf98'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${200 + rnd() * 40 | 0},${170 + rnd() * 30 | 0},${110 + rnd() * 30 | 0},.5)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 70, 10 + rnd() * 40, rnd() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(120,95,60,.22)'; g.lineWidth = 2;
  for (let i = 0; i <= w; i += 256) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  g.lineWidth = 1.6; g.strokeStyle = 'rgba(70,50,30,.55)';
  for (let i = 0; i < 9; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rnd() - .5) * 40; y += (rnd() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(90,70,45,.12)'; for (let i = 0; i < 1500; i++) g.fillRect(rnd() * w, rnd() * h, 2, 2);
}, true);
TEX.hazard = canvasTex(128, 32, (g, w, h) => { g.fillStyle = '#f5c518'; g.fillRect(0, 0, w, h); g.fillStyle = '#151515'; for (let x = -h; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } }, true);
export function signTex(lines, bg = '#f6ecd2', fg = '#151515', accent = '#e8431f') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, 0, w, 36); g.fillRect(0, h - 22, w, 22);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([t, size, y, col]) => { g.font = `900 ${size}px Impact, "Microsoft YaHei", sans-serif`; g.fillStyle = col || fg; g.fillText(t, w / 2, y); });
    grimeOver(g, w, h);
  });
}
function grimeOver(g, w, h) { g.fillStyle = 'rgba(90,60,30,.1)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 50, 6 + rnd() * 20, rnd() * 3, 0, 7); g.fill(); } }

// ---------- 卡通材质：三阶色调 + 暗部排线 ----------
const grad = (() => {
  const d = new Uint8Array([95, 170, 225, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
function hatchify(m) {
  m.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `
      float litK = dot(reflectedLight.directDiffuse, vec3(0.333)) / max(dot(diffuseColor.rgb, vec3(0.333)), 0.02);
      float hl = step(0.62, fract((gl_FragCoord.x - gl_FragCoord.y) * 0.14));
      float dk = 1.0 - smoothstep(0.30, 0.42, litK);
      outgoingLight *= (1.0 - hl * dk * 0.3) * (1.0 - dk * 0.12);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'hatch';
  return m;
}
const matCache = new Map();
export function toon(color, tex = 'metal') {
  const k = color + '|' + tex;
  if (!matCache.has(k)) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: grad, map: tex ? TEX[tex] : null });
    matCache.set(k, hatchify(m));
  }
  return matCache.get(k);
}
export function toonTex(map, color = 0xffffff) { return hatchify(new THREE.MeshToonMaterial({ color, gradientMap: grad, map })); }

// 兼容旧接口：ink 参数忽略（描边改为后处理）
export function inked(geo, color, ink, tex) {
  const m = new THREE.Mesh(geo, toon(color, tex));
  return m;
}
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new Map(), sph: new THREE.SphereGeometry(1, 14, 10) };
export function box(w, h, d, color, ink, tex) { const m = new THREE.Mesh(G.box, toon(color, tex)); m.scale.set(w, h, d); return m; }
export function cyl(rt, rb, h, color, ink, seg = 12, tex) {
  const k = rt + '|' + rb + '|' + seg;
  if (!G.cyl.has(k)) G.cyl.set(k, new THREE.CylinderGeometry(rt, rb, 1, seg));
  const m = new THREE.Mesh(G.cyl.get(k), toon(color, tex)); m.scale.y = h; return m;
}
export function sph(r, color, ink, tex) { const m = new THREE.Mesh(G.sph, toon(color, tex)); m.scale.setScalar(r); return m; }

export const PAL = { sand: 0xe8c98a, sand2: 0xd4a95f, rust: 0xb5532c, steel: 0x6d7a82, dark: 0x3a3f45, yellow: 0xf5c518, red: 0xe8431f, sky: 0x8fd3ee, ink: 0x151515 };
