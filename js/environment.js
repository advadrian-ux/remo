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
      uTime: { value: 0 },
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
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = p * 2.03 + vec2(17.3, 9.1);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * smoothstep(0.9993, 0.9998, s) * 4.0; // disco solar
        col += uSunColor * pow(s, 320.0) * 0.7;                 // halo
        col += uSunColor * pow(s, 8.0) * 0.08;                  // bruma cálida

        // Nubes: fbm proyectado sobre una capa alta que deriva con el viento.
        if (d.y > 0.015) {
          vec2 cuv = d.xz / (d.y + 0.18) * 1.35 + vec2(uTime * 0.006, uTime * 0.0023);
          float base = fbm(cuv);
          float cover = smoothstep(0.52, 0.78, base);
          float wisps = smoothstep(0.38, 0.62, fbm(cuv * 3.1 + 40.0)) * 0.35;
          float density = clamp(cover + wisps * cover, 0.0, 1.0);
          density *= smoothstep(0.015, 0.12, d.y);          // se funden en el horizonte
          // Iluminación: blancas hacia el sol, gris azulado en la base.
          float lit = 0.65 + 0.35 * s;
          vec3 cloudCol = mix(vec3(0.62, 0.67, 0.74), vec3(1.04, 1.02, 0.99), lit)
                        * (0.72 + 0.28 * smoothstep(0.3, 0.9, base));
          col = mix(col, cloudCol, density * 0.88);
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.updateTime = (t) => { mat.uniforms.uTime.value = t; };
  return mesh;
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
  TEX.concrete = makeTex(512, 512, (g, w, h) => {
    g.fillStyle = '#a7a29a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 130 + Math.random() * 70;
      g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.35)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
    // Manchas de aceite y desgaste.
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 30;
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(60,58,54,0.22)');
      grad.addColorStop(1, 'rgba(60,58,54,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // Grietas finas.
    g.strokeStyle = 'rgba(75,72,66,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      let x = Math.random() * w, y = Math.random() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (Math.random() - 0.5) * 34; y += (Math.random() - 0.5) * 34;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(70,68,64,0.55)'; g.lineWidth = 3;
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
  TEX.corrugated = makeTex(256, 128, (g, w, h) => {
    for (let x = 0; x < w; x += 16) {
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#bdbdbd');
      grad.addColorStop(0.7, '#f2f2f2');
      grad.addColorStop(1, '#ffffff');
      g.fillStyle = grad; g.fillRect(x, 0, 16, h);
    }
    // Desgaste y arañazos.
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(70,60,50,${0.05 + Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 1.5);
    }
    g.fillStyle = 'rgba(80,80,80,0.55)';
    g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); // esquineros
    g.fillStyle = 'rgba(60,60,60,0.4)';
    g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);  // raíles
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

  // Fachada residencial cálida con balcones y toldos.
  TEX.facade = makeTex(256, 512, (g, w, h) => {
    g.fillStyle = '#cbb8a0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { // grano del enlucido
      const v = Math.random() * 26;
      g.fillStyle = `rgba(${170 - v},${152 - v},${128 - v},0.3)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    for (let y = 18; y < h - 24; y += 52) {
      for (let x = 18; x < w - 24; x += 44) {
        // Recercado y ventana con visillo.
        g.fillStyle = '#b5a288'; g.fillRect(x - 3, y - 3, 30, 38);
        const win = g.createLinearGradient(x, y, x, y + 32);
        win.addColorStop(0, '#3b4d57');
        win.addColorStop(0.6, '#22303a');
        win.addColorStop(1, '#17232b');
        g.fillStyle = win; g.fillRect(x, y, 24, 32);
        g.fillStyle = 'rgba(220,225,228,0.25)'; g.fillRect(x + 2, y + 2, 8, 12);
        // Balcón con barandilla.
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 4, y + 32, 32, 4);
        g.strokeStyle = 'rgba(40,44,48,0.7)'; g.lineWidth = 1;
        for (let b = 0; b <= 32; b += 4) {
          g.beginPath(); g.moveTo(x - 4 + b, y + 22); g.lineTo(x - 4 + b, y + 32); g.stroke();
        }
        // Algún toldo.
        if (Math.random() > 0.6) {
          g.fillStyle = Math.random() > 0.5 ? '#7a9e6a' : '#a86f52';
          g.fillRect(x - 3, y - 6, 30, 7);
        }
      }
    }
    // Sombra de cornisa entre plantas.
    for (let y = 54; y < h; y += 52) {
      g.fillStyle = 'rgba(90,80,66,0.28)'; g.fillRect(0, y, w, 3);
    }
  });

  // Casco del buque: chapas, cuadernas marcadas, óxido y rótulo.
  TEX.shipHull = makeTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#6e1f18'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const v = Math.random() * 34;
      g.fillStyle = `rgba(${58 + v},${20 + v * 0.4},${15 + v * 0.3},0.5)`;
      g.fillRect(Math.random() * w, Math.random() * h, 3.5, 1.6);
    }
    for (let y = 34; y < h; y += 40) { // costuras horizontales
      g.fillStyle = 'rgba(30,10,8,0.4)'; g.fillRect(0, y, w, 2);
    }
    for (let x = 0; x < w; x += 64) {  // juntas verticales de chapa
      g.fillStyle = 'rgba(35,12,9,0.3)'; g.fillRect(x, 0, 1.6, h);
    }
    // Chorretones de óxido desde imbornales y portas.
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * w;
      const y0 = 18 + Math.random() * 60;
      const len = 30 + Math.random() * 120;
      const grad = g.createLinearGradient(0, y0, 0, y0 + len);
      grad.addColorStop(0, 'rgba(120,60,20,0.55)');
      grad.addColorStop(1, 'rgba(90,45,15,0)');
      g.fillStyle = grad;
      g.fillRect(x, y0, 2.5 + Math.random() * 4, len);
    }
    g.fillStyle = '#111418'; g.fillRect(0, 0, w, 26);           // franja superior
    g.fillStyle = '#8e2620'; g.fillRect(0, h - 40, w, 40);      // obra viva
    for (let i = 0; i < 500; i++) {                             // caracolillo
      g.fillStyle = `rgba(${140 + Math.random() * 40},${90 + Math.random() * 30},40,0.3)`;
      g.fillRect(Math.random() * w, h - 40 + Math.random() * 40, 2.5, 2);
    }
    g.fillStyle = '#e8e4da'; g.fillRect(0, h - 44, w, 4);       // línea de flotación
    // Rótulo y calados.
    g.font = 'bold 34px Arial'; g.fillStyle = '#e8e4da';
    g.fillText('TURIA EXPRESS', 60, 70);
    g.font = '13px monospace';
    for (let i = 0; i < 5; i++) g.fillText(String(6 + i), w - 40, h - 50 - i * 26);
  });

  // Fachada historicista con ventanas de arco (Edificio del Reloj).
  TEX.arched = makeTex(512, 256, (g, w, h) => {
    g.fillStyle = '#e6dcc6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const v = Math.random() * 18;
      g.fillStyle = `rgba(${205 - v},${192 - v},${164 - v},0.4)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    const arch = (x, y, aw, ah) => {
      g.fillStyle = '#f2ecdd';                          // recercado
      g.fillRect(x - 4, y - 4, aw + 8, ah + 4);
      g.beginPath(); g.arc(x + aw / 2, y - 2, aw / 2 + 4, Math.PI, 0); g.fill();
      const win = g.createLinearGradient(0, y, 0, y + ah);
      win.addColorStop(0, '#39505c'); win.addColorStop(1, '#1d2b33');
      g.fillStyle = win;
      g.fillRect(x, y, aw, ah);
      g.beginPath(); g.arc(x + aw / 2, y, aw / 2, Math.PI, 0); g.fill();
      g.strokeStyle = 'rgba(240,235,220,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + aw / 2, y - aw / 2); g.lineTo(x + aw / 2, y + ah); g.stroke();
    };
    // Planta noble: arcos altos. Planta superior: arcos menores.
    for (let x = 24; x < w - 40; x += 84) arch(x, 152, 40, 84);
    for (let x = 32; x < w - 40; x += 84) arch(x, 46, 26, 52);
    g.fillStyle = '#f2ecdd'; g.fillRect(0, 0, w, 14);        // cornisa
    g.fillStyle = 'rgba(120,108,86,0.5)'; g.fillRect(0, 14, w, 3);
    g.fillStyle = '#f2ecdd'; g.fillRect(0, 118, w, 14);      // imposta
    g.fillStyle = '#cfc2a4'; g.fillRect(0, h - 12, w, 12);   // zócalo
  });

  // Tinglado modernista: arcos con puertas verdes y cenefa de azulejo.
  TEX.tinglado = makeTex(512, 256, (g, w, h) => {
    g.fillStyle = '#eee4cf'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const v = Math.random() * 16;
      g.fillStyle = `rgba(${215 - v},${203 - v},${180 - v},0.4)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let x = 20; x < w - 60; x += 124) {
      g.fillStyle = '#f6f0e2';                        // recercado
      g.fillRect(x - 6, 84, 92, 172);
      g.beginPath(); g.arc(x + 40, 88, 52, Math.PI, 0); g.fill();
      g.fillStyle = '#41604e';                        // portón verde
      g.fillRect(x, 90, 80, 166);
      g.beginPath(); g.arc(x + 40, 92, 40, Math.PI, 0); g.fill();
      g.strokeStyle = 'rgba(20,35,26,0.5)';
      for (let d = 8; d < 80; d += 10) {              // tablas del portón
        g.beginPath(); g.moveTo(x + d, 60); g.lineTo(x + d, 256); g.stroke();
      }
    }
    // Cenefa modernista de azulejo azul.
    g.fillStyle = '#2e5d9e';
    for (let x = 0; x < w; x += 26) {
      g.beginPath();
      g.moveTo(x + 13, 18); g.lineTo(x + 24, 30); g.lineTo(x + 13, 42); g.lineTo(x + 2, 30);
      g.closePath(); g.fill();
    }
    g.fillStyle = '#f6f0e2'; g.fillRect(0, 0, w, 10);
    g.fillStyle = '#d9ceb2'; g.fillRect(0, 48, w, 6);
  });

  // Arena de playa.
  TEX.sand = makeTex(256, 256, (g, w, h) => {
    g.fillStyle = '#dcc79c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const v = Math.random() * 40;
      g.fillStyle = `rgba(${205 - v},${180 - v},${140 - v},0.4)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    }
  });

  // Teja árabe para cubiertas.
  TEX.roof = makeTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b0603f'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) {
      for (let x = 0; x < w; x += 16) {
        const grad = g.createLinearGradient(x, y, x + 16, y);
        grad.addColorStop(0, 'rgba(70,32,18,0.5)');
        grad.addColorStop(0.5, 'rgba(220,140,95,0.35)');
        grad.addColorStop(1, 'rgba(70,32,18,0.5)');
        g.fillStyle = grad; g.fillRect(x, y, 16, 10);
      }
      g.fillStyle = 'rgba(60,28,16,0.45)'; g.fillRect(0, y + 10, w, 2);
    }
  });

  // Letras rojas "LA MARINA" (cartel real de la Marina de València).
  TEX.sign = makeTex(1024, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'bold 104px Arial, sans-serif';
    g.fillStyle = '#d0261c';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('LA MARINA', w / 2, h / 2 + 6);
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

// Edificio Veles e Vents (David Chipperfield, 2006): losas blancas
// voladas de tamaño creciente, vidrio retranqueado y columnas esbeltas.
function makeVelesEVents() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf7f5ef });
  const glassMat = new THREE.MeshLambertMaterial({ map: rep(TEX.windows, 8, 1), color: 0x9fb4c0 });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2b6fd4 });
  box(50, 1.3, 30, white, 0, 3.6, 0, g);       // losa de planta baja
  box(40, 4.6, 24, glassMat, 2, 6.6, 0, g);
  box(58, 1.5, 34, white, -5, 9.6, 0, g);      // el gran voladizo
  box(34, 4.6, 22, glassMat, 3, 12.7, 0, g);
  box(50, 1.4, 30, white, -2, 15.8, 0, g);
  box(26, 4.2, 18, glassMat, 4, 18.7, 0, g);
  box(38, 1.3, 24, white, 0, 21.6, 0, g);      // losa de cubierta
  for (const cx of [-15, 0, 15]) for (const cz of [-9.5, 9.5]) {
    cylinder(0.32, 0.32, 18, 8, 0xf7f5ef, cx, 12.5, cz, g);
  }
  box(6, 18, 8, blue, 21, 11.5, 5, g);         // núcleo de escaleras azul
  const ramp = box(26, 0.5, 7, white, -24, 2.0, 9, g);
  ramp.rotation.z = 0.1;
  // Barandillas de vidrio en los bordes de las losas.
  const rail = new THREE.MeshLambertMaterial({ color: 0xb9cdd6, transparent: true, opacity: 0.4 });
  box(57, 1.1, 0.15, rail, -5, 10.9, 16.8, g);
  box(57, 1.1, 0.15, rail, -5, 10.9, -16.8, g);
  box(49, 1.1, 0.15, rail, -2, 17.1, 14.8, g);
  return g;
}

