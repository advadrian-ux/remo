// Agua del puerto con reflexión planar real: antes de cada fotograma se
// renderiza la escena desde una cámara reflejada bajo el plano del agua
// y el shader muestrea esa textura distorsionada por las normales del
// oleaje. La función de altura está duplicada en JS (waterHeight) para
// que el bote y las boyas floten de forma coherente con lo que se ve.
import * as THREE from 'three';

// Olas de la dársena (aguas abrigadas): dirección normalizada, amplitud,
// longitud de onda y velocidad angular. Deben coincidir con el GLSL.
const WAVES = [
  { dx: 0.95783, dz: 0.28735, amp: 0.055, len: 11.0, speed: 1.1 },
  { dx: -0.37139, dz: 0.92848, amp: 0.038, len: 6.5, speed: 1.6 },
  { dx: 0.75926, dz: -0.65079, amp: 0.024, len: 3.0, speed: 2.3 },
];

export function waterHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.len;
    h += w.amp * Math.sin((w.dx * x + w.dz * z) * k + t * w.speed);
  }
  return h;
}

const GLSL_WAVES = /* glsl */ `
  float hWave(vec2 p, vec2 d, float amp, float len, float sp) {
    float k = 6.2831853 / len;
    return amp * sin(dot(d, p) * k + uTime * sp);
  }
  float waterH(vec2 p) {
    return hWave(p, vec2( 0.95783,  0.28735), 0.055, 11.0, 1.1)
         + hWave(p, vec2(-0.37139,  0.92848), 0.038,  6.5, 1.6)
         + hWave(p, vec2( 0.75926, -0.65079), 0.024,  3.0, 2.3);
  }
`;

const VERT = /* glsl */ `
  uniform float uTime;
  uniform mat4 uTextureMatrix;
  varying vec3 vWorldPos;
  varying vec4 vRefUv;
  ${GLSL_WAVES}
  void main() {
    vec3 pos = position;
    pos.y += waterH(pos.xz);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vRefUv = uTextureMatrix * wp;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uWaterColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform sampler2D uReflection;
  varying vec3 vWorldPos;
  varying vec4 vRefUv;
  ${GLSL_WAVES}

  // Rizado fino que solo afecta a las normales (brillos del sol).
  float ripple(vec2 p) {
    return 0.012 * sin(p.x * 3.1 + uTime * 2.6 + sin(p.y * 2.7))
         + 0.010 * sin((p.x + p.y) * 4.3 - uTime * 3.2)
         + 0.008 * sin(p.y * 5.9 + uTime * 2.1 + sin(p.x * 3.3 + uTime));
  }
  float hTotal(vec2 p) { return waterH(p) + ripple(p); }

  void main() {
    vec2 p = vWorldPos.xz;
    float dist = length(cameraPosition - vWorldPos);

    float e = 0.18;
    float hx1 = hTotal(p + vec2(e, 0.0));
    float hx0 = hTotal(p - vec2(e, 0.0));
    float hz1 = hTotal(p + vec2(0.0, e));
    float hz0 = hTotal(p - vec2(0.0, e));
    vec3 n = normalize(vec3(hx0 - hx1, 2.0 * e, hz0 - hz1));
    // Aplana la normal con la distancia para evitar moiré y ruido lejano.
    float flat_ = mix(1.0, 0.12, smoothstep(35.0, 450.0, dist));
    n = normalize(mix(vec3(0.0, 1.0, 0.0), n, flat_));

    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndv = max(dot(n, V), 0.0);
    float fresnel = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);

    // Reflexión planar distorsionada por el oleaje.
    vec2 ruv = vRefUv.xy / max(vRefUv.w, 0.0001);
    ruv += n.xz * 0.075;
    ruv = clamp(ruv, 0.002, 0.998);
    vec3 refl = texture2D(uReflection, ruv).rgb;

    // Absorción del agua del puerto (verde-azulada, más clara al mirar
    // rasante) y mezcla Fresnel con el reflejo.
    vec3 deep = uWaterColor * (0.75 + 0.5 * pow(1.0 - ndv, 2.0));
    vec3 col = mix(deep, refl, clamp(fresnel * 1.55, 0.0, 1.0));

    // Variación suave de tono a gran escala (corrientes, fondo).
    col *= 1.0 + 0.05 * sin(p.x * 0.013 + p.y * 0.019)
               + 0.03 * sin(p.x * 0.031 - p.y * 0.011);

    // Sol: brillo especular + destellos.
    vec3 R = reflect(-V, n);
    float rs = max(dot(R, uSunDir), 0.0);
    col += uSunColor * (pow(rs, 600.0) * 3.2 + pow(rs, 48.0) * 0.18);

    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createWater(fog, sunDir) {
  const geo = new THREE.PlaneGeometry(4000, 4000, 220, 220);
  geo.rotateX(-Math.PI / 2);

  const target = new THREE.WebGLRenderTarget(1536, 1536, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(1.0, 0.92, 0.75) },
      uWaterColor: { value: new THREE.Color(0x0a3140) },
      uFogColor: { value: fog.color.clone() },
      uFogNear: { value: fog.near },
      uFogFar: { value: fog.far },
      uReflection: { value: target.texture },
      uTextureMatrix: { value: new THREE.Matrix4() },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.updateTime = (t) => { mat.uniforms.uTime.value = t; };

  // --- Cámara reflejada bajo el plano y=0 ---
  const mirrorCam = new THREE.PerspectiveCamera();
  const _fwd = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  mesh.renderReflection = (renderer, scene, camera, hidden = []) => {
    if (camera.position.y <= 0.05) return;

    mirrorCam.position.copy(camera.position);
    mirrorCam.position.y *= -1;
    camera.getWorldDirection(_fwd);
    _fwd.y *= -1;
    _up.setFromMatrixColumn(camera.matrixWorld, 1);
    _up.y *= -1;
    mirrorCam.up.copy(_up);
    mirrorCam.lookAt(_tgt.copy(mirrorCam.position).add(_fwd));
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);

    // uv = bias(0.5) · proyección · vista, en el espacio de la cámara espejo.
    mat.uniforms.uTextureMatrix.value
      .set(
        0.5, 0.0, 0.0, 0.5,
        0.0, 0.5, 0.0, 0.5,
        0.0, 0.0, 0.5, 0.5,
        0.0, 0.0, 0.0, 1.0
      )
      .multiply(mirrorCam.projectionMatrix)
      .multiply(mirrorCam.matrixWorldInverse);

    const visibles = [];
    mesh.visible = false;
    for (const o of hidden) { visibles.push([o, o.visible]); o.visible = false; }

    const prevTarget = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    renderer.xr.enabled = false;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(prevTarget);
    renderer.xr.enabled = prevXr;

    mesh.visible = true;
    for (const [o, v] of visibles) o.visible = v;
  };

  return mesh;
}
