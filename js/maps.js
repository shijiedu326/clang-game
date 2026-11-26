import * as THREE from 'three';
import { box, cyl, toon, toonTex, signTex, PAL } from './art.js';
import { place, placeBox, solid, registerMap, ARENA } from './world.js';
import { PLATFORMS, beam, stairs, trussTower, trussSpan, container, barrel, CONT } from './props.js';

// 两张新地图：夜晚炼钢厂（11～20 关）、铁路调车场（21～30 关）。出生点 (0,0,8) 周围都留空
let sd = 5; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
const glowM = new Map();
function glowMat(c) { if (!glowM.has(c)) glowM.set(c, new THREE.MeshBasicMaterial({ color: c, fog: true })); return glowM.get(c); }
// 发光件：不描边、不投影（钢水、窗户、灯头）
function glowBox(w, h, d, c, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glowMat(c)); m.userData.glow = true; return place(m, x, y, z); }
function glowCyl(rt, rb, h, c, x, y, z, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), glowMat(c)); m.userData.glow = true; return place(m, x, y, z); }
function pl(ctx, c, I, d, x, y, z) { const l = new THREE.PointLight(c, I, d, 1.6); l.position.set(x, y, z); ctx.lights.add(l); return l; }

// 高台：台面 + 立柱，sx/sz 为楼梯（axis x：从 x 端往外下）
function deck(x0, x1, z0, z1, top, color = PAL.dark) {
  placeBox(box(x1 - x0, 0.3, z1 - z0, color, 0, 'metal'), (x0 + x1) / 2, top - 0.15, (z0 + z1) / 2);
  for (const x of [x0 + 0.3, x1 - 0.3]) for (const z of [z0 + 0.3, z1 - 0.3]) { place(box(0.3, top - 0.3, 0.3, PAL.steel, 0, 'metal'), x, (top - 0.3) / 2, z); solid(x - .15, x + .15, 0, top - .3, z - .15, z + .15); }
  // 栏杆（只做外沿两根扶手，不挡人）
  for (const z of [z0, z1]) beam(x0, top + 1, z, x1, top + 1, z, 0.08, PAL.yellow);
}
// 沿 x 方向的楼梯：从 (xs, z) 开始往 dir 方向下，返回给 PLATFORMS 用的楼梯描述
function flightX(xs, z, dir, top, w, color) {
  const rise = 0.5, run = 0.9, n = Math.round(top / rise);
  stairs(xs + dir * run / 2, z, dir, 'x', n, rise, run, w);
  const xe = xs + dir * n * run;
  return { bx: xe + dir * 1.2, bz: z, tx: xs - dir * 1, tz: z, x0: Math.min(xs, xe), x1: Math.max(xs, xe), z0: z - w / 2, z1: z + w / 2 };
}
function flightZ(x, zs, dir, top, w) {
  const rise = 0.5, run = 0.9, n = Math.round(top / rise);
  stairs(x, zs + dir * run / 2, dir, 'z', n, rise, run, w);
  const ze = zs + dir * n * run;
  return { bx: x, bz: ze + dir * 1.2, tx: x, tz: zs - dir * 1, x0: x - w / 2, x1: x + w / 2, z0: Math.min(zs, ze), z1: Math.max(zs, ze) };
}