// Edificio del Reloj (1916): fachada historicista con ventanas de arco,
// esquinas resaltadas, mansarda de pizarra con buhardillas y torre del
// reloj con cúpula.
function makeClockBuilding() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ map: rep(TEX.arched, 3, 1) });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2ecdd });
  const slate = new THREE.MeshLambertMaterial({ color: 0x46525e });
  box(46, 12, 15, bodyMat, 0, 6, 0, g);
  for (const sx of [-22.6, 22.6]) box(1.8, 12, 15.6, white, sx, 6, 0, g); // cadenas de esquina
  box(47.6, 1.0, 16.6, white, 0, 12.5, 0, g);                            // cornisa
  // Mansarda (pirámide truncada de pizarra) con buhardillas.
  const mansard = new THREE.Mesh(new THREE.CylinderGeometry(23, 33.6, 4.4, 4), slate);
  mansard.rotation.y = Math.PI / 4;
  mansard.scale.z = 0.34;
  mansard.position.y = 15.2;
  mansard.castShadow = true;
  g.add(mansard);
  for (const dx of [-14, 14]) {
    box(2.2, 2.0, 2.0, white, dx, 14.6, 6.9, g);
    box(2.6, 0.5, 2.2, slate, dx, 15.8, 6.9, g);
  }
  // Torre del reloj.
  box(9, 13, 9, bodyMat, 0, 17, 0, g);
  box(10.2, 0.9, 10.2, white, 0, 23.7, 0, g);
  box(7.6, 4.4, 7.6, white, 0, 26.3, 0, g);
  const clockMat = new THREE.MeshLambertMaterial({ map: TEX.clock });
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), clockMat);
    const a = (i * Math.PI) / 2;
    face.position.set(Math.sin(a) * 3.85, 26.3, Math.cos(a) * 3.85);
    face.rotation.y = a;
    g.add(face);
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    slate
  );
  dome.position.y = 28.4;
  dome.scale.y = 1.15;
  dome.castShadow = true;
  g.add(dome);
  cylinder(0.1, 0.1, 3.4, 6, 0xd8d8d8, 0, 34.5, 0, g);   // pináculo
  return g;
}

