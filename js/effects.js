// Efectos de agua: salpicaduras de las palas y estela de espuma.
import * as THREE from 'three';

const POINT_VERT = /* glsl */ `
  attribute float aLife;      // fracción de vida restante (1 → 0)
  attribute float aSize;      // diámetro en metros
  uniform float uPixelScale;  // px de dispositivo por metro a 1 m de distancia
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float grow = mix(1.7, 0.7, aLife); // se expande al desvanecerse
    float px = aSize * grow * uPixelScale / max(-mv.z, 1.0);
    gl_PointSize = min(px, 420.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  varying float vLife;
  uniform float uAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float mask = smoothstep(0.5, 0.12, d);
    float a = mask * vLife * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.92, 0.97, 1.0, a);
  }
`;

class PointPool {
  constructor(capacity, alpha) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);     // segundos restantes
    this.maxLife = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.aLife = new Float32Array(capacity);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.aLife, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: { uAlpha: { value: alpha }, uPixelScale: { value: 900 } },
      transparent: true,
      depthWrite: false,
    });
    this.material = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(x, y, z, vx, vy, vz, life, size) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.sizes[i] = size;
  }

  step(dt, gravity, drag) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) { this.aLife[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] += gravity * dt;
      this.vel[i * 3] *= drag; this.vel[i * 3 + 1] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.aLife[i] = Math.max(this.life[i] / this.maxLife[i], 0);
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }
}

export class WaterEffects {
  constructor(scene) {
    this.splash = new PointPool(360, 0.85);
    this.foam = new PointPool(220, 0.3);
    scene.add(this.splash.points, this.foam.points);
    this.foamTimer = 0;
  }

  // px de dispositivo por metro a 1 m: alturaBuffer / (2·tan(fov/2)).
  setPixelScale(v) {
    this.splash.material.uniforms.uPixelScale.value = v;
    this.foam.material.uniforms.uPixelScale.value = v;
  }

  // Salpicadura en el ataque de la pala.
  bladeSplash(p, power) {
    const n = Math.floor(14 + power * 18);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.6 + Math.random() * 1.6) * (0.5 + power * 0.7);
      this.splash.spawn(
        p.x + (Math.random() - 0.5) * 0.3, p.y + 0.05, p.z + (Math.random() - 0.5) * 0.3,
        Math.cos(a) * r * 0.6, 1.2 + Math.random() * 1.8 * power, Math.sin(a) * r * 0.6,
        0.45 + Math.random() * 0.4, 0.06 + Math.random() * 0.1
      );
    }
  }

  // Pequeño rocío durante la pasada.
  bladeSpray(p) {
    for (let i = 0; i < 2; i++) {
      this.splash.spawn(
        p.x, p.y + 0.03, p.z,
        (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.7, (Math.random() - 0.5) * 0.8 + 0.6,
        0.3 + Math.random() * 0.25, 0.04 + Math.random() * 0.06
      );
    }
  }

  // Estela de espuma tras la popa.
  updateWake(dt, sternPos, speed) {
    this.foamTimer -= dt;
    if (speed > 0.7 && this.foamTimer <= 0) {
      this.foamTimer = 0.11;
      this.foam.spawn(
        sternPos.x + (Math.random() - 0.5) * 0.3, 0.14, sternPos.z + Math.random() * 0.4,
        0, 0, 0,
        2.6 + Math.random() * 1.2, 1.2 + speed * 0.35
      );
    }
  }

  step(dt) {
    this.splash.step(dt, -5.5, 0.985);
    this.foam.step(dt, 0, 1);
  }
}
