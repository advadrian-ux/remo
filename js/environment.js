// Entorno del Puerto de Valencia (estilizado y procedural):
// cielo mediterráneo, dársena con muelles, grúas pórtico azules,
// contenedores, edificio Veles e Vents, palmeras, veleros amarrados,
// escolleras con faros en la bocana, boyas de calle y gaviotas.
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
/* Piezas del puerto                                                   */
/* ------------------------------------------------------------------ */

function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

// Grúa pórtico portacontenedores (azul, como las del muelle de Valencia).
function makeCrane() {
  const g = new THREE.Group();
  const blue = 0x1f4f9e;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(1.4, 26, 1.4, blue, sx * 7, 13, sz * 9, g);
  }
  box(16, 1.6, 1.6, blue, 0, 26, -9, g);
  box(16, 1.6, 1.6, blue, 0, 26, 9, g);
  box(1.6, 1.6, 19, blue, -7, 26, 0, g);
  box(1.6, 1.6, 19, blue, 7, 26, 0, g);
  // Pluma sobre el agua (hacia -x local) y tirante trasero.
  const boom = box(52, 1.8, 2.4, blue, -14, 30, 0, g);
  boom.rotation.z = -0.02;
  box(1.2, 12, 1.2, blue, 4, 36, 0, g);           // mástil
  const tie = box(30, 0.4, 0.4, 0x9fb4cc, -10, 35.5, 0, g);
  tie.rotation.z = 0.2;
  box(6, 4, 8, 0xdde4ea, 2, 29, 0, g);            // cabina/maquinaria
  box(3, 1.4, 3, 0xd94f30, -26, 28.7, 0, g);      // carro
  return g;
}

// Edificio Veles e Vents (lamas blancas voladas, Marina Real).
function makeVelesEVents() {
  const g = new THREE.Group();
  const white = 0xf4f2ec;
  const glass = 0x27404f;
  box(34, 1.6, 26, white, 0, 3.0, 0, g);
  box(28, 4.2, 21, glass, 1, 5.9, 0, g);
  box(40, 1.8, 30, white, -3, 8.9, 0, g);
  box(26, 4.2, 19, glass, 2, 11.9, 0, g);
  box(44, 1.8, 32, white, -6, 14.9, 0, g);
  box(22, 4.0, 17, glass, 3, 17.8, 0, g);
  box(36, 1.6, 26, white, -2, 20.6, 0, g);
  return g;
}

function makePalm() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.24, 6.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6d4b })
  );
  trunk.position.y = 3.25;
  trunk.rotation.z = (Math.random() - 0.5) * 0.14;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.55), leafMat);
    leaf.position.set(0, 6.4, 0);
    leaf.rotation.y = (i / 8) * Math.PI * 2;
    leaf.rotateOnAxis(new THREE.Vector3(0, 0, 1), 0.55 + Math.random() * 0.35);
    leaf.translateX(1.35);
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
  g.add(hull);
  box(4.6, 0.3, 1.5, 0xd8cfc0, 0, 0.6, 0, g);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 8.5, 6),
    new THREE.MeshLambertMaterial({ color: 0xb9bcc2 })
  );
  mast.position.set(0, 4.8, 0.3);
  g.add(mast);
  box(0.08, 0.08, 2.6, 0xb9bcc2, 0, 1.6, 1.6, g);
  return g;
}

function makeLightTower(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.4, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0xc9c4bb })
  );
  base.position.y = 1.5;
  g.add(base);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.5, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf1ede4 })
  );
  tower.position.y = 9;
  g.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(1.32, 1.32, 3, 10),
    new THREE.MeshLambertMaterial({ color })
  );
  band.position.y = 10;
  g.add(band);
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
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    const x = x0 + (x1 - x0) * f + (Math.random() - 0.5) * 7;
    const z = z0 + (z1 - z0) * f + (Math.random() - 0.5) * 7;
    const s = 0.8 + Math.random() * 1.6;
    e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    q.setFromEuler(e);
    m.compose(
      new THREE.Vector3(x, Math.random() * 1.2, z),
      q,
      new THREE.Vector3(s, s * (0.6 + Math.random() * 0.5), s)
    );
    inst.setMatrixAt(i, m);
  }
  scene.add(inst);
}

/* ------------------------------------------------------------------ */
/* Construcción de la escena                                           */
/* ------------------------------------------------------------------ */

