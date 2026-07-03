// Remo en el Puerto de Valencia — bucle principal del juego.
// Control de una sola tecla: cada pulsación es una palada; la calidad
// depende del momento en que se pulsa dentro del ciclo de recuperación.
import * as THREE from 'three';
import { createWater } from './water.js';
import { createSky, buildEnvironment, resolveHarborCollision } from './environment.js';
import { Boat } from './boat.js';
import { WaterEffects } from './effects.js';

/* ------------------------------------------------------------------ */
/* Constantes de juego                                                 */
/* ------------------------------------------------------------------ */

const DRIVE_T = 0.85;        // s, duración de la pasada
const RECOVERY_ANIM_T = 1.6; // s, la animación llega al ataque justo en la zona verde
const GAUGE_T = 2.6;         // s, recorrido total del medidor tras la pasada
// Ventanas de ritmo (s desde el final de la pasada).
const Z_EARLY = 1.05, Z_GOOD1 = 1.35, Z_PERFECT = 1.85, Z_GOOD2 = 2.25;

const BOAT_MASS = 95;        // kg, bote + remero
const DRAG_K1 = 2.0;         // resistencia viscosa (N·s/m)
const DRAG_K2 = 3.6;         // resistencia de forma (N·s²/m²)
const STROKE_FORCE = 265;    // N, pico de fuerza con palada perfecta
const DIST_GOAL = 1000;      // m

const QUALITY = {
  perfect: { power: 1.0, label: '¡Perfecta!', color: '#3ddc84', score: 100 },
  good: { power: 0.82, label: 'Buena', color: '#c8e04b', score: 75 },
  early: { power: 0.55, label: 'Demasiado pronto', color: '#ff9f43', score: 40 },
  late: { power: 0.62, label: 'Demasiado tarde', color: '#ff9f43', score: 45 },
  first: { power: 0.85, label: '¡Vamos!', color: '#8fd8ff', score: null },
};

/* ------------------------------------------------------------------ */
/* Escena base                                                         */
/* ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe8f5, 150, 1500);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);

const sunDir = new THREE.Vector3(0.45, 0.55, -0.75).normalize();
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.copy(sunDir).multiplyScalar(300);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 50;
sun.shadow.camera.far = 650;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xbfe0f5, 0x35586b, 0.9));

const sky = createSky(sunDir);
scene.add(sky);

const water = createWater(scene.fog, sunDir);
scene.add(water);

const updatables = buildEnvironment(scene);

const boat = new Boat();
scene.add(boat.group, boat.shadow);

const effects = new WaterEffects(scene);

function updateEffectsScale() {
  const h = renderer.domElement.height; // px de dispositivo
  effects.setPixelScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
}
updateEffectsScale();

/* ------------------------------------------------------------------ */
/* Estado del juego                                                    */
/* ------------------------------------------------------------------ */

const game = {
  screen: 'menu',        // menu | running | finished
  paused: false,
  stroke: 'idle',        // idle | drive | recovery
  tDrive: 0,             // s dentro de la pasada
  tRec: 0,               // s desde el final de la pasada
  power: 0,              // potencia de la palada en curso
  v: 0,                  // m/s
  heading: 0,            // rad; 0 = hacia la bocana (-Z)
  steer: 0,              // -1 (estribor) … +1 (babor)
  dist: 0,
  time: 0,               // s de sesión
  strokes: 0,
  lastCatch: -10,
  spm: 0,
  scores: [],            // últimas paladas para la nota de técnica
  camMode: 0,
  sprayTimer: 0,
  bumpCooldown: 0,       // anti-spam del aviso de choque
};

function resetGame() {
  game.screen = 'running';
  game.paused = false;
  game.stroke = 'idle';
  game.tDrive = 0;
  game.tRec = 0;
  game.power = 0;
  game.v = 0;
  game.heading = 0;
  game.steer = 0;
  game.dist = 0;
  game.time = 0;
  game.strokes = 0;
  game.lastCatch = -10;
  game.spm = 0;
  game.scores.length = 0;
  boat.group.position.set(0, 0, 0);
  boat.heading = 0;
  ui.overlayStart.style.display = 'none';
  ui.overlayEnd.style.display = 'none';
  ui.hud.style.display = 'grid';
  ui.topRight.style.display = 'block';
  ui.gaugeWrap.style.display = 'flex';
  ui.btnRow.style.display = 'flex';
  ui.btnLeft.style.display = 'flex';
  ui.btnRight.style.display = 'flex';
  ui.pausedTag.style.display = 'none';
}

/* ------------------------------------------------------------------ */
/* Remada                                                              */
/* ------------------------------------------------------------------ */

