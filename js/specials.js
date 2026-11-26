import * as THREE from 'three';
import { P } from './player.js';
import { skyMesh, applyEnv, mapEnv } from './world.js';

// 特殊关环境：沙尘暴（浓雾 + 风 + 沙粒），其它特殊关只改规则不改环境
let scene, cur = null, windA = 0;
export function initSpecials(s) { scene = s; }
export function setSpecial(kind) {
  cur = kind;
  const storm = kind === 'storm';
  applyEnv(storm); // 先恢复当前地图的雾和光，再按沙尘暴覆盖
  if (storm) { scene.fog.color.setHex(0xd4b27a); scene.fog.near = 5; scene.fog.far = 40; }
  if (skyMesh) skyMesh.material.uniforms.storm.value = storm ? 1 : 0;
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
