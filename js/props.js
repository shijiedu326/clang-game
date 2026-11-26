import * as THREE from 'three';
import { box, cyl, toon, toonTex, signTex, TEX, PAL } from './art.js';
import { place, placeBox, solid, ARENA } from './world.js';

let sd = 11; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
const CONT = [0xc2452d, 0x3a7ca5, 0xe0a526, 0x5b8c5a, 0xd9d2c0];
// 可以站上去的高台（整块台面 + 楼梯底/顶坐标），给敌人找楼梯用
export const PLATFORMS = [];
// 楼梯：从 (x,z) 起往 dir 方向下降 n 级，每级高 rise、深 run、宽 w
function stairs(x, z, dir, axis, n, rise, run, w) {
  for (let s = 0; s < n; s++) {
    const top = rise * (n - s), off = dir * s * run;
    if (axis === 'x') placeBox(box(run, top, w, PAL.rust, 0, 'rusty'), x + off, top / 2, z);
    else placeBox(box(w, top, run, PAL.rust, 0, 'rusty'), x, top / 2, z + off);
  }
}

// 两点之间的梁
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
export function beam(ax, ay, az, bx, by, bz, t, color = PAL.steel, tex = 'metal') {
  _a.set(ax, ay, az); _b.set(bx, by, bz);
  const m = box(t, t, _a.distanceTo(_b), color, 0, tex);
  m.position.copy(_a).lerp(_b, 0.5); m.lookAt(_b); place(m); return m;
}
// 竖向桁架塔（四根立柱 + X 斜撑）
function trussTower(x, z, w, h, color = PAL.steel, step = 3) {
  const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + a * w / 2, z + b * w / 2]);
  for (const [cx, cz] of c) beam(cx, 0, cz, cx, h, cz, 0.28, color);
  for (let y = 0; y < h - 0.1; y += step) {
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = c[i], [x1, z1] = c[(i + 1) % 4];
      beam(x0, y + step, z0, x1, y + step, z1, 0.18, color);
      if ((i + y / step) % 2 < 1) beam(x0, y, z0, x1, y + step, z1, 0.14, color); else beam(x1, y, z1, x0, y + step, z0, 0.14, color);
    }
  }
}
// 横向桁架（两根弦杆 + 斜撑）
function trussSpan(x0, x1, y, z, h, color = PAL.steel) {
  for (const zz of [z - 0.8, z + 0.8]) {
    beam(x0, y, zz, x1, y, zz, 0.3, color); beam(x0, y + h, zz, x1, y + h, zz, 0.3, color);
    const n = Math.round(Math.abs(x1 - x0) / h);
    for (let i = 0; i < n; i++) {
      const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n;
      beam(a, y, zz, a, y + h, zz, 0.18, color); beam(a, i % 2 ? y : y + h, zz, b, i % 2 ? y + h : y, zz, 0.16, color);
    }
  }
}
function container(x, y, z, rotY, color) {
  const w = rotY ? 2.44 : 6.1, d = rotY ? 6.1 : 2.44;
  const m = box(w, 2.6, d, color, 0, 'ribbed'); placeBox(m, x, y + 1.3, z);
  // 门端加深色边框
  const f = box(rotY ? 2.5 : 0.12, 2.66, rotY ? 0.12 : 2.5, 0x2a2a2a, 0, 'metal');
  place(f, x + (rotY ? 0 : w / 2), y + 1.3, z + (rotY ? d / 2 : 0));
}
function barrel(x, z, color) {
  const b = cyl(0.45, 0.45, 1.25, color, 0, 12, 'rusty'); place(b, x, 0.625, z);
  const r = cyl(0.47, 0.47, 0.08, 0x2a2a2a, 0, 12, 'metal'); place(r, x, 0.9, z);
  solid(x - .45, x + .45, 0, 1.25, z - .45, z + .45);
}
const tireG = new THREE.TorusGeometry(0.55, 0.26, 8, 14);
function tires(x, z, n) {
  for (let i = 0; i < n; i++) { const t = new THREE.Mesh(tireG, toon(0x2b2b2b, 'plain')); t.rotation.x = Math.PI / 2; t.rotation.z = R() * 3; place(t, x + (R() - .5) * .1, 0.26 + i * 0.5, z + (R() - .5) * .1); }
  solid(x - .8, x + .8, 0, n * 0.5 + .05, z - .8, z + .8);
}
function barrier(x, z, rotY) {
  const w = rotY ? 0.7 : 3, d = rotY ? 3 : 0.7;
  placeBox(box(w, 0.4, d, 0xcfc4ae, 0, 'plain'), x, 0.2, z);
  place(box(rotY ? 0.4 : 3, 0.7, rotY ? 3 : 0.4, 0xd8cdb6, 0, 'plain'), x, 0.75, z); solid(x - w / 2, x + w / 2, 0.4, 1.1, z - d / 2, z + d / 2);
  place(box(rotY ? 0.42 : 1, 0.16, rotY ? 1 : 0.42, PAL.yellow, 0, 'hazard'), x, 0.9, z);
}
function pipe(x0, y0, z0, x1, y1, z1, r, color = PAL.sand2) {
  _a.set(x0, y0, z0); _b.set(x1, y1, z1);
  const m = cyl(r, r, _a.distanceTo(_b), color, 0, 14, 'rusty');
  m.position.copy(_a).lerp(_b, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _b.clone().sub(_a).normalize()); place(m);
  for (const p of [_a, _b]) { const j = cyl(r * 1.25, r * 1.25, r * 0.7, 0x8a6a40, 0, 14, 'metal'); j.position.copy(p); j.quaternion.copy(m.quaternion); place(j); }
}
function billboard(x, z, rotY, lines, h = 10) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  for (const sx of [-4, 4]) { const p = cyl(0.3, 0.3, h, PAL.dark, 0, 8, 'metal'); p.position.set(sx, h / 2, 0); g.add(p); }
  const fr = box(11, 5.6, 0.5, 0x2a2a2a, 0, 'metal'); fr.position.set(0, h + 2.5, 0); g.add(fr);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 5.1), toonTex(signTex(lines))); s.position.set(0, h + 2.5, 0.27); g.add(s);
  const wk = box(11, 0.2, 1.2, PAL.steel, 0, 'metal'); wk.position.set(0, h - 0.4, 0.6); g.add(wk);
  for (let i = -2; i <= 2; i++) { const l = box(0.5, 0.3, 0.6, PAL.dark, 0, 'metal'); l.position.set(i * 2.4, h + 5.6, 0.5); g.add(l); }
  g.updateMatrixWorld(true);
  [...g.children].forEach(c => { c.applyMatrix4(g.matrixWorld); place(c); });
}
function waterTower(x, z) {
  for (const [a, b] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) beam(x + a, 0, z + b, x + a * 0.7, 14, z + b * 0.7, 0.4, PAL.steel);
  place(cyl(4, 4, 6, 0xc9b48c, 0, 18, 'rusty'), x, 17, z);
  place(cyl(0.3, 4.4, 2.5, PAL.rust, 0, 18, 'rusty'), x, 21.2, z);
  place(cyl(4.3, 4.3, 0.5, PAL.dark, 0, 18, 'metal'), x, 14.2, z);
}
function crane(x, z) {
  trussTower(x, z, 2.4, 30, PAL.yellow, 3);
  trussSpan(x - 8, x + 26, 30, z, 2, PAL.yellow);
  place(box(4, 3, 3, PAL.yellow, 0, 'metal'), x, 33.5, z);
  place(box(5, 2, 2.5, PAL.dark, 0, 'metal'), x - 9, 29, z);
  beam(x + 20, 30, z, x + 20, 18, z, 0.06, 0x222222);
  place(box(1.6, 1.2, 1.6, PAL.dark, 0, 'rusty'), x + 20, 17.4, z);
}