export function buildEnvironment(scene) {
  const updatables = [];

  /* --- Muelle este: terminal de contenedores --- */
  box(70, 5, 720, 0x9a958c, 130, 2.0, -380, scene);       // explanada
  box(4, 5.6, 720, 0x848078, 97, 2.3, -380, scene);        // cantil
  for (const z of [-200, -360, -520, -680]) {
    const crane = makeCrane();
    crane.position.set(122, 4.5, z);
    scene.add(crane);
  }
  // Pilas de contenedores de colores.
  {
    const colors = [0xc0392b, 0x2471a3, 0x1e8449, 0xd68910, 0x148f77, 0x7d3c98];
    const geo = new THREE.BoxGeometry(6.1, 2.6, 2.44);
    const mat = new THREE.MeshLambertMaterial();
    const count = 110;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    let i = 0;
    outer:
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const stack = 1 + Math.floor(Math.random() * 3);
        for (let s = 0; s < stack; s++) {
          if (i >= count) break outer;
          m.makeTranslation(146 + row * 7.4, 5.8 + s * 2.65, -180 - col * 26 - row * 3);
          inst.setMatrixAt(i, m);
          inst.setColorAt(i, new THREE.Color(colors[(i * 7) % colors.length]));
          i++;
        }
      }
    }
    inst.count = i;
    scene.add(inst);
  }

  /* --- Muelle oeste: Marina Real, junto a la salida --- */
  box(120, 4, 380, 0xb7b1a5, -120, 1.6, -40, scene);       // paseo de la marina
  box(4, 4.6, 380, 0x8f897d, -62, 1.9, -40, scene);

  const veles = makeVelesEVents();
  veles.position.set(-115, 3.6, 30);
  veles.rotation.y = 0.18;
  scene.add(veles);

  // Tinglados históricos (naves con techo rojo).
  for (const z of [-120, -190]) {
    box(46, 9, 55, 0xd9d2c4, -125, 8.1, z, scene);
    const roof = box(48, 3, 57, 0xa5432e, -125, 14, z, scene);
    roof.scale.y = 0.8;
  }

  // Palmeras del paseo.
  for (let i = 0; i < 12; i++) {
    const palm = makePalm();
    palm.position.set(-70 - (i % 2) * 6, 3.6, 110 - i * 24);
    palm.rotation.y = Math.random() * Math.PI * 2;
    scene.add(palm);
  }

  // Veleros amarrados que cabecean con el agua.
  for (let i = 0; i < 6; i++) {
    const sb = makeSailboat();
    const x = -46 - (i % 2) * 9;
    const z = 60 - i * 22;
    sb.position.set(x, 0, z);
    sb.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
    scene.add(sb);
    updatables.push({
      update(t) {
        sb.position.y = waterHeight(x, z, t) + 0.1;
        sb.rotation.z = waterHeight(x + 2, z, t) * 0.5;
        sb.rotation.x = waterHeight(x, z + 2, t) * 0.4;
      },
    });
  }

  /* --- Bocana: escolleras convergentes y faros --- */
  box(16, 4.5, 420, 0x8a8378, 78, 1.6, -960, scene);
  scatterRocks(scene, 70, -760, 70, -1160, 90);
  box(16, 4.5, 340, 0x8a8378, -74, 1.6, -1000, scene);
  scatterRocks(scene, -66, -840, -66, -1160, 80);

  const faroVerde = makeLightTower(0x1e8449);  // estribor al entrar
  faroVerde.position.set(78, 3.5, -1150);
  scene.add(faroVerde);
  const faroRojo = makeLightTower(0xc0392b);
  faroRojo.position.set(-74, 3.5, -1150);
  scene.add(faroRojo);
  updatables.push({
    update(t) {
      faroVerde.userData.lampMat.emissiveIntensity = (Math.sin(t * 2.2) > 0.3) ? 2.2 : 0.15;
      faroRojo.userData.lampMat.emissiveIntensity = (Math.sin(t * 2.2 + Math.PI) > 0.3) ? 2.2 : 0.15;
    },
  });

  /* --- Silueta de la ciudad tras la línea de salida --- */
  {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0x93a7b8 });
    const count = 42;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const x = -520 + i * 25 + (Math.random() - 0.5) * 14;
      const h = 14 + Math.random() * 46;
      const w = 12 + Math.random() * 16;
      m.compose(
        new THREE.Vector3(x, h / 2, 300 + Math.random() * 120),
        q,
        new THREE.Vector3(w, h, w)
      );
      inst.setMatrixAt(i, m);
    }
    scene.add(inst);
    // Muelle bajo la ciudad para cerrar la dársena por el norte.
    box(1100, 4, 60, 0xa39d91, 0, 1.5, 230, scene);
  }

  /* --- Boyas de la calle de entrenamiento --- */
  {
    const buoyGeo = new THREE.SphereGeometry(0.4, 10, 8);
    const buoyMat = new THREE.MeshLambertMaterial({ color: 0xf07818 });
    for (let z = 20; z >= -1060; z -= 80) {
      for (const x of [-11, 11]) {
        const b = new THREE.Mesh(buoyGeo, buoyMat);
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.7, 5),
          new THREE.MeshLambertMaterial({ color: 0xffffff })
        );
        pole.position.y = 0.55;
        b.add(pole);
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
    for (let i = 0; i < 5; i++) {
      const gull = new THREE.Group();
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.35), gullMat);
      const wr = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.35), gullMat);
      wl.position.x = -0.65;
      wr.position.x = 0.65;
      gull.add(wl, wr);
      scene.add(gull);
      const cx = (Math.random() - 0.5) * 120;
      const cz = -100 - Math.random() * 700;
      const r = 25 + Math.random() * 40;
      const h = 18 + Math.random() * 22;
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