// Tinglado modernista (1911): nave con portones de arco, cenefa de
// azulejo y cubierta metálica suavemente curvada.
function makeTinglado() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ map: rep(TEX.tinglado, 5, 1) });
  box(42, 8.5, 60, wallMat, 0, 4.25, 0, g);
  // Cubierta curvada (media caña aplastada).
  const roofGeo = new THREE.CylinderGeometry(21, 21, 60, 22, 1, true, Math.PI / 2, Math.PI);
  roofGeo.rotateX(Math.PI / 2);
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshLambertMaterial({ color: 0x995840, side: THREE.DoubleSide })
  );
  roof.scale.y = 0.34;
  roof.position.y = 8.5;
  roof.castShadow = true;
  g.add(roof);
  // Testeros bajo la curva.
  for (const sz of [-30, 30]) {
    const endGeo = new THREE.CircleGeometry(21, 18, 0, Math.PI);
    const end = new THREE.Mesh(endGeo, wallMat);
    end.scale.y = 0.34;
    end.position.set(0, 8.5, sz);
    end.material = new THREE.MeshLambertMaterial({ map: rep(TEX.tinglado, 2, 1), side: THREE.DoubleSide });
    g.add(end);
  }
  return g;
}

// Faro-mirador blanco de la Marina de València.
function makeFaroMarina() {
  const g = new THREE.Group();
  cylinder(1.6, 2.2, 2.4, 12, 0xe8e4da, 0, 1.2, 0, g);      // base
  cylinder(0.95, 1.3, 21, 12, 0xf6f4ee, 0, 12.9, 0, g);     // fuste
  cylinder(2.4, 1.6, 1.2, 12, 0xf6f4ee, 0, 23.9, 0, g);     // galería
  const cab = cylinder(1.7, 1.7, 2.6, 12, 0x2e4854, 0, 25.8, 0, g); // mirador acristalado
  void cab;
  cylinder(1.9, 1.9, 0.5, 12, 0xf6f4ee, 0, 27.3, 0, g);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0xffffff, emissiveIntensity: 0.8 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
  lamp.position.y = 28.1; g.add(lamp);
  return g;
}

