// Entorno del Puerto de Valencia (estilizado y procedural):
// dársena cerrada navegable con marina y pantalanes, Veles e Vents,
// Edificio del Reloj, tinglados, silos, ferry, terminal de contenedores
// con buque atracado y grúas pórtico, escolleras convergentes con faros
// en la bocana, ciudad al norte y gaviotas. Texturas 100 % procedurales
// (canvas), sin ficheros externos.
import * as THREE from 'three';
import { waterHeight } from './water.js';

/* ------------------------------------------------------------------ */
/* Cielo                                                               */
/* ------------------------------------------------------------------ */

export function createSky(sunDir) {
  const geo = new THREE.SphereGeometry(2600, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: sunDir.clone() },
      uZenith: { value: new THREE.Color(0x1a5cb8) },
      uHorizon: { value: new THREE.Color(0xcfe8f5) },
      uSunColor: { value: new THREE.Color(1.0, 0.93, 0.78) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * smoothstep(0.9993, 0.9998, s) * 4.0; // disco solar
        col += uSunColor * pow(s, 320.0) * 0.7;                 // halo
        col += uSunColor * pow(s, 8.0) * 0.08;                  // bruma cálida
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

/* ------------------------------------------------------------------ */
/* Texturas procedurales (canvas)                                      */
/* ------------------------------------------------------------------ */

function makeTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rep(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

const TEX = {};

function buildTextures() {
  // Hormigón/asfalto de explanada.
  TEX.concrete = makeTex(256, 256, (g, w, h) => {
    g.fillStyle = '#a7a29a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 140 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.35)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
    g.strokeStyle = 'rgba(70,68,64,0.5)'; g.lineWidth = 2;
    g.strokeRect(0, 0, w, h); // junta de losas
  });

  // Cantil del muelle: hormigón con manchas y línea de agua oscura.
  TEX.quayWall = makeTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f8a80'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const v = 110 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v - 5},${v - 12},0.4)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let i = 0; i < 26; i++) { // chorretones
      const x = Math.random() * w;
      g.fillStyle = 'rgba(60,62,58,0.18)';
      g.fillRect(x, h * 0.35, 2 + Math.random() * 4, h * 0.65);
    }
    const grad = g.createLinearGradient(0, h * 0.6, 0, h);
    grad.addColorStop(0, 'rgba(40,60,55,0)');
    grad.addColorStop(1, 'rgba(30,48,44,0.85)'); // marca de marea
    g.fillStyle = grad; g.fillRect(0, h * 0.6, w, h * 0.4);
    g.fillStyle = 'rgba(50,50,50,0.6)';
    g.fillRect(0, 0, w, 6); // remate superior
  });

  // Chapa corrugada (contenedores): blanca, se tiñe con el color de instancia.
  TEX.corrugated = makeTex(128, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      const grad = g.createLinearGradient(x, 0, x + 8, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#c9c9c9');
      grad.addColorStop(0.7, '#f2f2f2');
      grad.addColorStop(1, '#ffffff');
      g.fillStyle = grad; g.fillRect(x, 0, 8, h);
    }
    g.fillStyle = 'rgba(90,90,90,0.5)';
    g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
  });

  // Fachada de oficinas con ventanas.
  TEX.windows = makeTex(128, 256, (g, w, h) => {
    g.fillStyle = '#d8d2c6'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 10; y += 22) {
      for (let x = 8; x < w - 10; x += 18) {
        const lit = Math.random();
        g.fillStyle = lit > 0.85 ? '#ffe9b8' : (lit > 0.4 ? '#33454f' : '#22303a');
        g.fillRect(x, y, 12, 14);
      }
    }
  });

  // Fachada residencial cálida.
  TEX.facade = makeTex(128, 256, (g, w, h) => {
    g.fillStyle = '#cbb8a0'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 12; y += 26) {
      for (let x = 10; x < w - 12; x += 22) {
        g.fillStyle = '#2e3c44';
        g.fillRect(x, y, 12, 16);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fillRect(x - 2, y + 16, 16, 3); // balcón
      }
    }
  });

  // Casco del buque: chapa con línea de flotación.
  TEX.shipHull = makeTex(512, 128, (g, w, h) => {
    g.fillStyle = '#6e1f18'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = Math.random() * 30;
      g.fillStyle = `rgba(${60 + v},${20 + v * 0.4},${16 + v * 0.3},0.5)`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 1.5);
    }
    for (let y = 20; y < h; y += 24) { // costuras de chapas
      g.fillStyle = 'rgba(30,10,8,0.35)'; g.fillRect(0, y, w, 1.5);
    }
    g.fillStyle = '#111418'; g.fillRect(0, 0, w, 14);          // franja superior
    g.fillStyle = '#b8302a'; g.fillRect(0, h - 16, w, 16);     // obra viva
    g.fillStyle = '#e8e4da'; g.fillRect(0, h - 18, w, 3);      // línea de flotación
  });

  // Reloj del Edificio del Reloj.
  TEX.clock = makeTex(128, 128, (g, w, h) => {
    g.fillStyle = '#efe9dc'; g.fillRect(0, 0, w, h);
    g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fillStyle = '#f8f6f0'; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#333'; g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38);
      g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
      g.lineWidth = 3; g.stroke();
    }
    g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 34); g.lineWidth = 5; g.stroke();
    g.beginPath(); g.moveTo(64, 64); g.lineTo(85, 76); g.lineWidth = 4; g.stroke();
  });

  // Bandera de España.
  TEX.flag = makeTex(96, 64, (g, w, h) => {
    g.fillStyle = '#c60b1e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffc400'; g.fillRect(0, h / 4, w, h / 2);
  });

  // Tablones de madera (pantalanes).
  TEX.wood = makeTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9a7c58'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = `rgba(60,44,28,${0.25 + Math.random() * 0.2})`;
      g.fillRect(0, y, w, 2);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = 'rgba(70,52,32,0.25)';
        g.fillRect(Math.random() * w, y + 2 + Math.random() * 12, 8 + Math.random() * 20, 1);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function box(w, h, d, matOrColor, x, y, z, parent, shadows = true) {
  const mat = matOrColor.isMaterial
    ? matOrColor
    : new THREE.MeshLambertMaterial({ color: matOrColor });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (shadows) { m.castShadow = true; m.receiveShadow = true; }
  if (parent) parent.add(m);
  return m;
}