// ================= 夜晚炼钢厂 =================
const MILL = { wall: 0x3b4252, wall2: 0x4b5163, trim: 0x2a2e38, coil: 0x8a9098, ladle: 0x4a3f3a, hot: 0xff8a1f, hot2: 0xffc23a, win: 0xffb347 };
function coilStack(x, z, n, rotY) {
  // 卧放的钢卷，一排 n 个，上面再压一层
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 2.3;
    const cx = rotY ? x : x + off, cz = rotY ? z + off : z;
    const c = cyl(1.05, 1.05, 1.9, MILL.coil, 0, 18, 'metal');
    if (rotY) { c.rotation.set(0, 0, Math.PI / 2); } else { c.rotation.set(Math.PI / 2, 0, 0); }
    place(c, cx, 1.05, cz);
    const hole = cyl(0.45, 0.45, 1.95, 0x1a1c22, 0, 12, 'plain'); hole.rotation.copy(c.rotation); place(hole, cx, 1.05, cz);
  }
  const L = n * 2.3;
  solid(rotY ? x - 1 : x - L / 2, rotY ? x + 1 : x + L / 2, 0, 2.1, rotY ? z - L / 2 : z - 1, rotY ? z + L / 2 : z + 1);
  if (n >= 3) {
    for (let i = 0; i < n - 1; i++) {
      const off = (i - (n - 2) / 2) * 2.3, cx = rotY ? x : x + off, cz = rotY ? z + off : z;
      const c = cyl(1.05, 1.05, 1.9, 0x9aa1a8, 0, 18, 'metal'); if (rotY) c.rotation.set(0, 0, Math.PI / 2); else c.rotation.set(Math.PI / 2, 0, 0); place(c, cx, 2.9, cz);
    }
    const L2 = (n - 1) * 2.3;
    solid(rotY ? x - 1 : x - L2 / 2, rotY ? x + 1 : x + L2 / 2, 2.1, 3.95, rotY ? z - L2 / 2 : z - 1, rotY ? z + L2 / 2 : z + 1);
  }
}
function ladleCar(ctx, x, z) {
  // 平板车 + 钢水包（上面一圈亮橙色钢水）
  placeBox(box(6, 1.0, 3.2, MILL.trim, 0, 'metal'), x, 0.7, z);
  for (const dx of [-2, 2]) for (const dz of [-1.7, 1.7]) { const w = cyl(0.5, 0.5, 0.3, 0x1c1c1c, 0, 12, 'metal'); w.rotation.x = Math.PI / 2; place(w, x + dx, 0.5, z + dz); }
  place(cyl(2.0, 1.5, 3.2, MILL.ladle, 0, 18, 'rusty'), x, 2.8, z);
  place(cyl(2.15, 2.15, 0.35, 0x2b2522, 0, 18, 'metal'), x, 4.3, z);
  glowCyl(1.85, 1.85, 0.1, MILL.hot, x, 4.42, z);
  for (const dz of [-2.1, 2.1]) place(box(0.5, 0.9, 0.5, 0x2b2522, 0, 'metal'), x, 3.4, z + dz);
  solid(x - 2, x + 2, 1.2, 4.4, z - 2, z + 2);
  pl(ctx, MILL.hot, 26, 16, x, 6, z);
}
function furnaceMouth(ctx, x, z) {
  // 北墙上的炉口：厚砖框 + 亮口 + 下方钢水槽口
  placeBox(box(10, 8, 3, 0x5a3a30, 0, 'rusty'), x, 4, z);
  glowBox(4.6, 3.6, 0.2, MILL.hot2, x, 2.6, z + 1.55);
  place(box(5.4, 0.6, 0.6, 0x2b2522, 0, 'metal'), x, 4.7, z + 1.7);
  place(box(0.6, 3.6, 0.6, 0x2b2522, 0, 'metal'), x - 2.6, 2.6, z + 1.7); place(box(0.6, 3.6, 0.6, 0x2b2522, 0, 'metal'), x + 2.6, 2.6, z + 1.7);
  place(cyl(1.2, 1.6, 14, 0x3c3433, 0, 14, 'rusty'), x, 15, z - 0.4);
  pl(ctx, MILL.hot, 60, 22, x, 3, z + 4);
}
function bigFurnace(x, z, h) {
  // 墙外远景：高炉 + 烟囱（不碰撞）
  place(cyl(5, 7, h, 0x2f3340, 0, 18, 'rusty'), x, h / 2, z);
  place(cyl(3, 5, 6, 0x3a3e4a, 0, 18, 'metal'), x, h + 3, z);
  glowCyl(2.6, 2.6, 0.6, MILL.hot, x, h + 6.2, z);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; beam(x + Math.cos(a) * 8, 0, z + Math.sin(a) * 8, x + Math.cos(a) * 4, h * 0.8, z + Math.sin(a) * 4, 0.5, 0x2a2e38); }
  place(cyl(1.4, 1.8, h * 1.5, 0x3a3e4a, 0, 12, 'rusty'), x + 10, h * 0.75, z + 6);
  for (const k of [0.6, 0.8]) place(cyl(1.9, 1.9, 0.5, 0xd8432a, 0, 12, 'plain'), x + 10, h * 1.5 * k, z + 6);
}
function millWall(x, z, len, alongX, h) {
  // 厂房外墙：波纹板 + 立柱 + 高处一排亮窗
  const W = alongX ? len : 1.2, D = alongX ? 1.2 : len;
  placeBox(box(W, h, D, MILL.wall, 0, 'ribbed'), x, h / 2, z);
  const n = Math.round(len / 8);
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + i * len / n, px = alongX ? x + t : x, pz = alongX ? z : z + t;
    place(box(alongX ? 0.8 : 1.8, h + 0.6, alongX ? 1.8 : 0.8, MILL.trim, 0, 'metal'), px, (h + 0.6) / 2, pz);
    if (i < n) {
      const m = t + len / n / 2, wx = alongX ? x + m : x, wz = alongX ? z : z + m, s = Math.sign(alongX ? -z : -x);
      glowBox(alongX ? 4.4 : 0.1, 1.4, alongX ? 0.1 : 4.4, MILL.win, wx + (alongX ? 0 : s * 0.62), h - 1.8, wz + (alongX ? s * 0.62 : 0));
    }
  }
  place(box(W + 0.6, 0.5, D + 0.6, MILL.trim, 0, 'metal'), x, h + 0.25, z);
}

