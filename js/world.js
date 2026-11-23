import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, toonTex, TEX, PAL } from './art.js';
import { buildProps } from './props.js';

export const solids = []; // AABB {x0,x1,y0,y1,z0,z1}
export const clouds = [];
export let skyMesh = null; // 天空球跟随镜头，避免被远裁剪面切出黑洞
export const ARENA = 46;

// 静态物体先放进 staticGroup，最后按材质合并成少量网格（省 draw call）
let staticGroup;
export function place(mesh, x = mesh.position.x, y = mesh.position.y, z = mesh.position.z) {
  mesh.position.set(x, y, z); staticGroup.add(mesh); return mesh;
}
export function solid(x0, x1, y0, y1, z0, z1) { solids.push({ x0, x1, y0, y1, z0, z1 }); }
// 放一个轴对齐盒子并登记碰撞
export function placeBox(mesh, x, y, z) {
  place(mesh, x, y, z);
  const s = mesh.scale; solid(x - s.x / 2, x + s.x / 2, y - s.y / 2, y + s.y / 2, z - s.z / 2, z + s.z / 2);
  return mesh;
}

function bake(scene) {
  staticGroup.updateMatrixWorld(true);
  const byMat = new Map();
  staticGroup.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  for (const [mat, list] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(list, false), mat);
    m.castShadow = m.receiveShadow = true;
    scene.add(m); list.forEach(g => g.dispose());
  }
}

function sky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { storm: { value: 0 } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying float h; uniform float storm; void main(){
      vec3 top = vec3(0.30,0.62,0.86), mid = vec3(0.62,0.82,0.93), hor = vec3(0.96,0.90,0.76);
      vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.7, h)) : mix(hor, mid, smoothstep(-0.02, 0.18, h));
      c = mix(c, mix(vec3(0.68,0.55,0.36), vec3(0.83,0.70,0.48), smoothstep(0.4, -0.1, h)), storm);
      gl_FragColor = vec4(c, 1.);
      #include <colorspace_fragment>
    }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(330, 24, 12), mat); s.renderOrder = -1; s.frustumCulled = false; scene.add(s);
  skyMesh = s;
  // 卡通云：几团压扁的球，带描边
  const cm = toon(0xffffff, null); const cm2 = toon(0xdbe8ef, null);
  const g = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + Math.random() * 0.3, R = 200 + Math.random() * 60, y = 45 + Math.random() * 45;
    const cl = new THREE.Group(); cl.position.set(Math.cos(a) * R, y, Math.sin(a) * R); cl.lookAt(0, y, 0);
    const n = 4 + (Math.random() * 4 | 0);
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(g, k % 3 === 2 ? cm2 : cm); const r = 7 + Math.random() * 9;
      p.scale.set(r * 1.4, r * 0.75, r); p.position.set((k - n / 2) * 10 + Math.random() * 5, Math.random() * 5 - (k % 2) * 3, Math.random() * 6);
      cl.add(p);
    }
    scene.add(cl); clouds.push(cl);
  }
  scene.traverse(o => { if (o.material && o.material.isMeshToonMaterial && (o.material === cm || o.material === cm2)) o.material.fog = false; });
}

export function buildWorld(scene) {
  solids.length = 0;
  staticGroup = new THREE.Group();
  scene.fog = new THREE.Fog(0xf2dfb4, 70, 240);
  scene.add(new THREE.HemisphereLight(0xfff3d6, 0x9a7448, 1.15));
  // 太阳投硬阴影（美漫的黑影块，阴影里会自动叠上排线）
  const sun = new THREE.DirectionalLight(0xfff6e6, 3.1); sun.position.set(40, 60, 25); scene.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 160 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  sky(scene);
  // 地面
  const gt = TEX.ground.clone(); gt.repeat.set(36, 36); gt.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), toonTex(gt));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  buildProps();
  bake(scene);
}

// ---------- 物理查询 ----------
// 在 (cx,cz) 周围 dmin~dmax 的环里找一块空地（不压实体、在场内），找不到返回 null
export function findSpot(cx, cz, dmin, dmax, r = 1.2, tries = 40) {
  for (let k = 0; k < tries; k++) {
    const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (Math.abs(x) > ARENA - 4 || Math.abs(z) > ARENA - 4) continue;
    if (solids.some(s => s.y0 < 2 && x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1)) continue;
    return { x, z };
  }
  return null;
}
export function resolve(p, r, h) {
  for (const s of solids) {
    if (p.y + h <= s.y0 + 0.05 || p.y >= s.y1 - 0.05) continue;
    if (s.y1 - p.y <= 0.56) continue; // 不高于一级台阶的直接跨上去（groundAt 会把人抬高）
    if (p.x + r > s.x0 && p.x - r < s.x1 && p.z + r > s.z0 && p.z - r < s.z1) {
      const dx = Math.min(p.x + r - s.x0, s.x1 - (p.x - r));
      const dz = Math.min(p.z + r - s.z0, s.z1 - (p.z - r));
      if (dx < dz) p.x += (p.x < (s.x0 + s.x1) / 2 ? -dx : dx);
      else p.z += (p.z < (s.z0 + s.z1) / 2 ? -dz : dz);
    }
  }
}
export function groundAt(x, z, r, y) {
  let g = 0;
  for (const s of solids) {
    if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1 && s.y1 <= y + 0.55 && s.y1 > g) g = s.y1;
  }
  return g;
}
export function rayWorld(o, d, max) {
  let best = Infinity;
  for (const s of solids) {
    let t0 = 0, t1 = max;
    for (const [oo, dd, lo, hi] of [[o.x, d.x, s.x0, s.x1], [o.y, d.y, s.y0, s.y1], [o.z, d.z, s.z0, s.z1]]) {
      if (Math.abs(dd) < 1e-8) { if (oo < lo || oo > hi) { t0 = 1e9; break; } continue; }
      let a = (lo - oo) / dd, b = (hi - oo) / dd; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { t0 = 1e9; break; }
    }
    if (t0 < 1e9 && t0 < best) best = t0;
  }
  if (d.y < 0) { const t = -o.y / d.y; if (t > 0 && t < best && t < max) best = t; }
  return best;
}