function cylinder(rt, rb, h, seg, matOrColor, x, y, z, parent) {
  const mat = matOrColor.isMaterial
    ? matOrColor
    : new THREE.MeshLambertMaterial({ color: matOrColor });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/* ------------------------------------------------------------------ */
/* Piezas del puerto                                                   */
/* ------------------------------------------------------------------ */

// Grúa pórtico portacontenedores (azul, como las del muelle de Valencia).
function makeCrane() {
  const g = new THREE.Group();
  const blue = 0x1f4f9e;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(1.4, 30, 1.4, blue, sx * 7, 15, sz * 9, g);
  }
  box(16, 1.6, 1.6, blue, 0, 30, -9, g);
  box(16, 1.6, 1.6, blue, 0, 30, 9, g);
  box(1.6, 1.6, 19, blue, -7, 30, 0, g);
  box(1.6, 1.6, 19, blue, 7, 30, 0, g);
  // Pluma sobre el agua (hacia -x local) y tirante trasero.
  const boom = box(62, 1.8, 2.4, blue, -19, 34, 0, g);
  boom.rotation.z = -0.02;
  box(1.2, 13, 1.2, blue, 4, 41, 0, g);           // mástil
  const tie = box(36, 0.4, 0.4, 0x9fb4cc, -13, 40, 0, g);
  tie.rotation.z = 0.19;
  box(6, 4, 8, 0xdde4ea, 2, 33, 0, g);            // cabina/maquinaria
  box(3, 1.4, 3, 0xd94f30, -32, 32.6, 0, g);      // carro (spreader)
  return g;
}

// Edificio Veles e Vents (lamas blancas voladas, Marina Real).
function makeVelesEVents() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f2ec });
  const glass = new THREE.MeshLambertMaterial({ color: 0x27404f });
  box(34, 1.6, 26, white, 0, 3.0, 0, g);
  box(28, 4.2, 21, glass, 1, 5.9, 0, g);
  box(40, 1.8, 30, white, -3, 8.9, 0, g);
  box(26, 4.2, 19, glass, 2, 11.9, 0, g);
  box(44, 1.8, 32, white, -6, 14.9, 0, g);
  box(22, 4.0, 17, glass, 3, 17.8, 0, g);
  box(36, 1.6, 26, white, -2, 20.6, 0, g);
  return g;
}