export function buildMill(ctx) {
  sd = 5;
  const W = ARENA + 2, H = 11;
  millWall(0, -W, 2 * W + 2, true, H); millWall(0, W, 2 * W + 2, true, H);
  millWall(-W, 0, 2 * W, false, H); millWall(W, 0, 2 * W, false, H);
  // 远景高炉
  bigFurnace(-30, -80, 34); bigFurnace(40, -90, 40); bigFurnace(85, 20, 30); bigFurnace(-90, 30, 36);
  // 屋顶桁架（很高，只是看着有厂房感）
  for (const z of [-30, -10, 10, 30]) trussSpan(-W, W, 17, z, 1.6, 0x2c3140);
  // ---- 北侧：两个炉口 + 钢水槽 ----
  furnaceMouth(ctx, -26, -W + 2); furnaceMouth(ctx, 26, -W + 2);
  // 钢水槽沿 x 横穿，两侧矮墙，中间亮橙色（整体算障碍，跳不进去）
  const tz = -24;
  for (const [a, b] of [[-34, -5], [5, 34]]) {
    placeBox(box(b - a, 1.0, 0.5, 0x4a3a33, 0, 'rusty'), (a + b) / 2, 0.5, tz - 1.25); placeBox(box(b - a, 1.0, 0.5, 0x4a3a33, 0, 'rusty'), (a + b) / 2, 0.5, tz + 1.25);
    glowBox(b - a, 0.1, 2.0, MILL.hot, (a + b) / 2, 0.8, tz); solid(a, b, 0, 0.9, tz - 1, tz + 1);
    pl(ctx, MILL.hot, 40, 22, (a + b) / 2, 2.4, tz);
  }
  // 中间留口子，盖一块铁板当桥
  place(box(10, 0.3, 3.6, 0x30343c, 0, 'metal'), 0, 0.15, tz);
  // 槽从炉口引出的两段斜沟
  for (const x of [-26, 26]) { glowBox(1.4, 0.1, 19, MILL.hot, x, 0.62, -35); placeBox(box(0.4, 0.7, 19, 0x4a3a33, 0, 'rusty'), x - 0.9, 0.35, -35); placeBox(box(0.4, 0.7, 19, 0x4a3a33, 0, 'rusty'), x + 0.9, 0.35, -35); solid(x - 0.7, x + 0.7, 0, 0.7, -44.5, -25.5); }
  // ---- 北侧走道（高台）横跨槽上方，两端楼梯 ----
  deck(-12, 12, -34, -30, 5, 0x30343c);
  PLATFORMS.push({ x0: -12, x1: 12, z0: -34, z1: -30, top: 5, stairs: [flightX(12, -32, 1, 5, 3), flightX(-12, -32, -1, 5, 3)] });
  // ---- 钢水包车 ----
  ladleCar(ctx, -27, 4); ladleCar(ctx, 27, -6);
  // ---- 钢卷堆 ----
  coilStack(14, 18, 3, false); coilStack(-15, 22, 3, false); coilStack(40, 32, 2, true); coilStack(-34, -8, 2, true); coilStack(-6, 32, 2, false);
  // ---- 立柱（掩体）----
  for (const [x, z] of [[-20, -12], [20, -14], [-10, 12], [10, -4], [-24, 30], [24, 36]]) {
    placeBox(box(1.1, 17, 1.1, MILL.trim, 0, 'metal'), x, 8.5, z);
    place(box(1.6, 1.6, 0.2, PAL.yellow, 0, 'hazard'), x, 1.2, z + 0.6);
  }
  // ---- 东南高台（控制室）+ 楼梯 ----
  deck(30, 40, 10, 18, 3.5, 0x30343c);
  place(box(8, 3, 6, 0x4b5163, 0, 'ribbed'), 35, 5.0, 14); solid(31, 39, 3.5, 6.5, 11, 17);
  glowBox(6, 1.1, 0.1, 0x9fd9ff, 35, 5.4, 10.95);
  PLATFORMS.push({ x0: 30, x1: 40, z0: 10, z1: 18, top: 3.5, stairs: [flightZ(32, 18, 1, 3.5, 2.6)] });
  // ---- 天车：吊着一包钢水在半空（不碰撞）----
  trussSpan(-W, W, 14, 0, 1.4, PAL.yellow);
  place(box(3.2, 1.6, 3.4, PAL.yellow, 0, 'metal'), -6, 13.3, 0);
  beam(-6.8, 13, 0, -6.8, 8.6, 0, 0.06, 0x222222); beam(-5.2, 13, 0, -5.2, 8.6, 0, 0.06, 0x222222);
  place(cyl(1.6, 1.2, 2.4, MILL.ladle, 0, 16, 'rusty'), -6, 7.6, 0); glowCyl(1.45, 1.45, 0.1, MILL.hot, -6, 8.82, 0);
  pl(ctx, MILL.hot, 30, 18, -6, 10, 0);
  // ---- 杂物：桶、警示牌 ----
  for (const [x, z] of [[6, 26], [7.2, 26.8], [-30, 16], [-29, 17.2], [38, -20], [-38, 38]]) barrel(x, z, R() < 0.5 ? 0x3a3f45 : 0xb5532c);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), toonTex(signTex(['HOT METAL', 'KEEP OUT'], '#f5c518', '#151515', '#e8431f')));
  sg.position.set(0, 8.5, -W + 0.65); place(sg);
  // 冷光补一盏，避免南边全黑
  pl(ctx, 0x8fb0ff, 18, 40, 0, 12, 30);
}