// Yate a motor blanco.
function makeYacht() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.1, 7.5, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xf7f7f4 })
  );
  hull.geometry.rotateX(Math.PI / 2);
  hull.scale.set(1.05, 0.6, 1);
  hull.position.y = 0.6;
  hull.castShadow = true;
  g.add(hull);
  box(3.4, 1.2, 4.6, 0xf1f1ec, 0, 1.7, 0.6, g);              // superestructura
  const shield = box(3.0, 1.0, 1.4, 0x22313c, 0, 2.0, -1.9, g); // parabrisas
  shield.rotation.x = 0.35;
  box(0.3, 1.4, 0.3, 0xd9d9d4, 0, 3.0, 2.2, g);              // arco de radar
  return g;
}

function makeStreetlight() {
  const g = new THREE.Group();
  cylinder(0.09, 0.14, 6.2, 6, 0x2e3a34, 0, 3.1, 0, g);
  box(2.6, 0.1, 0.1, 0x2e3a34, 0, 6.1, 0, g);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xf5efd8, emissive: 0xfff3c8, emissiveIntensity: 0.35 });
  for (const dx of [-1.2, 1.2]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 7), lampMat);
    lamp.position.set(dx, 5.95, 0);
    g.add(lamp);
  }
  return g;
}

function makePalm() {
  const g = new THREE.Group();
  // Tronco en dos tramos ligeramente curvado, con anillos.
  const lean = (Math.random() - 0.5) * 0.2;
  const t1 = cylinder(0.17, 0.26, 3.6, 7, 0x8a6d4b, 0, 1.8, 0, g);
  t1.rotation.z = lean * 0.5;
  const t2 = cylinder(0.13, 0.17, 3.4, 7, 0x957a56, Math.sin(lean) * 2.2, 4.9, 0, g);
  t2.rotation.z = lean;
  const topX = Math.sin(lean) * 3.2;
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2d7038, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x3d8a44, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.5, 4, 1), leafMat);
    // Dobla la hoja hacia abajo en la punta.
    const pos = leaf.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      if (x > 0) pos.setY(v, pos.getY(v) - (x / 1.7) * (x / 1.7) * 0.55);
    }
    leaf.geometry.computeVertexNormals();
    leaf.material = i % 2 ? leafMat : leafMat2;
    leaf.position.set(topX, 6.5, 0);
    leaf.rotation.y = (i / 11) * Math.PI * 2 + Math.random() * 0.4;
    leaf.rotateOnAxis(new THREE.Vector3(0, 0, 1), 0.25 + Math.random() * 0.5);
    leaf.translateX(1.5);
    leaf.castShadow = true;
    g.add(leaf);
  }
  // Racimo de dátiles.
  const dates = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xb07f2e })
  );
  dates.position.set(topX + 0.3, 6.2, 0.2);
  g.add(dates);
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
  const hullMat = new THREE.MeshLambertMaterial({ map: TEX.shipHull });
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
  // Farolas y barandilla del paseo.
  for (let i = 0; i < 9; i++) {
    const sl = makeStreetlight();
    sl.position.set(-185 + i * 46, 3.4, 173);
    scene.add(sl);
  }
  box(460, 0.07, 0.07, 0xe8e8e4, 0, 4.45, 166.6, scene, false);
  box(460, 0.07, 0.07, 0xe8e8e4, 0, 3.95, 166.6, scene, false);
  // Ciudad del Cabanyal/Grau: manzanas con fachadas mediterráneas y
  // tejados de teja, torres altas al fondo, cúpula azul y campanario.
  {
    const roofMat = new THREE.MeshLambertMaterial({ map: rep(TEX.roof, 3, 3) });
    const sideMats = [
      new THREE.MeshLambertMaterial({ map: rep(TEX.facade, 1.5, 2) }),
      new THREE.MeshLambertMaterial({ map: rep(TEX.facade, 2, 2), color: 0xd8c8b8 }),
      new THREE.MeshLambertMaterial({ map: rep(TEX.facade, 1.5, 2), color: 0xc8d0c0 }),
      new THREE.MeshLambertMaterial({ map: rep(TEX.windows, 2, 3) }),
    ];
    for (let i = 0; i < 30; i++) {
      const w = 14 + Math.random() * 18;
      const tall = i % 4 === 3;
      const h = tall ? 34 + Math.random() * 30 : 12 + Math.random() * 16;
      const side = sideMats[i % 4];
      const top = tall ? new THREE.MeshLambertMaterial({ color: 0x9aa4ac }) : roofMat;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        [side, side, top, side, side, side]
      );
      b.position.set(-380 + i * 26 + (Math.random() - 0.5) * 12, h / 2 + 3, 300 + Math.random() * 130);
      scene.add(b);
    }
    // Torres residenciales al fondo.
    for (const [tx, tz, th] of [[-320, 420, 88], [300, 440, 76], [180, 460, 95]]) {
      const t = new THREE.Mesh(
        new THREE.BoxGeometry(26, th, 22),
        new THREE.MeshLambertMaterial({ map: rep(TEX.windows, 3, 8), color: 0xc9d2d8 })
      );
      t.position.set(tx, th / 2 + 3, tz);
      scene.add(t);
    }
    // Iglesia con cúpula de teja azul vidriada y campanario.
    const church = new THREE.Group();
    box(22, 14, 32, new THREE.MeshLambertMaterial({ map: rep(TEX.arched, 2, 1) }), 0, 7, 0, church);
    cylinder(6.5, 6.5, 3, 12, 0xe6dcc6, 0, 15.5, 4, church);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(6.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x1f5f9e })
    );
    dome.position.set(0, 17, 4);
    church.add(dome);
    cylinder(0.12, 0.12, 3, 6, 0xd8d8d8, 0, 24.5, 4, church);
    const belfry = cylinder(2.6, 3.0, 30, 8, 0xd9cdb2, -13, 15, -12, church);
    void belfry;
    cylinder(2.2, 2.6, 3.4, 8, 0xe6dcc6, -13, 31.5, -12, church);
    const spire = cylinder(0.2, 2.0, 4, 8, 0x2e5d9e, -13, 35, -12, church);
    void spire;
    church.position.set(80, 3, 330);
    scene.add(church);
  }

  /* --- Marina Real (NO): Veles e Vents y pantalanes --- */
  quay(scene, -190, -60, 80, 460, ['E']);
  bollards(scene, -152, 160, -152, -280, 17);
  const veles = makeVelesEVents();
  veles.position.set(-185, 3.6, 90);
  veles.rotation.y = 0.35;
  scene.add(veles);
  for (const z of [-90, -170]) { // tinglados modernistas de 1911
    const tinglado = makeTinglado();
    tinglado.position.set(-195, 3.4, z);
    scene.add(tinglado);
  }
  // Letras rojas de LA MARINA junto al agua.
  {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 3.75),
      new THREE.MeshLambertMaterial({ map: TEX.sign, transparent: true, side: THREE.DoubleSide })
    );
    sign.position.set(-152.5, 5.6, 15);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
  }
  // Faro-mirador blanco de la Marina.
  const faroMarina = makeFaroMarina();
  faroMarina.position.set(-155, 3.4, -270);
  scene.add(faroMarina);
  for (let i = 0; i < 9; i++) {
    const palm = makePalm();
    palm.position.set(-158, 3.6, 130 - i * 32);
    scene.add(palm);
  }
  for (let i = 0; i < 6; i++) {
    const sl = makeStreetlight();
    sl.position.set(-155, 3.4, 100 - i * 45);
    scene.add(sl);
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
        const sb = (s + f) % 3 === 2 ? makeYacht() : makeSailboat();
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

  /* --- Playa de la Malvarrosa (esquina NE) --- */
  {
    const sandMat = new THREE.MeshLambertMaterial({ map: rep(TEX.sand, 9, 4) });
    const beach = new THREE.Mesh(new THREE.BoxGeometry(240, 1.6, 120), sandMat);
    beach.position.set(275, 0.55, 115);
    beach.receiveShadow = true;
    scene.add(beach);
    const shore = new THREE.Mesh(new THREE.BoxGeometry(240, 0.5, 24), sandMat);
    shore.position.set(275, 0.05, 52);
    scene.add(shore);
    // Sombrillas y hamacas.
    const colors = [0x2e5d9e, 0xd0261c, 0xd68910, 0x1e8449];
    for (let i = 0; i < 12; i++) {
      const x = 180 + Math.random() * 190;
      const z = 82 + Math.random() * 70;
      const u = new THREE.Group();
      cylinder(0.05, 0.05, 2.6, 5, 0xd8d8d4, 0, 1.3, 0, u);
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.7, 0.75, 9),
        new THREE.MeshLambertMaterial({ color: colors[i % 4] })
      );
      canopy.position.y = 2.7;
      canopy.castShadow = true;
      u.add(canopy);
      u.position.set(x, 1.35, z);
      scene.add(u);
      box(1.7, 0.25, 0.7, 0xf1f1ec, x + 1.6, 1.5, z + 0.4, scene);
    }
    // Torres de vigilancia.
    for (const bx of [220, 330]) {
      const tw = new THREE.Group();
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(0.18, 3.2, 0.18, 0xf1f1ec, sx * 1.1, 1.6, sz * 1.1, tw);
      }
      box(2.8, 2.2, 2.8, 0xf1f1ec, 0, 4.3, 0, tw);
      box(3.2, 0.5, 3.2, 0xd0261c, 0, 5.6, 0, tw);
      tw.position.set(bx, 1.35, 100);
      scene.add(tw);
    }
    for (let i = 0; i < 6; i++) {
      const palm = makePalm();
      palm.position.set(190 + i * 38, 1.5, 158);
      scene.add(palm);
    }
    // Espigón de rocas que protege la playa.
    scatterRocks(scene, 158, 46, 392, 46, 55);
  }

  /* --- Muelle este: terminal de contenedores y buque --- */
  quay(scene, 205, -385, 110, 690, ['W']);
  bollards(scene, 152, -60, 152, -690, 22);
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
