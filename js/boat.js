// Skiff individual con remero y palas animadas.
// La animación se controla con una fase de ciclo p ∈ [0,1]:
//   0.00–0.40  pasada (palas en el agua, empuje)
//   0.40–0.50  salida (las palas suben y se ponen planas)
//   0.50–0.93  recuperación (vuelta al ataque, palas planas)
//   0.93–1.00  preparación del ataque (palas se cuadran y bajan)
import * as THREE from 'three';
import { waterHeight } from './water.js';

const CATCH_SWEEP = 0.95;   // rad, palas hacia proa (ataque)
const FINISH_SWEEP = -0.75; // rad, palas hacia popa (final)
const HULL_LEN = 7.8;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();

function ease(x) { return x * x * (3 - 2 * x); }
function lerp(a, b, t) { return a + (b - a) * t; }

function orientBetween(mesh, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  mesh.position.copy(a).addScaledVector(_dir, 0.5);
  mesh.scale.y = Math.max(len, 0.001);
  _dir.normalize();
  mesh.quaternion.setFromUnitVectors(_up, _dir);
}

function makeOar(side, materials) {
  // Pivote en la chumacera; la pala se extiende hacia fuera (±X).
  const pivot = new THREE.Group();
  pivot.position.set(0.85 * side, 0.34, 0);
  const feather = new THREE.Group();
  pivot.add(feather);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 3.3, 8), materials.shaft);
  shaft.geometry.rotateZ(Math.PI / 2);
  shaft.position.x = 1.3 * side;
  feather.add(shaft);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.3), materials.blade);
  blade.position.x = 2.95 * side;
  feather.add(blade);

  return { pivot, feather, side };
}