// Edificio del Reloj (fachada histórica del puerto).
function makeClockBuilding() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ map: rep(TEX.facade, 4, 1) });
  box(46, 12, 16, body, 0, 6, 0, g);
  const roof = box(48, 2.4, 18, 0x7a4a38, 0, 13.2, 0, g);
  roof.scale.x = 0.98;
  // Torre central con reloj y cupulín.
  box(9, 22, 9, 0xe8e0d0, 0, 11, 0, g);
  const clockMat = new THREE.MeshLambertMaterial({ map: TEX.clock });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), clockMat);
  face.position.set(0, 18.5, 4.6); g.add(face);
  const face2 = face.clone(); face2.rotation.y = Math.PI; face2.position.z = -4.6; g.add(face2);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3a5a66 })
  );
  dome.position.y = 22; dome.castShadow = true; g.add(dome);
  return g;
}

function makePalm() {
  const g = new THREE.Group();
  const trunk = cylinder(0.14, 0.24, 6.5, 6, 0x8a6d4b, 0, 3.25, 0, g);
  trunk.rotation.z = (Math.random() - 0.5) * 0.14;
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.55), leafMat);
    leaf.position.set(0, 6.4, 0);
    leaf.rotation.y = (i / 8) * Math.PI * 2;
    leaf.rotateOnAxis(new THREE.Vector3(0, 0, 1), 0.55 + Math.random() * 0.35);
    leaf.translateX(1.35);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

function makeSailboat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.7, 5.2, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xf5f5f0 })
  );
  hull.geometry.rotateX(Math.PI / 2);
  hull.scale.set(1, 0.55, 1);
  hull.position.y = 0.25;
  hull.castShadow = true;
  g.add(hull);
  box(4.6, 0.3, 1.5, 0xd8cfc0, 0, 0.6, 0, g);
  cylinder(0.05, 0.07, 8.5, 6, 0xb9bcc2, 0, 4.8, 0.3, g);
  box(0.08, 0.08, 2.6, 0xb9bcc2, 0, 1.6, 1.6, g);
  return g;
}

// Buque portacontenedores atracado en la terminal.
function makeContainerShip() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ map: rep(TEX.shipHull, 6, 1) });
  const hull = box(24, 13, 170, hullMat, 0, 5.5, 0, g);
  void hull;
  // Proa y popa afiladas (cajas giradas).
  const bowL = box(13, 13, 30, hullMat, -5, 5.5, -96, g);
  bowL.rotation.y = 0.42;
  const bowR = box(13, 13, 30, hullMat, 5, 5.5, -96, g);
  bowR.rotation.y = -0.42;
  box(20, 13, 12, hullMat, 0, 5.5, 90, g);
  // Superestructura blanca a popa.
  const sup = new THREE.MeshLambertMaterial({ map: rep(TEX.windows, 3, 2) });
  box(20, 16, 12, sup, 0, 20, 70, g);
  box(16, 3, 8, 0xe8e4da, 0, 29.5, 70, g);
  box(3, 6, 3, 0xc23b2a, 0, 33, 72, g);           // chimenea
  // Contenedores en cubierta.
  const geo = new THREE.BoxGeometry(2.44, 2.6, 6.1);
  const mat = new THREE.MeshLambertMaterial({ map: rep(TEX.corrugated, 1, 1) });
  const colors = [0xc0392b, 0x2471a3, 0x1e8449, 0xd68910, 0x148f77, 0x7d3c98, 0x99a3ad];
  const count = 180;
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.castShadow = true;
  const m = new THREE.Matrix4();
  let i = 0;
  outer:
  for (let row = 0; row < 8; row++) {          // a lo ancho
    for (let bay = 0; bay < 22; bay++) {       // a lo largo
      const stack = 1 + ((row * 31 + bay * 17) % 3);
      for (let s = 0; s < stack; s++) {
        if (i >= count) break outer;
        if (bay > 17) continue;                // hueco ante la superestructura
        m.makeTranslation(-8.7 + row * 2.5, 13.4 + s * 2.65, -88 + bay * 6.6);
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, new THREE.Color(colors[(row * 13 + bay * 7 + s * 3) % colors.length]));
        i++;
      }
    }
  }
  inst.count = i;
  g.add(inst);
  return g;
}