export function buildProps() {
  sd = 11; // 每次重建废品场都一样
  const W = ARENA + 3;
  // ---- 外围：集装箱墙 ----
  for (let i = -W; i < W; i += 6.2) {
    for (const side of [0, 1, 2, 3]) {
      const x = side < 2 ? i + 3.05 : (side === 2 ? -W : W), z = side < 2 ? (side === 0 ? -W : W) : i + 3.05;
      const n = 1 + (R() < 0.55 ? 1 : 0) + (R() < 0.25 ? 1 : 0);
      for (let k = 0; k < n; k++) container(x + (R() - .5) * .4, k * 2.6, z + (R() - .5) * .4, side >= 2, CONT[(R() * 5) | 0]);
    }
  }
  // ---- 场内掩体 ----
  [[-12, -8, 0, 2], [14, -14, 1, 1], [-20, 12, 0, 1], [18, 10, 0, 2], [0, -20, 1, 1], [-6, 22, 0, 1], [24, -2, 1, 1], [-30, -10, 1, 2], [-28, 28, 0, 1], [30, 30, 0, 1]]
    .forEach(([x, z, r, n], i) => { for (let k = 0; k < n; k++) container(x + k * 0.6, k * 2.6, z, r, CONT[(i + k) % 5]); });
  [[6, 6, 0], [-4, -4, 1], [10, -26, 0], [-16, 4, 1], [-22, -24, 0], [22, 22, 1], [0, 32, 0], [36, -14, 1]].forEach(([x, z, r]) => barrier(x, z, r));
  [[8, 14, 3], [-26, 0, 4], [26, -24, 2], [-8, 34, 3], [38, 2, 3]].forEach(([x, z, n]) => tires(x, z, n));
  [[-14, -18], [12, 24], [-34, 18], [32, -30], [-2, 12]].forEach(([x, z]) => {
    barrel(x, z, 0xc2452d); barrel(x + 1, z + .2, 0x3a7ca5); if (R() < .6) barrel(x + .4, z + 1, PAL.yellow);
  });
  // ---- 北侧高架天桥 + 楼梯 ----
  placeBox(box(26, 0.6, 4, PAL.steel, 0, 'metal'), -2, 4.2, -30);
  for (const zz of [-32.05, -27.95]) place(box(26, 0.22, 0.12, PAL.yellow, 0, 'hazard'), -2, 4.56, zz);
  for (let x = -15; x <= 11; x += 2) for (const zz of [-31.9, -28.1]) beam(x, 4.5, zz, x, 5.6, zz, 0.1, PAL.dark);
  for (const zz of [-31.9, -28.1]) beam(-15, 5.6, zz, 11, 5.6, zz, 0.12, PAL.dark);
  for (const x of [-15, -2, 11]) { place(cyl(0.4, 0.5, 3.9, PAL.dark, 0, 10, 'metal'), x, 1.95, -30); solid(x - .5, x + .5, 0, 3.9, -30.5, -29.5); }
  for (const [a, b] of [[-15, -2], [-2, 11]]) { beam(a, 0.3, -30, b, 3.9, -30, 0.18, PAL.dark); beam(b, 0.3, -30, a, 3.9, -30, 0.18, PAL.dark); }
  for (let s = 0; s < 9; s++) { const top = 0.5 * (s + 1); placeBox(box(1.2, top, 4, PAL.rust, 0, 'rusty'), 11.6 + (8 - s) * 1.2, top / 2, -30); }
  // ---- 东侧脚手架平台 ----
  placeBox(box(10, 0.5, 10, PAL.steel, 0, 'metal'), 33, 2.75, 13);
  for (const [x, z] of [[28.4, 8.4], [37.6, 8.4], [28.4, 17.6], [37.6, 17.6]]) { place(box(0.4, 2.5, 0.4, PAL.dark, 0, 'metal'), x, 1.25, z); solid(x - .2, x + .2, 0, 2.5, z - .2, z + .2); }
  place(box(10, 0.2, 0.15, PAL.yellow, 0, 'hazard'), 33, 3.1, 8.05);
  for (let s = 0; s < 6; s++) { const top = 0.5 * (s + 1); placeBox(box(3, top, 1.2, PAL.rust, 0, 'rusty'), 30, top / 2, 18.6 + (5 - s) * 1.2); }
  // ---- 天桥西端也加楼梯 ----
  stairs(-15.6, -30, -1, 'x', 9, 0.5, 1.2, 4);
  // ---- 南侧新天桥（两端楼梯）----
  placeBox(box(26, 0.6, 4, PAL.steel, 0, 'metal'), -7, 4.2, 33);
  for (const zz of [30.95, 35.05]) place(box(26, 0.22, 0.12, PAL.yellow, 0, 'hazard'), -7, 4.56, zz);
  for (let x = -20; x <= 6; x += 2) for (const zz of [31.1, 34.9]) beam(x, 4.5, zz, x, 5.6, zz, 0.1, PAL.dark);
  for (const zz of [31.1, 34.9]) beam(-20, 5.6, zz, 6, 5.6, zz, 0.12, PAL.dark);
  for (const x of [-20, -4, 6]) { place(cyl(0.4, 0.5, 3.9, PAL.dark, 0, 10, 'metal'), x, 1.95, 33); solid(x - .5, x + .5, 0, 3.9, 32.5, 33.5); }
  for (const [a, b] of [[-20, -4], [-4, 6]]) { beam(a, 0.3, 33, b, 3.9, 33, 0.18, PAL.dark); beam(b, 0.3, 33, a, 3.9, 33, 0.18, PAL.dark); }
  stairs(6.6, 33, 1, 'x', 9, 0.5, 1.2, 4); stairs(-20.6, 33, -1, 'x', 9, 0.5, 1.2, 4);
  // ---- 集装箱堆可以爬上去 ----
  stairs(-8.35, -8, 1, 'x', 10, 0.52, 1.0, 2.2);
  PLATFORMS.push(
    { x0: -15, x1: 11, z0: -32, z1: -28, top: 4.5, stairs: [{ bx: 23, bz: -30, tx: 10, tz: -30, x0: 11, x1: 22.4, z0: -32, z1: -28 }, { bx: -27, bz: -30, tx: -14, tz: -30, x0: -26.4, x1: -15, z0: -32, z1: -28 }] },
    { x0: 28, x1: 38, z0: 8, z1: 18, top: 3.0, stairs: [{ bx: 30, bz: 26.5, tx: 30, tz: 16.5, x0: 28.5, x1: 31.5, z0: 18, z1: 25.8 }] },
    { x0: -20, x1: 6, z0: 31, z1: 35, top: 4.5, stairs: [{ bx: 17.5, bz: 33, tx: 5, tz: 33, x0: 6, x1: 16.8, z0: 31, z1: 35 }, { bx: -31.5, bz: 33, tx: -19, tz: 33, x0: -30.8, x1: -20, z0: 31, z1: 35 }] },
    { x0: -14.4, x1: -8.4, z0: -9.2, z1: -6.8, top: 5.2, stairs: [{ bx: 2.2, bz: -8, tx: -9.6, tz: -8, x0: -8.9, x1: 1.6, z0: -9.1, z1: -6.9 }] },
  );
  // ---- 龙门吊（横跨场地，高处）----
  for (const x of [-22, 24]) { trussTower(x, 2, 1.6, 12, PAL.yellow, 3); solid(x - 1, x + 1, 0, 12, 1, 3); }
  trussSpan(-22, 24, 12, 2, 1.8, PAL.yellow);
  place(box(3, 1.6, 2.6, PAL.yellow, 0, 'metal'), 4, 11.4, 2); beam(4, 11, 2, 4, 6.5, 2, 0.05, 0x222222); place(box(0.6, 0.8, 0.6, PAL.dark, 0, 'metal'), 4, 6.2, 2);
  // ---- 管道 ----
  // 地面管道紧贴西侧集装箱墙，不留夹道
  pipe(-46.5, 1.3, -40, -46.5, 1.3, 34, 1.1); solid(-47.8, -45.3, 0, 2.4, -40, 34);
  for (let z = -36; z < 34; z += 8) place(box(2.4, 0.5, 0.6, PAL.dark, 0, 'metal'), -46.5, 0.25, z);
  pipe(-46.5, 1.3, 34, -46.5, 9, 34, 1.1); pipe(-46.5, 9, 38, 60, 9, 38, 1.4); pipe(-46.5, 9, 34, -46.5, 9, 38, 1.1);
  for (const x of [-20, 0, 20, 40]) { place(box(0.5, 9, 0.5, PAL.dark, 0, 'metal'), x, 4.5, 40.5); }
  pipe(-20, 15, -62, 40, 15, -62, 2.2, 0xc9b48c); pipe(40, 15, -62, 40, 0, -62, 2.2, 0xc9b48c);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(9, 1.6, 10, 26, Math.PI), toon(0xd9b878, 'rusty')); arc.rotation.y = Math.PI / 2; place(arc, -62, 0, -12);
  // ---- 广告牌 ----
  billboard(-6, -62, 0, [['SCRAP YARD', 92, 110], ['废品场 · 欢迎光临', 34, 190, '#e8431f']], 11);
  billboard(-64, 18, Math.PI / 2, [['YOUR AD', 100, 105, '#e8431f'], ['HERE', 70, 185]], 9);
  billboard(62, -22, -Math.PI / 2, [['RIOT!', 130, 128, '#e8431f']], 12);
  // ---- 远景 ----
  waterTower(64, 58); crane(-66, -58);
  trussTower(70, -70, 4, 34, PAL.steel, 4); trussTower(-80, 40, 3.5, 26, PAL.rust, 4);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, r = 110 + R() * 50, h = 10 + R() * 26;
    place(box(8 + R() * 14, h, 8 + R() * 10, R() < .5 ? 0xb9a27a : 0xa58f6a, 0, 'metal'), Math.cos(a) * r, h / 2, Math.sin(a) * r);
    if (R() < .5) place(cyl(1, 1.6, 20 + R() * 20, 0x9a8a72, 0, 10, 'rusty'), Math.cos(a) * r + 6, 14, Math.sin(a) * r);
  }
}

export { R as rnd, CONT, stairs, trussTower, trussSpan, container, barrel, tires, barrier, pipe, billboard, waterTower, crane };
