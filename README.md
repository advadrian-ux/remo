# Remo en el Puerto de Valencia 🚣

Simulador web de remo (skiff individual) en la dársena del Puerto de
Valencia, construido con **Three.js + WebGL**. Pensado para practicar la
**técnica y el ritmo de palada**, no para competir.

![Juego](https://img.shields.io/badge/Three.js-r160-blue) ![Idioma](https://img.shields.io/badge/idioma-español-yellow)

## Cómo jugar

- **ESPACIO** (o tocar la pantalla / botón REMAR): dar una palada.
- El control es de **una sola tecla**: cada pulsación ejecuta el ciclo
  completo de la palada (ataque → pasada → salida → recuperación).
- **◀ ▶** (o **A / D**, o los botones táctiles): timón. Puedes navegar
  libremente por toda la dársena y verla desde cualquier ángulo: la
  Marina con sus pantalanes, el Veles e Vents, el Edificio del Reloj,
  el ferry, la terminal de contenedores con su buque y la bocana con
  los faros. Los muelles, buques y escolleras tienen colisión.
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
| `◀` `▶` / `A` `D` | Timón |
| `C` | Cambiar cámara (seguimiento / lateral / remero / panorámica) |
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

- **Agua con reflexión planar real**: antes de cada fotograma se
  renderiza la escena desde una cámara reflejada bajo el plano del agua
  y el shader muestrea esa textura distorsionada por el oleaje — el
  puerto, el cielo con nubes y el propio bote se reflejan de verdad.
  Fresnel, absorción del agua, brillo solar y suavizado de normales con
  la distancia (anti-moiré). La misma función de altura se evalúa en JS
  para que el bote, las boyas y los veleros floten de forma coherente.
- **Cielo con nubes procedurales** (fbm animado con deriva de viento) y
  **entorno de iluminación PBR** (PMREM del propio cielo) para reflejos
  creíbles en el casco y las palas.
- **Entorno del puerto** (100 % procedural, con texturas detalladas
  generadas en canvas: hormigón con grietas y manchas, cantiles con
  marca de marea, chapa corrugada con desgaste, fachadas con balcones y
  toldos, casco del buque con óxido, rótulo y línea de flotación…).
  Lugares reales recreados con arquitectura reconocible:
  - **Veles e Vents** con sus losas blancas voladas, columnas esbeltas,
    vidrio retranqueado y núcleo azul.
  - **Edificio del Reloj**: ventanas de arco, cadenas de esquina,
    mansarda de pizarra con buhardillas, torre con reloj y cúpula.
  - **Tinglados modernistas de 1911** con portones de arco verdes,
    cenefa de azulejo azul y cubierta curvada.
  - Las letras rojas de **LA MARINA**, el faro-mirador blanco,
    pantalanes con veleros y yates, farolas y banderas.
  - **Playa de la Malvarrosa** al NE con espigón, sombrillas, hamacas
    y torres de vigilancia.
  - Terminal de contenedores con **buque "Turia Express"** atracado
    bajo las grúas pórtico, ferry, silos, escolleras con faros
    rojo/verde y ciudad del Cabanyal con tejados de teja, cúpula azul
    y campanario.
- **Iluminación**: sol direccional con sombras (PCF suave) que siguen
  al bote, tone mapping ACES y niebla atmosférica.
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