// Ferry blanco (línea de Baleares).
function makeFerry() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  box(18, 8, 95, white, 0, 3.5, 0, g);
  box(18, 1.6, 95, 0x16385e, 0, 0.8, 0, g);        // franja azul
  const bow = box(12, 8, 18, white, 0, 3.5, -52, g);
  bow.rotation.y = 0;
  bow.scale.x = 0.6;
  const sup = new THREE.MeshLambertMaterial({ map: rep(TEX.windows, 6, 1) });
  box(15, 7, 66, sup, 0, 11, 4, g);
  box(12, 5, 40, white, 0, 16.5, 8, g);
  box(2.6, 5, 6, 0xc23b2a, 0, 21, 24, g);          // chimenea
  return g;
}

function makeLightTower(color) {
  const g = new THREE.Group();
  cylinder(2.6, 3.4, 3, 10, 0xc9c4bb, 0, 1.5, 0, g);
  cylinder(1.1, 1.5, 12, 10, 0xf1ede4, 0, 9, 0, g);
  cylinder(1.32, 1.32, 3, 10, color, 0, 10, 0, g);
  const lampMat = new THREE.MeshLambertMaterial({
    color: 0x222222, emissive: color, emissiveIntensity: 1,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), lampMat);
  lamp.position.y = 15.6;
  g.add(lamp);
  g.userData.lampMat = lampMat;
  return g;
}

function scatterRocks(scene, x0, z0, x1, z1, count) {
  const geo = new THREE.DodecahedronGeometry(1.6, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x7d7568 });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.castShadow = true; inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    const x = x0 + (x1 - x0) * f + (Math.random() - 0.5) * 8;
    const z = z0 + (z1 - z0) * f + (Math.random() - 0.5) * 8;
    const s = 0.8 + Math.random() * 1.7;
    e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    q.setFromEuler(e);
    m.compose(
      new THREE.Vector3(x, Math.random() * 1.4, z),
      q,
      new THREE.Vector3(s, s * (0.6 + Math.random() * 0.5), s)
    );
    inst.setMatrixAt(i, m);
  }
  scene.add(inst);
}

// Explanada de muelle con cantil texturizado y norays.
function quay(scene, x, z, w, d, wallSides) {
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.4, d),
    new THREE.MeshLambertMaterial({ map: rep(TEX.concrete, w / 9, d / 9) })
  );
  top.position.set(x, 3.3, z);
  top.receiveShadow = true;
  scene.add(top);
  const wallMat = new THREE.MeshLambertMaterial({ map: rep(TEX.quayWall, 10, 1) });
  for (const s of wallSides) {
    let wall;
    if (s === 'W') wall = box(0.6, 4.4, d, wallMat, x - w / 2, 1.4, z, scene);
    if (s === 'E') wall = box(0.6, 4.4, d, wallMat, x + w / 2, 1.4, z, scene);
    if (s === 'N') wall = box(w, 4.4, 0.6, wallMat, x, 1.4, z + d / 2);
    if (s === 'S') wall = box(w, 4.4, 0.6, wallMat, x, 1.4, z - d / 2);
    if (wall && !wall.parent) scene.add(wall);
  }
  return top;
}

function bollards(scene, x0, z0, x1, z1, n) {
  const geo = new THREE.CylinderGeometry(0.28, 0.38, 0.8, 8);
  const mat = new THREE.MeshLambertMaterial({ color: 0x1c1f22 });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  inst.castShadow = true;
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1);
    m.makeTranslation(x0 + (x1 - x0) * f, 3.9, z0 + (z1 - z0) * f);
    inst.setMatrixAt(i, m);
  }
  scene.add(inst);
}