function strokeQuality() {
  if (game.strokes === 0) return QUALITY.first;
  const t = game.tRec;
  if (t < Z_EARLY) return QUALITY.early;
  if (t < Z_GOOD1) return QUALITY.good;
  if (t < Z_PERFECT) return QUALITY.perfect;
  if (t < Z_GOOD2) return QUALITY.good;
  return QUALITY.late;
}

const _tip = new THREE.Vector3();

function row() {
  if (game.screen !== 'running' || game.paused) return;
  if (game.stroke === 'drive') return; // ya está en plena pasada

  const q = strokeQuality();
  if (q === QUALITY.early) game.v *= 0.96; // palada precipitada: frena el barco

  game.power = q.power;
  game.stroke = 'drive';
  game.tDrive = 0;
  game.strokes++;
  if (q.score !== null) {
    game.scores.push(q.score);
    if (game.scores.length > 12) game.scores.shift();
  }
  const now = game.time;
  if (now - game.lastCatch < 6) game.spm = 60 / (now - game.lastCatch);
  game.lastCatch = now;

  showFeedback(q.label, q.color);
  audio.splash(q.power);
  for (let i = 0; i < 2; i++) {
    boat.bladeTipWorld(i, _tip);
    effects.bladeSplash(_tip, q.power);
  }
}

/* ------------------------------------------------------------------ */
/* Interfaz                                                            */
/* ------------------------------------------------------------------ */

const ui = {};
for (const id of ['hud', 'topRight', 'speedVal', 'splitVal', 'spmVal', 'distVal',
  'techVal', 'camLabel', 'sndLabel', 'gaugeWrap', 'gauge', 'gaugeCursor',
  'feedback', 'btnRow', 'btnLeft', 'btnRight', 'overlayStart', 'overlayEnd',
  'endStats', 'btnStart', 'btnRestart', 'pausedTag']) {
  ui[id] = document.getElementById(id);
}

// Zonas del medidor pintadas como degradado según las ventanas de tiempo.
{
  const p = (t) => ((t / GAUGE_T) * 100).toFixed(1) + '%';
  const cEarly = '#e07856', cGood = '#e6c84f', cPerfect = '#57c979';
  ui.gauge.style.background = `linear-gradient(90deg,
    ${cEarly} 0%, ${cEarly} ${p(Z_EARLY)},
    ${cGood} ${p(Z_EARLY)}, ${cGood} ${p(Z_GOOD1)},
    ${cPerfect} ${p(Z_GOOD1)}, ${cPerfect} ${p(Z_PERFECT)},
    ${cGood} ${p(Z_PERFECT)}, ${cGood} ${p(Z_GOOD2)},
    ${cEarly} ${p(Z_GOOD2)}, ${cEarly} 100%)`;
}

function showFeedback(text, color) {
  ui.feedback.textContent = text;
  ui.feedback.style.color = color;
  ui.feedback.classList.remove('pop');
  void ui.feedback.offsetWidth; // reinicia la animación CSS
  ui.feedback.classList.add('pop');
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function updateHUD() {
  ui.speedVal.textContent = (game.v * 3.6).toFixed(1).replace('.', ',') + ' km/h';
  ui.splitVal.textContent = game.v > 0.3 ? fmtTime(500 / game.v) + ' /500m' : '—';
  ui.spmVal.textContent = (game.time - game.lastCatch < 6 && game.spm > 0)
    ? game.spm.toFixed(0) + ' ppm' : '— ppm';
  ui.distVal.textContent = Math.floor(game.dist) + ' m';

  if (game.scores.length) {
    const avg = game.scores.reduce((a, b) => a + b, 0) / game.scores.length;
    ui.techVal.textContent = Math.round(avg) + ' %';
    ui.techVal.style.color = avg >= 85 ? '#3ddc84' : avg >= 60 ? '#c8e04b' : '#ff9f43';
  } else {
    ui.techVal.textContent = '—';
  }

  // Cursor del medidor.
  let frac = 0;
  if (game.stroke === 'recovery') frac = Math.min(game.tRec / GAUGE_T, 1);
  else if (game.stroke === 'drive') frac = 0;
  ui.gaugeCursor.style.left = `calc(${(frac * 100).toFixed(2)}% - 2px)`;
  ui.gaugeCursor.style.opacity = game.stroke === 'recovery' ? '1' : '0.25';
}

function finishSession() {
  game.screen = 'finished';
  const avg = game.scores.length
    ? game.scores.reduce((a, b) => a + b, 0) / game.scores.length : 0;
  const avgSpm = game.time > 0 ? (game.strokes / (game.time / 60)) : 0;
  ui.endStats.innerHTML = `
    <span>Tiempo</span><span class="v">${fmtTime(game.time)}</span>
    <span>Paladas</span><span class="v">${game.strokes}</span>
    <span>Ritmo medio</span><span class="v">${avgSpm.toFixed(1)} ppm</span>
    <span>Velocidad media</span><span class="v">${(DIST_GOAL / game.time * 3.6).toFixed(1).replace('.', ',')} km/h</span>
    <span>Técnica</span><span class="v">${Math.round(avg)} %</span>`;
  ui.overlayEnd.style.display = 'flex';
  ui.btnRow.style.display = 'none';
  ui.btnLeft.style.display = 'none';
  ui.btnRight.style.display = 'none';
  ui.gaugeWrap.style.display = 'none';
}

/* ------------------------------------------------------------------ */
/* Sonido (WebAudio procedural, sin ficheros)                          */
/* ------------------------------------------------------------------ */

const audio = {
  ctx: null, master: null, muted: false,
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    // Rumor del agua: ruido en bucle filtrado con vaivén lento.
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.4;
    const g = this.ctx.createGain(); g.gain.value = 0.045;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.018;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start(); lfo.start();
  },
  splash(power) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const dur = 0.35;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(950, t0);
    bp.frequency.exponentialRampToValueAtTime(350, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28 * power, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
  },
  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    ui.sndLabel.textContent = this.muted ? 'Sonido: silenciado' : 'Sonido: activado';
  },
};

