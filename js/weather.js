import * as THREE from 'three';
import { mapEnv, envFlash } from './world.js';
import { NO_INK } from './post.js';

// 天气：调车场下雨 + 偶尔打雷闪电；炼钢厂空中飘火星。粒子盒子跟着镜头走
export const wHooks = { thunder: null };
let rain, embers, kind = null, flashT = 0, nextBolt = 6, boltK = 0;
const RN = 1100, EN = 320, BOX = 44, RH = 26;
export function initWeather(scene) {
  const rp = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { rp[i * 6] = (Math.random() - .5) * BOX; rp[i * 6 + 1] = Math.random() * RH; rp[i * 6 + 2] = (Math.random() - .5) * BOX; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xdde6ee, transparent: true, opacity: 0.45, depthWrite: false }));
  rain.frustumCulled = false; rain.layers.set(NO_INK); rain.visible = false; scene.add(rain);
  const ep = new Float32Array(EN * 3), ev = new Float32Array(EN);
  for (let i = 0; i < EN; i++) { ep[i * 3] = (Math.random() - .5) * BOX * 1.4; ep[i * 3 + 1] = Math.random() * 18; ep[i * 3 + 2] = (Math.random() - .5) * BOX * 1.4; ev[i] = 0.6 + Math.random() * 1.6; }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); eg.userData.v = ev;
  embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa23a, size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false; embers.layers.set(NO_INK); embers.visible = false; scene.add(embers);
}
export function setWeather(k) {
  kind = k; rain.visible = k === 'rain'; embers.visible = k === 'embers';
  flashT = 0; boltK = 0; nextBolt = 5 + Math.random() * 6; envFlash(0);
}
export function updateWeather(dt, cam) {
  if (kind === 'rain') {
    const a = rain.geometry.attributes.position.array, cx = cam.position.x, cz = cam.position.z, cy = cam.position.y;
    const fx = -2.2 * dt, fy = -30 * dt;
    for (let i = 0; i < RN; i++) {
      const o = i * 6; let x = a[o] + fx, y = a[o + 1] + fy, z = a[o + 2];
      // 盒子跟镜头：出界就从另一侧补回来
      if (y < cy - 4 || y < 0) { y += RH; x = cx + (Math.random() - .5) * BOX; z = cz + (Math.random() - .5) * BOX; }
      if (x < cx - BOX / 2) x += BOX; else if (x > cx + BOX / 2) x -= BOX;
      if (z < cz - BOX / 2) z += BOX; else if (z > cz + BOX / 2) z -= BOX;
      a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = x + 0.08; a[o + 4] = y + 0.9; a[o + 5] = z;
    }
    rain.geometry.attributes.position.needsUpdate = true;
    // 闪电：两下连闪，1 秒后打雷
    if ((nextBolt -= dt) <= 0) { nextBolt = 9 + Math.random() * 10; flashT = 0.55; setTimeout(() => wHooks.thunder && wHooks.thunder(), 500 + Math.random() * 700); }
    if (flashT > 0) { flashT -= dt; const t = 0.55 - flashT; boltK = t < 0.08 ? 1 : t < 0.18 ? 0.15 : t < 0.26 ? 0.8 : Math.max(0, 0.8 - (t - 0.26) * 3); envFlash(boltK); if (flashT <= 0) envFlash(0); }
  } else if (kind === 'embers') {
    const g = embers.geometry, a = g.attributes.position.array, v = g.userData.v, cx = cam.position.x, cz = cam.position.z, S = BOX * 0.7, T = performance.now() / 1000;
    for (let i = 0; i < EN; i++) {
      const o = i * 3; let x = a[o] + Math.sin(T * 1.3 + i) * 0.6 * dt, y = a[o + 1] + v[i] * dt, z = a[o + 2] + Math.cos(T * 1.1 + i * 0.7) * 0.6 * dt;
      if (y > 18) { y = 0.2; x = cx + (Math.random() - .5) * 2 * S; z = cz + (Math.random() - .5) * 2 * S; }
      if (x < cx - S) x += 2 * S; else if (x > cx + S) x -= 2 * S;
      if (z < cz - S) z += 2 * S; else if (z > cz + S) z -= 2 * S;
      a[o] = x; a[o + 1] = y; a[o + 2] = z;
    }
    g.attributes.position.needsUpdate = true;
  }
}
export const weatherFlash = () => boltK;