// ================= 铁路调车场（阴天下雨）=================
const RAIL = { rail: 0x7d8288, tie: 0x4a3a2e, box: [0x8e3b2a, 0x3f6178, 0x5b6e47, 0xa8742c], tank: [0x2f3236, 0xd9d2c0, 0x3a5a6e], loco: 0xf5c518 };
function track(z, x0, x1) {
  for (const dz of [-0.72, 0.72]) place(box(x1 - x0, 0.16, 0.14, RAIL.rail, 0, 'metal'), (x0 + x1) / 2, 0.2, z + dz);
  for (let x = x0 + 0.6; x < x1; x += 1.25) place(box(0.42, 0.12, 2.5, RAIL.tie, 0, 'wood'), x + (R() - .5) * 0.08, 0.06, z);
}
function bogies(x0, x1, z) {
  for (const x of [x0 + 1.8, x1 - 1.8]) {
    place(box(2.6, 0.5, 1.9, 0x23262a, 0, 'metal'), x, 0.75, z);
    for (const dx of [-0.75, 0.75]) for (const dz of [-0.72, 0.72]) { const w = cyl(0.45, 0.45, 0.16, 0x1c1c1c, 0, 12, 'metal'); w.rotation.x = Math.PI / 2; place(w, x + dx, 0.45, z + dz); }
  }
  place(box(x1 - x0, 0.3, 2.7, 0x2a2d31, 0, 'metal'), (x0 + x1) / 2, 1.15, z);
}
function boxcar(x0, x1, z, color, label) {
  bogies(x0, x1, z);
  placeBox(box(x1 - x0, 3.0, 2.9, color, 0, 'ribbed'), (x0 + x1) / 2, 2.8, z);
  solid(x0, x1, 0, 1.3, z - 1.4, z + 1.4);
  place(box(x1 - x0 + 0.1, 0.25, 3.0, 0x2a2d31, 0, 'metal'), (x0 + x1) / 2, 4.4, z);
  const m = (x0 + x1) / 2;
  const lm = label ? toonTex(signTex([label], '#e9e1cc', '#151515', '#e8431f')) : null;
  for (const s of [-1, 1]) {
    place(box(3.2, 2.6, 0.08, 0x2a2d31, 0, 'metal'), m, 2.7, z + s * 1.48); // 推拉门框
    if (label) { const t = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), lm); t.position.set(m - 3.9, 3.4, z + s * 1.5); if (s < 0) t.rotation.y = Math.PI; place(t); }
  }
}
function tankcar(x0, x1, z, color) {
  bogies(x0, x1, z);
  const L = x1 - x0 - 0.6, t = cyl(1.35, 1.35, L, color, 0, 18, 'metal'); t.rotation.z = Math.PI / 2; place(t, (x0 + x1) / 2, 2.65, z);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(color, 'metal')); c.scale.y = 0.35; c.rotation.z = -s * Math.PI / 2; place(c, (x0 + x1) / 2 + s * L / 2, 2.65, z); }
  place(cyl(0.5, 0.5, 0.5, 0x2a2d31, 0, 10, 'metal'), (x0 + x1) / 2, 4.1, z);
  place(box(L * 0.9, 0.08, 0.5, PAL.yellow, 0, 'hazard'), (x0 + x1) / 2, 2.65, z + 1.36);
  solid(x0 + 0.3, x1 - 0.3, 1.3, 4.0, z - 1.35, z + 1.35);
  solid(x0, x1, 0, 1.3, z - 1.4, z + 1.4);
}
function flatcar(x0, x1, z, cont) {
  bogies(x0, x1, z); solid(x0, x1, 0, 1.3, z - 1.4, z + 1.4);
  if (cont != null) container((x0 + x1) / 2, 1.3, z, false, cont);
}
function loco(x0, x1, z, dir) {
  // 调车机车：长机罩 + 一端驾驶室，黄黑警示条，车头灯亮
  bogies(x0, x1, z);
  const cab = dir > 0 ? x1 - 2.4 : x0 + 2.4, hood0 = dir > 0 ? x0 + 0.4 : x0 + 4.8, hood1 = dir > 0 ? x1 - 4.8 : x1 - 0.4;
  placeBox(box(hood1 - hood0, 2.3, 2.1, RAIL.loco, 0, 'metal'), (hood0 + hood1) / 2, 2.45, z);
  placeBox(box(3.6, 3.6, 2.8, RAIL.loco, 0, 'metal'), cab, 3.1, z);
  place(box(3.7, 0.4, 2.9, 0x23262a, 0, 'metal'), cab, 5.1, z);
  for (const s of [-1, 1]) place(box(2.4, 1.0, 0.06, 0x9fd9ff, 0, 'plain'), cab, 3.9, z + s * 1.42);
  place(box(x1 - x0, 0.3, 2.9, 0x151515, 0, 'hazard'), (x0 + x1) / 2, 1.42, z);
  const nose = dir > 0 ? x0 + 0.35 : x1 - 0.35;
  glowBox(0.1, 0.5, 0.5, 0xfff2b0, nose - dir * 0.05, 3.1, z);
  place(cyl(0.25, 0.3, 1.0, 0x23262a, 0, 10, 'metal'), (hood0 + hood1) / 2, 4.1, z);
}
function lamp(ctx, x, z, light) {
  place(cyl(0.14, 0.2, 8, PAL.dark, 0, 8, 'metal'), x, 4, z); solid(x - .2, x + .2, 0, 8, z - .2, z + .2);
  place(box(1.4, 0.2, 0.2, PAL.dark, 0, 'metal'), x + 0.6, 8, z);
  glowBox(0.7, 0.25, 0.45, 0xfff0c0, x + 1.1, 7.85, z);
  if (light) pl(ctx, 0xffe2a8, 30, 18, x + 1.1, 7.2, z);
}
function signal(x, z, c1, c2) {
  place(cyl(0.12, 0.12, 5, PAL.dark, 0, 8, 'metal'), x, 2.5, z);
  place(box(0.7, 1.6, 0.4, 0x151515, 0, 'metal'), x, 5.4, z);
  for (const [c, y] of [[c1, 5.85], [c2, 5.0]]) for (const s of [-1, 1]) glowCyl(0.2, 0.2, 0.1, c, x, y, z + s * 0.21).rotation.x = Math.PI / 2;
}

