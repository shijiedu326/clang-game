import * as THREE from 'three';
import { P } from './player.js';
import { skyMesh, clouds } from './world.js';

// 特殊关环境：沙尘暴（浓雾 + 风 + 沙粒），其它特殊关只改规则不改环境
const NORMAL = { color: 0xf2dfb4, near: 70, far: 240 };
let scene, cur = null, windA = 0;
export function initSpecials(s) { scene = s; }
export function setSpecial(kind) {
  cur = kind;
  const storm = kind === 'storm';
  scene.fog.color.setHex(storm ? 0xd4b27a : NORMAL.color);
  scene.fog.near = storm ? 5 : NORMAL.near; scene.fog.far = storm ? 40 : NORMAL.far;
  if (skyMesh) skyMesh.material.uniforms.storm.value = storm ? 1 : 0;
  clouds.forEach(c => c.visible = !storm);
  document.getElementById('storm').classList.toggle('on', storm);
  P.wind = storm ? new THREE.Vector3() : null;
}
export function updateSpecials(dt) {
  if (cur === 'storm' && P.wind) {
    windA += dt * 0.15;
    const g = 0.6 + Math.max(0, Math.sin(windA * 3.1)) * 1.2; // 阵风
    P.wind.set(Math.cos(windA) * g, 0, Math.sin(windA) * g);
    document.getElementById('storm').style.setProperty('--wa', (Math.atan2(P.wind.z, P.wind.x) * 180 / Math.PI - P.yaw * 57.3) + 'deg');
  }
}
