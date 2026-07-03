# Remo en el Puerto de Valencia 🚣

Simulador web de remo (skiff individual) en la dársena del Puerto de
Valencia, construido con **Three.js + WebGL**. Pensado para practicar la
**técnica y el ritmo de palada**, no para competir.

![Juego](https://img.shields.io/badge/Three.js-r160-blue) ![Idioma](https://img.shields.io/badge/idioma-español-yellow)

## Cómo jugar

- **ESPACIO** (o tocar la pantalla / botón REMAR): dar una palada.
- El control es de **una sola tecla**: cada pulsación ejecuta el ciclo
  completo de la palada (ataque → pasada → salida → recuperación).
- La clave es el **ritmo**: tras cada pasada, un cursor recorre el medidor
  inferior. Pulsa cuando esté en la **zona verde** para una palada
  perfecta:
  - **Demasiado pronto** → palada precipitada, poca potencia y frenas el barco.
  - **Demasiado tarde** → pierdes el deslizamiento y la velocidad decae.
- Objetivo: completar **1000 m** por la calle de boyas con la mejor nota
  de técnica posible.

| Tecla | Acción |
| ----- | ------ |
| `ESPACIO` | Remar |
| `C` | Cambiar cámara (seguimiento / lateral / remero) |
| `M` | Activar/silenciar sonido |
| `P` | Pausa |
| `R` | Reiniciar sesión |

## Ejecutar en local

### Opción A: un solo archivo (escritorio, doble clic)

`RemoValencia.html` es el juego completo empaquetado en un único archivo
autocontenido: descárgalo y ábrelo con doble clic en cualquier navegador
(Chrome, Edge, Firefox…), sin servidor ni instalación. Se regenera con:

```bash
node build-standalone.mjs
```

### Opción B: servidor estático (código fuente en módulos)

`index.html` usa módulos ES, así que necesita un servidor estático
(no funciona con `file://`):

```bash
# opción 1
python3 -m http.server 8000

# opción 2
npx serve .
```

Y abre <http://localhost:8000>.

## Física (realista pero simplificada)

- **Resistencia del agua**: `F = k₁·v + k₂·v²` (componente viscosa + de
  forma), con masa conjunta bote+remero de 95 kg.
- **Propulsión**: cada pasada aplica un perfil de fuerza senoidal durante
  0,85 s, escalado por la calidad del ritmo. Una palada precipitada
  además "clava" el bote (pequeña pérdida de velocidad, como un check
  real).
- Velocidad de crucero resultante: ~3,5–4 m/s (≈ 13–14 km/h), en línea
  con un skiff recreativo. El HUD muestra velocidad, parcial /500 m,
  paladas por minuto y distancia.

## Gráficos

- **Agua**: shader propio con oleaje suave por vértice y normales
  procedurales de alta frecuencia (fresnel, reflejo del cielo y brillo
  solar). La misma función de altura se evalúa en JS para que el bote,
  las boyas y los veleros floten de forma coherente.
- **Entorno del puerto** (estilizado, 100 % procedural, sin texturas
  externas): grúas pórtico azules con contenedores, edificio *Veles e
  Vents*, tinglados, palmeras, veleros amarrados, escolleras con faros
  rojo/verde en la bocana, silueta de la ciudad y gaviotas.
- **Efectos**: salpicadura y rocío de las palas, estela de espuma,
  sonido procedural de agua y paladas (WebAudio, sin ficheros).

## Estructura

```
index.html          UI/HUD y arranque
js/main.js          Bucle de juego, física, ritmo, cámara, sonido
js/water.js         Shader del agua + función de altura compartida
js/environment.js   Cielo y escenario del puerto
js/boat.js          Skiff, remero y animación del ciclo de palada
js/effects.js       Partículas de salpicaduras y estela
js/vendor/          Three.js r160 (autocontenido, sin CDN)
```