export function buildRail(ctx) {
  sd = 9;
  const W = ARENA + 3;
  // 外围：集装箱墙（颜色偏灰，和废品场区分）
  const CC = [0x6f4a3a, 0x3f6178, 0x7a7f74, 0x9a6a2c, 0x4d5a4a];
  for (let i = -W; i < W; i += 6.2) for (const side of [0, 1, 2, 3]) {
    const x = side < 2 ? i + 3.05 : (side === 2 ? -W : W), z = side < 2 ? (side === 0 ? -W : W) : i + 3.05;
    const n = 1 + (R() < 0.6 ? 1 : 0);
    for (let k = 0; k < n; k++) container(x + (R() - .5) * .4, k * 2.6, z + (R() - .5) * .4, side >= 2, CC[(R() * 5) | 0]);
  }
  // 轨道：碎石道床 + 钢轨 + 枕木（不碰撞）
  const TZ = [-28, -16, 4, 20, 32];
  for (const z of TZ) { place(box(2 * W - 2, 0.1, 3.6, 0x77736c, 0, 'plain'), 0, 0.05, z); track(z, -W + 1, W - 1); }
  // ---- 车厢（中间都留缺口能穿过去）----
  boxcar(-34, -22, -28, RAIL.box[0], 'SR-1042'); tankcar(-18, -7, -28, RAIL.tank[0]); boxcar(6, 18, -28, RAIL.box[1], 'SCRAP RIOT RR'); loco(24, 37, -28, -1);
  boxcar(-44, -32, -16, RAIL.box[2], 'SR-0077'); flatcar(-24, -12, -16, CONT[0]); tankcar(10, 21, -16, RAIL.tank[1]);
  boxcar(-42, -30, 4, RAIL.box[3], 'FRAGILE?'); flatcar(30, 42, 4, null);
  tankcar(-30, -19, 20, RAIL.tank[2]); boxcar(-14, -2, 20, RAIL.box[0], 'SR-2210'); flatcar(12, 24, 20, CONT[2]);
  loco(-38, -25, 32, 1); boxcar(-10, 2, 32, RAIL.box[1], 'SR-0909'); tankcar(14, 25, 32, RAIL.tank[0]);
  // ---- 东侧人行天桥：横跨三条轨道，两端楼梯 ----
  deck(32.5, 35.5, -8, 14, 5.5, 0x3a3f45);
  PLATFORMS.push({ x0: 32.5, x1: 35.5, z0: -8, z1: 14, top: 5.5, stairs: [flightZ(34, 14, 1, 5.5, 3), flightZ(34, -8, -1, 5.5, 3)] });
  // 天桥上的雨棚
  for (const z of [-7.6, 3, 13.6]) for (const x of [32.7, 35.3]) place(box(0.2, 2.6, 0.2, PAL.dark, 0, 'metal'), x, 6.8, z);
  place(box(4, 0.2, 22.4, 0x8e3b2a, 0, 'ribbed'), 34, 8.2, 3);
  // ---- 西北：信号楼（可以站上去的高台）----
  deck(-40, -30, -42, -36, 4.5, 0x3a3f45);
  place(box(6, 3, 4.4, 0xb5a98e, 0, 'plain'), -35, 6.0, -39.6); solid(-38, -32, 4.5, 7.5, -41.8, -37.4);
  glowBox(5, 1, 0.1, 0xfff0c0, -35, 6.3, -37.35);
  PLATFORMS.push({ x0: -40, x1: -30, z0: -42, z1: -36, top: 4.5, stairs: [flightX(-30, -37, 1, 4.5, 2)] });
  // ---- 信号灯、路灯、照明塔 ----
  for (const [x, z, a, b] of [[-46, -25.6, 0xff3b2a, 0x1f2a22], [46, -13.6, 0x1f2a22, 0x3bff7a], [-46, 6.4, 0xffc23a, 0x1f2a22], [46, 22.4, 0xff3b2a, 0x1f2a22]]) signal(x, z, a, b);
  for (const [x, z, l] of [[-20, -22, 1], [20, -22, 0], [-24, 12, 1], [22, 12, 1], [6, 26, 0], [-6, -9, 0]]) lamp(ctx, x, z, l);
  for (const [x, z] of [[-42, 42], [42, -42]]) {
    trussTower(x, z, 1.8, 16, PAL.steel, 4); solid(x - 1, x + 1, 0, 16, z - 1, z + 1);
    place(box(4, 1.6, 0.6, PAL.dark, 0, 'metal'), x, 16.8, z); glowBox(3.6, 1.2, 0.1, 0xfff6d8, x, 16.8, z + Math.sign(-z) * 0.32);
  }
  // ---- 杂物：枕木堆、油桶、水洼 ----
  for (const [x, z, r] of [[-8, -4, 0], [10, 12, 1], [-36, 26, 0], [28, 26.5, 1]]) {
    for (let k = 0; k < 3; k++) place(box(r ? 0.45 : 3.6, 0.3, r ? 3.6 : 0.45, RAIL.tie, 0, 'wood'), x + (r ? (k - 1) * 0.55 : 0), 0.15 + 0, z + (r ? 0 : (k - 1) * 0.55));
    for (let k = 0; k < 2; k++) place(box(r ? 0.45 : 3.6, 0.3, r ? 3.6 : 0.45, RAIL.tie, 0, 'wood'), x + (r ? (k - .5) * 0.55 : 0), 0.45, z + (r ? 0 : (k - .5) * 0.55));
    solid(x - (r ? 0.9 : 1.8), x + (r ? 0.9 : 1.8), 0, 0.6, z - (r ? 1.8 : 0.9), z + (r ? 1.8 : 0.9));
  }
  for (const [x, z] of [[16, -6], [17.1, -5.2], [-18, 10], [-28, -36], [40, 40]]) barrel(x, z, R() < 0.5 ? 0x3a5a6e : 0xb5532c);
  const pud = toon(0x56626c, 'plain');
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1, 18), pud); p.rotation.x = -Math.PI / 2;
    p.scale.set(1.2 + R() * 2.4, 0.8 + R() * 1.6, 1); p.rotation.z = R() * 3;
    let x, z; do { x = (R() - .5) * 84; z = (R() - .5) * 84; } while (TZ.some(t => Math.abs(z - t) < 2.6));
    place(p, x, 0.025, z);
  }
}

registerMap('mill', buildMill);
registerMap('rail', buildRail);