function flagpole(scene, x, z) {
  const g = new THREE.Group();
  cylinder(0.06, 0.1, 9, 6, 0xd8d8d8, 0, 4.5, 0, g);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.4, 8, 1),
    new THREE.MeshLambertMaterial({ map: TEX.flag, side: THREE.DoubleSide })
  );
  flag.position.set(1.15, 8.1, 0);
  g.add(flag);
  g.position.set(x, 3.5, z);
  scene.add(g);
  return { update(t) { flag.rotation.y = Math.sin(t * 1.7 + x) * 0.35; } };
}

/* ------------------------------------------------------------------ */
/* Límites navegables de la dársena                                    */
/* ------------------------------------------------------------------ */

// Semianchura navegable según z (la bocana estrecha la dársena).
function allowedX(z) {
  if (z >= -700) return 150;
  if (z >= -1150) return 150 + (z + 700) * (105 / 450); // 150 → 45
  return 10000; // mar abierto
}

// Corrige p si invade un muelle/obstáculo. Devuelve true si hubo choque.
export function resolveHarborCollision(p, m) {
  let hit = false;
  // Muelle norte (ciudad).
  if (p.z > 168 - m) { p.z = 168 - m; hit = true; }
  // Paredes este/oeste y escolleras convergentes.
  const ax = allowedX(p.z) - m;
  if (Math.abs(p.x) > ax) { p.x = Math.sign(p.x) * ax; hit = true; }
  // Canal de salida entre los morros exteriores de las escolleras.
  if (p.z < -1150 && p.z > -1250 && Math.abs(p.x) > 45 - m) {
    p.x = Math.sign(p.x) * (45 - m);
    hit = true;
  }
  // Mar abierto: límite suave para no perderse.
  if (p.z < -1340) { p.z = -1340; hit = true; }
  // Zona de pantalanes de la marina (NO).
  if (p.x < -98 + m && p.z > -45 - m) {
    const dE = (-98 + m) - p.x;
    const dS = p.z - (-45 - m);
    if (dE < dS) p.x = -98 + m; else p.z = -45 - m;
    hit = true;
  }
  // Buque portacontenedores (E).
  if (p.x > 120 - m && p.z > -500 - m && p.z < -320 + m) {
    const dW = p.x - (120 - m);
    const dN = (-320 + m) - p.z;
    const dS = p.z - (-500 - m);
    if (dW <= dN && dW <= dS) p.x = 120 - m;
    else if (dN < dS) p.z = -320 + m;
    else p.z = -500 - m;
    hit = true;
  }
  // Ferry (O).
  if (p.x < -124 + m && p.z > -360 - m && p.z < -260 + m) {
    const dE = (-124 + m) - p.x;
    const dN = (-260 + m) - p.z;
    const dS = p.z - (-360 - m);
    if (dE <= dN && dE <= dS) p.x = -124 + m;
    else if (dN < dS) p.z = -260 + m;
    else p.z = -360 - m;
    hit = true;
  }
  return hit;
}

/* ------------------------------------------------------------------ */
/* Construcción de la escena                                           */
/* ------------------------------------------------------------------ */

