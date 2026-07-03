// Genera RemoValencia.html: el juego completo en un único archivo
// autocontenido que funciona con doble clic (file://), sin servidor.
// Uso: node build-standalone.mjs   (requiere npx/esbuild la primera vez)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const TMP = 'bundle.tmp.js';
execSync(
  `npx -y esbuild js/main.js --bundle --minify --format=iife ` +
  `--alias:three=./js/vendor/three.module.js --outfile=${TMP}`,
  { stdio: 'inherit' }
);

const bundle = readFileSync(TMP, 'utf8');
rmSync(TMP);

const html = readFileSync('index.html', 'utf8').replace(
  /<script type="importmap">[\s\S]*?<script type="module" src="\.\/js\/main\.js"><\/script>/,
  () => `<script>\n${bundle}\n</script>`
);

writeFileSync('RemoValencia.html', html);
console.log('✔ RemoValencia.html generado (' + (html.length / 1024 / 1024).toFixed(2) + ' MB)');
