import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, toonTex, TEX, PAL } from './art.js';
import { buildProps, PLATFORMS } from './props.js';

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

// 地图层：每张图的静态物体合并后放在 mapRoot 里，换图时整层拆掉重建
let mapRoot, mapLights, hemi, sun, ground, sceneRef;
function bake() {
  staticGroup.updateMatrixWorld(true);
  const byMat = new Map();
  staticGroup.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    const key = o.userData.glow ? 'g' : 's';
    if (!byMat.has(o.material)) byMat.set(o.material, { key, list: [] });
    byMat.get(o.material).list.push(g);
  });
  for (const [mat, { key, list }] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(list, false), mat);
    if (key === 'g') m.layers.set(1); else m.castShadow = m.receiveShadow = true; // 发光件（钢水、灯）不描边不投影
    mapRoot.add(m); list.forEach(g => g.dispose());
  }
}

const SKY_V = 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }';
const SKY_F = `varying vec3 vp; uniform float storm, stars; uniform vec3 top, mid, hor;
  float hsh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main(){
    float h = vp.y;
    vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.7, h)) : mix(hor, mid, smoothstep(-0.02, 0.18, h));
    if (stars > 0.) { vec3 q = floor(vp * 160.); float s = step(0.996, hsh(q)) * smoothstep(0.08, 0.4, h); c += vec3(s) * stars * (0.5 + 0.5 * hsh(q + 1.)); }
    c = mix(c, mix(vec3(0.68,0.55,0.36), vec3(0.83,0.70,0.48), smoothstep(0.4, -0.1, h)), storm);
    gl_FragColor = vec4(c, 1.);
    #include <colorspace_fragment>
  }`;
let moon; const cloudMats = [];
function sky(scene) {
  const c3 = h => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { storm: { value: 0 }, stars: { value: 0 }, top: { value: c3(0x4d9edb) }, mid: { value: c3(0x9ed1ed) }, hor: { value: c3(0xf5e6c2) } },
    vertexShader: SKY_V, fragmentShader: SKY_F,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(330, 24, 12), mat); s.renderOrder = -1; s.frustumCulled = false; scene.add(s);
  skyMesh = s;
  moon = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false }));
  moon.position.set(-150, 170, -200); moon.layers.set(1); moon.visible = false; s.add(moon);
  // 卡通云：几团压扁的球，带描边
  const cm = cloudMats[0] = toonTex(null, 0xffffff); const cm2 = cloudMats[1] = toonTex(null, 0xdbe8ef);
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
  cm.fog = cm2.fog = false;
}

// 每张地图的光线、雾、天空、地面、天气
export const MAPS = {
  yard: { name: '废品场', en: 'SCRAP YARD', fog: [0xf2dfb4, 70, 240], hemi: [0xfff3d6, 0x9a7448, 1.15], sun: [0xfff6e6, 3.1, 40, 60, 25], sky: [0x4d9edb, 0x9ed1ed, 0xf5e6c2], stars: 0, moon: false, clouds: [0xffffff, 0xdbe8ef], ground: 'ground', weather: null },
  mill: { name: '夜晚炼钢厂', en: 'NIGHT MILL', fog: [0x1f2236, 36, 170], hemi: [0x7c8ac8, 0x3a2418, 0.95], sun: [0xb4c8ff, 1.5, -40, 70, -30], sky: [0x070b1e, 0x1b2142, 0x4a2e3a], stars: 1, moon: true, clouds: null, ground: 'millFloor', weather: 'embers' },
  rail: { name: '铁路调车场', en: 'RAIL YARD', fog: [0x8f989e, 30, 165], hemi: [0xd6e0e6, 0x5a5550, 1.25], sun: [0xe4ecf2, 1.6, 30, 70, -20], sky: [0x5f6b74, 0x8b959c, 0xa9b0b2], stars: 0, moon: false, clouds: [0xb4bcc2, 0xa2abb1], ground: 'gravel', weather: 'rain' },
};
export let MAP = null;
export const mapEnv = () => MAPS[MAP || 'yard'];
export const mapForLevel = lv => ['yard', 'mill', 'rail'][Math.floor((lv - 1) / 10) % 3];
const builders = {};
export function registerMap(id, fn) { builders[id] = fn; }
const groundMats = {};
function groundMat(key) {
  if (!groundMats[key]) { const t = TEX[key].clone(); t.repeat.set(36, 36); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; groundMats[key] = toonTex(t); }
  return groundMats[key];
}

export function buildWorld(scene) {
  sceneRef = scene;
  scene.fog = new THREE.Fog(0xf2dfb4, 70, 240);
  hemi = new THREE.HemisphereLight(0xfff3d6, 0x9a7448, 1.15); scene.add(hemi);
  // 太阳投硬阴影（美漫的黑影块，阴影里会自动叠上排线）
  sun = new THREE.DirectionalLight(0xfff6e6, 3.1); sun.position.set(40, 60, 25); scene.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 180 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  sky(scene);
  ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), groundMat('ground'));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  mapRoot = new THREE.Group(); scene.add(mapRoot);
  mapLights = new THREE.Group(); scene.add(mapLights);
  registerMap('yard', buildProps);
  setMap('yard');
}
// 换地图：拆掉旧的合并网格/碰撞盒/台面，重建并换环境。返回 true 表示真的换了
export function setMap(id) {
  if (MAP === id || !builders[id]) return false;
  MAP = id;
  for (const m of [...mapRoot.children]) { mapRoot.remove(m); m.geometry.dispose(); }
  for (const l of [...mapLights.children]) mapLights.remove(l);
  solids.length = 0; PLATFORMS.length = 0;
  staticGroup = new THREE.Group();
  builders[id]({ lights: mapLights });
  bake();
  staticGroup = null;
  applyEnv();
  return true;
}
// 闪电：k 为 0～1 的亮度，叠在当前地图的光上
export function envFlash(k) { const E = mapEnv(); hemi.intensity = E.hemi[2] + k * 3; sun.intensity = E.sun[1] * (1 + k * 2); }
export function applyEnv(storm = false) {
  const E = mapEnv();
  sceneRef.fog.color.setHex(E.fog[0]); sceneRef.fog.near = E.fog[1]; sceneRef.fog.far = E.fog[2];
  hemi.color.setHex(E.hemi[0]); hemi.groundColor.setHex(E.hemi[1]); hemi.intensity = E.hemi[2];
  sun.color.setHex(E.sun[0]); sun.intensity = E.sun[1]; sun.position.set(E.sun[2], E.sun[3], E.sun[4]);
  const u = skyMesh.material.uniforms; u.top.value.setHex(E.sky[0]); u.mid.value.setHex(E.sky[1]); u.hor.value.setHex(E.sky[2]); u.stars.value = E.stars;
  moon.visible = E.moon;
  clouds.forEach(c => { c.visible = !!E.clouds && !storm; });
  if (E.clouds) { cloudMats[0].color.setHex(E.clouds[0]); cloudMats[1].color.setHex(E.clouds[1]); }
  ground.material = groundMat(E.ground);
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
