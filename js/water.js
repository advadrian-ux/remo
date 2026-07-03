// Agua del puerto: plano con oleaje suave (vértices) y normales
// procedurales de alta frecuencia (fragmento). La función de altura
// está duplicada en JS (waterHeight) para que el bote y las boyas
// floten de forma coherente con lo que se ve.
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
  varying vec3 vWorldPos;
  ${GLSL_WAVES}
  void main() {
    vec3 pos = position;
    pos.y += waterH(pos.xz);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uWaterColor;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorldPos;
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
    float fresnel = 0.06 + 0.94 * pow(1.0 - ndv, 5.0);

    vec3 R = reflect(-V, n);
    vec3 skyRef = mix(uHorizonColor, uSkyColor, clamp(R.y * 1.8, 0.0, 1.0));
    vec3 col = mix(uWaterColor, skyRef, fresnel);

    // Variación suave de tono a gran escala (corrientes, fondo).
    col *= 1.0 + 0.05 * sin(p.x * 0.013 + p.y * 0.019)
               + 0.03 * sin(p.x * 0.031 - p.y * 0.011);

    float rs = max(dot(R, uSunDir), 0.0);
    col += uSunColor * (pow(rs, 600.0) * 3.0 + pow(rs, 48.0) * 0.22);

    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createWater(fog, sunDir) {
  const geo = new THREE.PlaneGeometry(4000, 4000, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(1.0, 0.92, 0.75) },
      uWaterColor: { value: new THREE.Color(0x0d4156) },
      uSkyColor: { value: new THREE.Color(0x2670c9) },
      uHorizonColor: { value: new THREE.Color(0xcfe8f5) },
      uFogColor: { value: fog.color.clone() },
      uFogNear: { value: fog.near },
      uFogFar: { value: fog.far },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.updateTime = (t) => { mat.uniforms.uTime.value = t; };
  return mesh;
}