/* ------------------------------------------------------------------ */
/* Cámara                                                              */
/* ------------------------------------------------------------------ */

const CAM_MODES = [
  { label: 'seguimiento', offset: new THREE.Vector3(0, 3.6, 10), look: new THREE.Vector3(0, 0.8, -10) },
  { label: 'lateral', offset: new THREE.Vector3(11, 2.4, -1.5), look: new THREE.Vector3(0, 0.5, -1) },
  { label: 'remero', offset: new THREE.Vector3(0, 1.5, -0.6), look: new THREE.Vector3(0, 1.1, 40) },
  { label: 'panorámica', orbital: true },
];
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

camera.position.set(0, 3.6, 10);

// Gira un desplazamiento local del bote al mundo según el rumbo.
function headingOffset(out, off, th) {
  const c = Math.cos(th), s = Math.sin(th);
  return out.set(off.x * c + off.z * s, off.y, -off.x * s + off.z * c);
}

function updateCamera(dt, t) {
  const mode = CAM_MODES[game.camMode];
  const bp = boat.group.position;
  if (mode.orbital) {
    // Órbita lenta alrededor del bote: enseña todo el puerto.
    const a = t * 0.14;
    _camTarget.set(bp.x + Math.cos(a) * 16, bp.y + 5.5, bp.z + Math.sin(a) * 16);
    _lookTarget.set(bp.x, bp.y + 1, bp.z);
    const k = 1 - Math.exp(-2.5 * dt);
    camera.position.lerp(_camTarget, k);
    camera.lookAt(_lookTarget);
    return;
  }
  headingOffset(_camTarget, mode.offset, game.heading).add(bp);
  headingOffset(_lookTarget, mode.look, game.heading).add(bp);
  const k = 1 - Math.exp(-4.5 * dt);
  camera.position.lerp(_camTarget, game.camMode === 2 ? 1 : k);
  camera.lookAt(_lookTarget);
}

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

function startSession() {
  audio.ensure();
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  resetGame();
}

// Timón: teclas mantenidas.
const steerKeys = { left: false, right: false };
function applySteerKeys() {
  game.steer = (steerKeys.left ? 1 : 0) - (steerKeys.right ? 1 : 0);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { steerKeys.left = true; applySteerKeys(); e.preventDefault(); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { steerKeys.right = true; applySteerKeys(); e.preventDefault(); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return; // ignora la repetición automática de la tecla
    if (game.screen === 'menu') startSession();
    else if (game.screen === 'running') row();
    return;
  }
  if (e.code === 'Enter' && game.screen === 'menu') { startSession(); return; }
  if (e.code === 'KeyC') {
    game.camMode = (game.camMode + 1) % CAM_MODES.length;
    ui.camLabel.textContent = 'Cámara: ' + CAM_MODES[game.camMode].label;
  }
  if (e.code === 'KeyM') { audio.ensure(); audio.toggle(); }
  if (e.code === 'KeyP' && game.screen === 'running') {
    game.paused = !game.paused;
    ui.pausedTag.style.display = game.paused ? 'block' : 'none';
  }
  if (e.code === 'KeyR' && game.screen !== 'menu') startSession();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { steerKeys.left = false; applySteerKeys(); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { steerKeys.right = false; applySteerKeys(); }
});

// Timón: botones táctiles.
function bindSteerButton(el, dir) {
  const on = (e) => { e.preventDefault(); e.stopPropagation(); if (dir > 0) steerKeys.left = true; else steerKeys.right = true; applySteerKeys(); };
  const off = () => { if (dir > 0) steerKeys.left = false; else steerKeys.right = false; applySteerKeys(); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}
bindSteerButton(ui.btnLeft, 1);
bindSteerButton(ui.btnRight, -1);

renderer.domElement.addEventListener('pointerdown', () => {
  if (game.screen === 'running') row();
});
ui.btnRow.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  row();
});
ui.btnStart.addEventListener('click', startSession);
ui.btnRestart.addEventListener('click', startSession);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateEffectsScale();
});

