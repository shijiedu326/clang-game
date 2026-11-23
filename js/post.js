import * as THREE from 'three';

// 美漫墨线：深度(1/z 拉普拉斯)勾外轮廓 + 法线差勾内部棱线，屏幕空间等宽
// 第 1 层(layer 1)的物体（弹道、激光、涂鸦、枪口火光）不参与描边
export const NO_INK = 1;

export class InkPass {
  constructor(renderer) {
    this.r = renderer;
    this.color = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    this.norm = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
    this.normMat = new THREE.MeshNormalMaterial();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tNorm: { value: null }, tDepth: { value: null }, px: { value: new THREE.Vector2() }, near: { value: 0.05 }, far: { value: 300 }, thick: { value: 1 }, hurt: { value: 0 }, fogNear: { value: 70 }, fogFar: { value: 200 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        #include <packing>
        uniform sampler2D tColor, tNorm, tDepth; uniform vec2 px; uniform float near, far, thick, hurt, fogNear, fogFar;
        varying vec2 vUv;
        float lin(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
        vec3 nrm(vec2 uv){ return texture2D(tNorm, uv).xyz * 2. - 1.; }
        void main(){
          vec3 col = texture2D(tColor, vUv).rgb;
          vec2 o = px * thick;
          float dc = lin(vUv);
          float dl = lin(vUv - vec2(o.x, 0.)), dr = lin(vUv + vec2(o.x, 0.)), du = lin(vUv + vec2(0., o.y)), dd = lin(vUv - vec2(0., o.y));
          float ic = 1. / dc;
          float lap = abs(1./dl + 1./dr + 1./du + 1./dd - 4. * ic) / ic;
          float eD = smoothstep(0.06, 0.16, lap);
          vec3 nc = nrm(vUv);
          float nd = 0.;
          nd = max(nd, 1. - dot(nc, nrm(vUv - vec2(o.x, 0.))));
          nd = max(nd, 1. - dot(nc, nrm(vUv + vec2(o.x, 0.))));
          nd = max(nd, 1. - dot(nc, nrm(vUv + vec2(0., o.y))));
          nd = max(nd, 1. - dot(nc, nrm(vUv - vec2(0., o.y))));
          float eN = smoothstep(0.25, 0.5, nd);
          float fade = 1. - smoothstep(min(70., fogNear + 4.), min(200., fogFar * 0.85), dc);
          float e = max(eD, eN * (1. - smoothstep(30., 90., dc))) * fade;
          // 旧纸调色：降一点饱和、偏暖、暗部微抬
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(lum), col, 0.82) * vec3(1.03, 1.0, 0.9) + vec3(0.018, 0.014, 0.0);
          col = mix(col, vec3(0.075, 0.06, 0.055), e);
          // 暗角 + 受伤红边
          vec2 q = vUv - .5; float v = dot(q, q);
          col *= 1. - v * 0.35;
          col = mix(col, vec3(0.85, 0.12, 0.08), hurt * smoothstep(0.08, 0.32, v));
          gl_FragColor = vec4(col, 1.);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.bgN = new THREE.Color(0.5, 0.5, 1.0);
  }
  setSize(w, h) {
    this.color.setSize(w, h); this.norm.setSize(w, h);
    this.mat.uniforms.px.value.set(1 / w, 1 / h);
    this.mat.uniforms.thick.value = Math.max(1, h / 480);
  }
  render(scene, cam, vmScene, vmCam, out = null) {
    const r = this.r, u = this.mat.uniforms;
    // 1) 彩色（只在这一遍更新阴影贴图）
    cam.layers.enable(NO_INK); vmCam.layers.enable(NO_INK);
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.color); r.clear(); r.render(scene, cam); r.clearDepth(); r.render(vmScene, vmCam);
    // 2) 法线 + 深度（不含第 1 层）
    cam.layers.disable(NO_INK); vmCam.layers.disable(NO_INK);
    const bg = scene.background, fog = scene.fog; scene.background = null; scene.fog = null;
    scene.overrideMaterial = this.normMat; vmScene.overrideMaterial = this.normMat;
    const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    r.setClearColor(this.bgN, 1);
    r.setRenderTarget(this.norm); r.clear(); r.render(scene, cam); r.render(vmScene, vmCam);
    r.setClearColor(cc, ca);
    scene.overrideMaterial = null; vmScene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
    cam.layers.enable(NO_INK); vmCam.layers.enable(NO_INK);
    // 3) 合成
    u.tColor.value = this.color.texture; u.tNorm.value = this.norm.texture; u.tDepth.value = this.norm.depthTexture;
    u.near.value = cam.near; u.far.value = cam.far;
    if (fog) { u.fogNear.value = fog.near; u.fogFar.value = fog.far; } else { u.fogNear.value = 70; u.fogFar.value = 240; }
    r.setRenderTarget(out); r.render(this.qScene, this.qCam); r.setRenderTarget(null);
  }
}