export class Boat {
  constructor() {
    this.group = new THREE.Group();
    // Rumbo (Y) primero, luego cabeceo (X) y balanceo (Z).
    this.group.rotation.order = 'YXZ';
    this.heading = 0; // rad; 0 = hacia -Z

    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.18, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x24313a, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98d68, roughness: 0.7 });
    const kitMat = new THREE.MeshStandardMaterial({ color: 0xdd5522, roughness: 0.6 });   // equipación naranja
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.5 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf07818, roughness: 0.4 }); // palas naranja Valencia

    // Casco: huso de revolución (proa y popa afiladas, como un skiff real).
    {
      const pts = [];
      const N = 22;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const r = Math.pow(Math.sin(t * Math.PI), 0.72);
        pts.push(new THREE.Vector2(Math.max(r, 0.001), t * 2 - 1));
      }
      const geo = new THREE.LatheGeometry(pts, 18);
      geo.rotateX(Math.PI / 2); // eje a lo largo de Z
      const hull = new THREE.Mesh(geo, hullMat);
      hull.scale.set(0.26, 0.15, HULL_LEN / 2);
      hull.position.y = 0.06;
      this.group.add(hull);
      // Bola de proa reglamentaria.
      const bowBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 })
      );
      bowBall.position.set(0, 0.07, -HULL_LEN / 2 - 0.02);
      this.group.add(bowBall);
      // Orza bajo la popa.
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16, 0.22), hullMat);
      fin.position.set(0, -0.12, 1.9);
      this.group.add(fin);
    }

    // Franja de cubierta y carril.
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 3.2), darkMat);
    deck.position.y = 0.19;
    this.group.add(deck);

    // Portantes (riggers) y chumaceras.
    for (const side of [-1, 1]) {
      const rig = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.05), darkMat);
      rig.position.set(0.5 * side, 0.28, -0.1);
      rig.rotation.z = 0.12 * side;
      this.group.add(rig);
      const rig2 = rig.clone();
      rig2.position.z = 0.35;
      this.group.add(rig2);
    }

    // Remos.
    const oarMats = { shaft: shaftMat, blade: bladeMat };
    this.oars = [makeOar(1, oarMats), makeOar(-1, oarMats)];
    for (const oar of this.oars) this.group.add(oar.pivot);

    // ----- Remero (mira hacia popa, +Z; la proa es -Z) -----
    this.rower = new THREE.Group();
    this.group.add(this.rower);

    this.seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.3), darkMat);
    this.seat.position.y = 0.24;
    this.rower.add(this.seat);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.28;
    this.rower.add(this.torso);
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.34, 4, 10), kitMat);
    chest.position.y = 0.34;
    this.torso.add(chest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skinMat);
    head.position.y = 0.68;
    this.torso.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 8, 0, Math.PI * 2, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0x1f4f9e, roughness: 0.7 }));
    cap.position.y = 0.7;
    this.torso.add(cap);

    // Piernas y brazos: cilindros unitarios reorientados cada fotograma.
    const limbGeo = new THREE.CylinderGeometry(0.05, 0.045, 1, 6);
    this.limbs = {};
    for (const name of ['thighL', 'thighR', 'shinL', 'shinR']) {
      const m = new THREE.Mesh(limbGeo, darkMat);
      this.limbs[name] = m;
      this.rower.add(m);
    }
    for (const name of ['armL', 'armR']) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 1, 6), skinMat);
      this.limbs[name] = m;
      this.rower.add(m);
    }
    // Reposapiés fijo hacia popa.
    const footplate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.06), darkMat);
    footplate.position.set(0, 0.2, 0.78);
    footplate.rotation.x = -0.5;
    this.rower.add(footplate);
    this.footPos = { L: new THREE.Vector3(-0.12, 0.16, 0.76), R: new THREE.Vector3(0.12, 0.16, 0.76) };
    this.turnRoll = 0; // escora en los giros, la fija el bucle principal

    // Sombra falsa sobre el agua (la geometría ya está tumbada para
    // poder girar la malla con el rumbo).
    const shadowTex = makeShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(3.4, 10);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.28, depthWrite: false })
    );

    // El bote y el remero proyectan sombra real.
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    this.pose = this.oarPose(0, true);
  }

  // Pose de los remos y del remero según la fase de ciclo.
  // lift: ángulo de inmersión de la pala (negativo = pala en el agua).
  oarPose(p, idle) {
    if (idle) return { sweep: 0.12, lift: -0.115, feather: 1.35, ext: 0.55, lean: 0.05 };
    let sweep, lift, feather, ext, lean;
    const FE = 1.45; // rad de pala plana
    if (p < 0.4) {            // pasada
      const q = ease(p / 0.4);
      sweep = lerp(CATCH_SWEEP, FINISH_SWEEP, q);
      lift = -0.13;
      feather = 0;
      ext = q;                // extensión de piernas 0→1
      lean = lerp(0.42, -0.32, q);
    } else if (p < 0.5) {     // salida
      const q = (p - 0.4) / 0.1;
      sweep = FINISH_SWEEP;
      lift = lerp(-0.13, 0.08, q);
      feather = FE * q;
      ext = 1;
      lean = -0.32;
    } else if (p < 0.93) {    // recuperación
      const q = ease((p - 0.5) / 0.43);
      sweep = lerp(FINISH_SWEEP, CATCH_SWEEP, q);
      lift = 0.08;
      feather = FE;
      ext = 1 - q;
      lean = lerp(-0.32, 0.42, q);
    } else {                  // preparación del ataque
      const q = (p - 0.93) / 0.07;
      sweep = CATCH_SWEEP;
      lift = lerp(0.08, -0.115, q);
      feather = FE * (1 - q);
      ext = 0;
      lean = 0.42;
    }
    return { sweep, lift, feather, ext, lean };
  }

  update(t, phase, idle, driveKick) {
    const pose = this.oarPose(phase, idle);
    this.pose = pose;

    for (const oar of this.oars) {
      oar.pivot.rotation.y = pose.sweep * oar.side;
      oar.pivot.rotation.z = pose.lift * oar.side;
      oar.feather.rotation.x = pose.feather * oar.side;
    }

    // Remero: asiento, tronco, piernas y brazos.
    const seatZ = lerp(0.34, -0.28, pose.ext); // ataque cerca de popa, final hacia proa
    this.seat.position.z = seatZ;
    this.torso.position.z = seatZ;
    this.torso.rotation.x = pose.lean;

    const comp = 1 - pose.ext;
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? -1 : 1;
      _a.set(0.09 * sx, 0.3, seatZ);                 // cadera
      const foot = this.footPos[s];
      _b.copy(_a).add(foot).multiplyScalar(0.5);
      _b.y = 0.26 + comp * 0.32;                      // la rodilla sube al comprimir
      orientBetween(this.limbs['thigh' + s], _a, _b);
      orientBetween(this.limbs['shin' + s], _b, foot);
    }

    // Brazos: del hombro al puño (extremo interior del remo).
    for (const oar of this.oars) {
      const s = oar.side;
      _euler.set(0, pose.sweep * s, pose.lift * s);
      _a.set(-0.35 * s, 0, 0).applyEuler(_euler).add(oar.pivot.position); // puño
      _b.set(0.17 * s, 0.52, 0).applyEuler(this.torso.rotation).add(this.torso.position); // hombro
      orientBetween(this.limbs[s === 1 ? 'armR' : 'armL'], _b, _a);
    }

    // Flotación: muestreo de la altura del agua en proa/popa y bandas,
    // según el rumbo actual del bote.
    const x = this.group.position.x;
    const z = this.group.position.z;
    const th = this.heading;
    const fx = -Math.sin(th), fz = -Math.cos(th); // proa
    const rx = Math.cos(th), rz = -Math.sin(th);  // estribor
    const hl = HULL_LEN / 2;
    const hB = waterHeight(x + fx * hl, z + fz * hl, t);
    const hS = waterHeight(x - fx * hl, z - fz * hl, t);
    const hL = waterHeight(x - rx * 0.9, z - rz * 0.9, t);
    const hR = waterHeight(x + rx * 0.9, z + rz * 0.9, t);
    this.group.position.y = (hB + hS) / 2 + 0.03;
    this.group.rotation.y = th;
    this.group.rotation.x = (hS - hB) / HULL_LEN + driveKick * -0.012;
    this.group.rotation.z = (hL - hR) / 1.8 + Math.sin(t * 1.3) * 0.006 + this.turnRoll;

    this.shadow.position.set(x, 0.02 + waterHeight(x, z, t) * 0.3, z);
    this.shadow.rotation.y = th;
  }

  // Posición mundial de la punta de una pala (para salpicaduras).
  bladeTipWorld(index, out) {
    const oar = this.oars[index];
    const s = oar.side;
    _euler.set(0, this.pose.sweep * s, this.pose.lift * s);
    out.set(3.0 * s, 0, 0).applyEuler(_euler).add(oar.pivot.position);
    return this.group.localToWorld(out);
  }
}

function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,10,18,0.85)');
  g.addColorStop(0.55, 'rgba(0,10,18,0.35)');
  g.addColorStop(1, 'rgba(0,10,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