/* ------------------------------------------------------------------ */
/* Bucle principal                                                     */
/* ------------------------------------------------------------------ */

const _stern = new THREE.Vector3();
let lastT = performance.now();

function animate(nowMs) {
  requestAnimationFrame(animate);
  const dt = Math.min((nowMs - lastT) / 1000, 0.05);
  lastT = nowMs;
  const t = nowMs / 1000;

  water.updateTime(t);
  for (const u of updatables) u.update(t);

  const running = game.screen === 'running' && !game.paused;
  let driveKick = 0;

  if (running) {
    game.time += dt;

    // Máquina de estados de la palada.
    if (game.stroke === 'drive') {
      game.tDrive += dt;
      const prog = Math.min(game.tDrive / DRIVE_T, 1);
      const force = STROKE_FORCE * game.power * Math.sin(Math.PI * prog);
      game.v += (force / BOAT_MASS) * dt;
      driveKick = Math.sin(Math.PI * prog);
      // Rocío de las palas mientras están en el agua.
      game.sprayTimer -= dt;
      if (game.sprayTimer <= 0 && game.v > 1) {
        game.sprayTimer = 0.05;
        for (let i = 0; i < 2; i++) {
          boat.bladeTipWorld(i, _tip);
          effects.bladeSpray(_tip);
        }
      }
      if (game.tDrive >= DRIVE_T) { game.stroke = 'recovery'; game.tRec = 0; }
    } else if (game.stroke === 'recovery') {
      game.tRec += dt;
    }

    // Resistencia del agua (viscosa + de forma) e integración.
    const drag = DRAG_K1 * game.v + DRAG_K2 * game.v * game.v;
    game.v = Math.max(game.v - (drag / BOAT_MASS) * dt, 0);

    // Timón: gira mejor con arrancada; girar también frena un poco.
    const yawRate = game.steer * 0.38 * THREE.MathUtils.clamp(game.v / 1.6, 0.22, 1);
    game.heading += yawRate * dt;
    if (game.steer !== 0) game.v *= 1 - 0.12 * dt;
    boat.heading = game.heading;
    boat.turnRoll = THREE.MathUtils.lerp(boat.turnRoll, yawRate * game.v * 0.02, 1 - Math.exp(-5 * dt));

    const fwdX = -Math.sin(game.heading), fwdZ = -Math.cos(game.heading);
    boat.group.position.x += fwdX * game.v * dt;
    boat.group.position.z += fwdZ * game.v * dt;
    game.dist += game.v * dt;

    // Choques contra muelles, buques y escolleras.
    game.bumpCooldown -= dt;
    if (resolveHarborCollision(boat.group.position, 4)) {
      game.v *= Math.max(1 - 3 * dt, 0.4);
      if (game.bumpCooldown <= 0) {
        game.bumpCooldown = 2.5;
        showFeedback('¡Cuidado con el muelle!', '#ff6b5e');
        audio.splash(0.5);
      }
    }

    if (game.dist >= DIST_GOAL) finishSession();
  }

  // Fase de animación del ciclo para el bote.
  let phase = 0;
  let idle = false;
  if (game.stroke === 'drive') {
    phase = 0.4 * Math.min(game.tDrive / DRIVE_T, 1);
  } else if (game.stroke === 'recovery') {
    phase = 0.4 + 0.6 * Math.min(game.tRec / RECOVERY_ANIM_T, 1);
    if (phase >= 1) phase = 0.9999;
  } else {
    idle = true;
  }
  boat.update(t, phase, idle, driveKick);

  // Estela (popa según el rumbo).
  _stern.set(
    boat.group.position.x + Math.sin(game.heading) * 4.1,
    0,
    boat.group.position.z + Math.cos(game.heading) * 4.1
  );
  effects.updateWake(dt, _stern, game.v);
  effects.step(dt);

  // El cielo y el sol (con su cámara de sombras) siguen al bote.
  sky.position.x = boat.group.position.x;
  sky.position.z = boat.group.position.z;
  sun.position.copy(sunDir).multiplyScalar(300).add(boat.group.position);
  sun.target.position.copy(boat.group.position);

  updateCamera(dt, t);
  if (game.screen !== 'menu') updateHUD();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