export function buildEnvironment(scene) {
  buildTextures();
  const updatables = [];

  /* --- Muelle norte: ciudad y fachada histórica --- */
  quay(scene, 0, 220, 460, 104, []);
  box(460, 4.4, 0.8, new THREE.MeshLambertMaterial({ map: rep(TEX.quayWall, 40, 1) }), 0, 1.4, 168, scene);
  bollards(scene, -220, 165, 220, 165, 19);
  const reloj = makeClockBuilding();
  reloj.position.set(-40, 3.4, 205);
  scene.add(reloj);
  for (const dx of [-75, -60, 25]) updatables.push(flagpole(scene, dx, 180));
  for (let i = 0; i < 14; i++) {
    const palm = makePalm();
    palm.position.set(-200 + i * 30, 3.6, 178);
    palm.rotation.y = Math.random() * Math.PI * 2;
    scene.add(palm);
  }
  // Silueta de la ciudad con fachadas.
  {
    const mats = [
      new THREE.MeshLambertMaterial({ map: rep(TEX.windows, 2, 3) }),
      new THREE.MeshLambertMaterial({ map: rep(TEX.facade, 2, 3) }),
      new THREE.MeshLambertMaterial({ color: 0xb9c2c9 }),
    ];
    for (let i = 0; i < 30; i++) {
      const w = 14 + Math.random() * 18;
      const h = 16 + Math.random() * 52;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mats[i % 3]);
      b.position.set(-380 + i * 26 + (Math.random() - 0.5) * 12, h / 2 + 3, 300 + Math.random() * 130);
      b.castShadow = false; b.receiveShadow = false;
      scene.add(b);
    }
  }

  /* --- Marina Real (NO): Veles e Vents y pantalanes --- */
  quay(scene, -190, -60, 80, 460, ['E']);
  bollards(scene, -152, 160, -152, -280, 17);
  const veles = makeVelesEVents();
  veles.position.set(-185, 3.6, 90);
  veles.rotation.y = 0.35;
  scene.add(veles);
  for (const z of [-90, -170]) { // tinglados históricos
    const shed = new THREE.MeshLambertMaterial({ map: rep(TEX.facade, 5, 1) });
    box(42, 9, 60, shed, -195, 8, z, scene);
    box(45, 3, 63, 0xa5432e, -195, 13.6, z, scene);
  }
  for (let i = 0; i < 9; i++) {
    const palm = makePalm();
    palm.position.set(-158, 3.6, 130 - i * 32);
    scene.add(palm);
  }
  // Pantalanes de madera con veleros amarrados.
  {
    const woodMat = new THREE.MeshLambertMaterial({ map: rep(TEX.wood, 1.5, 16) });
    for (let f = 0; f < 4; f++) {
      const z = 130 - f * 48;
      const dock = new THREE.Mesh(new THREE.BoxGeometry(44, 0.5, 2.6), woodMat);
      dock.position.set(-126, 0.55, z);
      dock.receiveShadow = true;
      scene.add(dock);
      for (let s = 0; s < 4; s++) {
        const sb = makeSailboat();
        const x = -140 + s * 10;
        const zz = z + (s % 2 === 0 ? 5.5 : -5.5);
        sb.position.set(x, 0, zz);
        sb.rotation.y = (s % 2 === 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.1;
        scene.add(sb);
        updatables.push({
          update(t) {
            sb.position.y = waterHeight(x, zz, t) + 0.1;
            sb.rotation.z = waterHeight(x + 2, zz, t) * 0.5;
            sb.rotation.x = waterHeight(x, zz + 2, t) * 0.4;
          },
        });
      }
    }
  }

  /* --- Muelle oeste: ferry y silos --- */
  const ferry = makeFerry();
  ferry.position.set(-136, 0.4, -310);
  scene.add(ferry);
  updatables.push({
    update(t) {
      ferry.position.y = 0.4 + waterHeight(-136, -310, t) * 0.4;
      ferry.rotation.x = waterHeight(-136, -290, t) * 0.02;
    },
  });
  quay(scene, -190, -510, 80, 420, ['E']);
  bollards(scene, -152, -300, -152, -690, 14);
  for (let i = 0; i < 6; i++) { // silos de grano
    cylinder(6, 6, 30, 14, 0xd9d0bd, -180 + (i % 3) * 14, 18, -560 - Math.floor(i / 3) * 14, scene);
  }
  box(30, 4, 44, 0xc9c0ae, -180, 35, -567, scene);
  const shedW = new THREE.MeshLambertMaterial({ map: rep(TEX.facade, 4, 1) });
  box(36, 10, 70, shedW, -192, 8.4, -430, scene);

  /* --- Muelle este: terminal de contenedores y buque --- */
  quay(scene, 205, -280, 110, 900, ['W']);
  bollards(scene, 152, 160, 152, -690, 25);
  for (const z of [-180, -260, -340, -420, -500]) {
    const crane = makeCrane();
    crane.position.set(163, 3.4, z);
    scene.add(crane);
  }
  const ship = makeContainerShip();
  ship.position.set(133, 0, -410);
  scene.add(ship);
  updatables.push({
    update(t) {
      ship.position.y = waterHeight(133, -410, t) * 0.3;
    },
  });
  // Patio de contenedores.
  {
    const geo = new THREE.BoxGeometry(6.1, 2.6, 2.44);
    const mat = new THREE.MeshLambertMaterial({ map: rep(TEX.corrugated, 2, 1) });
    const colors = [0xc0392b, 0x2471a3, 0x1e8449, 0xd68910, 0x148f77, 0x7d3c98];
    const count = 130;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = true; inst.receiveShadow = true;
    const m = new THREE.Matrix4();
    let i = 0;
    outer:
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const stack = 1 + ((row * 7 + col * 5) % 3);
        for (let s = 0; s < stack; s++) {
          if (i >= count) break outer;
          m.makeTranslation(185 + row * 7.4, 4.8 + s * 2.65, -130 - col * 28 - row * 3);
          inst.setMatrixAt(i, m);
          inst.setColorAt(i, new THREE.Color(colors[(i * 7) % colors.length]));
          i++;
        }
      }
    }
    inst.count = i;
    scene.add(inst);
  }

  /* --- Bocana: escolleras convergentes y faros --- */
  const bwMat = new THREE.MeshLambertMaterial({ map: rep(TEX.quayWall, 30, 1) });
  for (const side of [1, -1]) {
    const x0 = 150 * side, z0 = -700;
    const x1 = 50 * side, z1 = -1150;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const wall = box(14, 4.5, len, bwMat, (x0 + x1) / 2, 1.6, (z0 + z1) / 2, scene);
    wall.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    scatterRocks(scene, x0 - 4 * side, z0, x1 - 4 * side, z1, 90);
    // Tramo exterior corto.
    const outer2 = box(14, 4.5, 90, bwMat, x1, 1.6, -1195, scene);
    void outer2;
    scatterRocks(scene, x1 - 4 * side, -1150, x1 - 4 * side, -1240, 24);
  }
  const faroVerde = makeLightTower(0x1e8449);  // estribor al entrar
  faroVerde.position.set(52, 3.5, -1160);
  scene.add(faroVerde);
  const faroRojo = makeLightTower(0xc0392b);
  faroRojo.position.set(-52, 3.5, -1160);
  scene.add(faroRojo);
  updatables.push({
    update(t) {
      faroVerde.userData.lampMat.emissiveIntensity = (Math.sin(t * 2.2) > 0.3) ? 2.2 : 0.15;
      faroRojo.userData.lampMat.emissiveIntensity = (Math.sin(t * 2.2 + Math.PI) > 0.3) ? 2.2 : 0.15;
    },
  });

  /* --- Boyas de la calle de entrenamiento --- */
  {
    const buoyGeo = new THREE.SphereGeometry(0.4, 10, 8);
    const buoyMat = new THREE.MeshLambertMaterial({ color: 0xf07818 });
    for (let z = 20; z >= -1020; z -= 80) {
      for (const x of [-11, 11]) {
        const b = new THREE.Mesh(buoyGeo, buoyMat);
        const pole = cylinder(0.04, 0.04, 0.7, 5, 0xffffff, 0, 0.55, 0, b);
        void pole;
        b.position.set(x, 0, z);
        scene.add(b);
        updatables.push({
          update(t) {
            b.position.y = waterHeight(x, z, t) + 0.12;
            b.rotation.x = waterHeight(x, z + 1.5, t) * 1.2;
            b.rotation.z = waterHeight(x + 1.5, z, t) * 1.2;
          },
        });
      }
    }
  }

  /* --- Gaviotas --- */
  {
    const gullMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const gull = new THREE.Group();
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.35), gullMat);
      const wr = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.35), gullMat);
      wl.position.x = -0.65;
      wr.position.x = 0.65;
      gull.add(wl, wr);
      scene.add(gull);
      const cx = (Math.random() - 0.5) * 200;
      const cz = -50 - Math.random() * 800;
      const r = 25 + Math.random() * 45;
      const h = 18 + Math.random() * 24;
      const sp = 0.25 + Math.random() * 0.2;
      const ph = Math.random() * 10;
      updatables.push({
        update(t) {
          const a = t * sp + ph;
          gull.position.set(cx + Math.cos(a) * r, h + Math.sin(t * 0.7 + ph) * 2, cz + Math.sin(a) * r);
          gull.rotation.y = -a - Math.PI / 2;
          const flap = Math.sin(t * 9 + ph) * 0.5;
          wl.rotation.z = flap;
          wr.rotation.z = -flap;
        },
      });
    }
  }

  return updatables;
}
