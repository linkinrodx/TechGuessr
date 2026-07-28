# Implementation Plan

## Overview

Plan de implementación de la revisión de UI/UX de TechGuessr: adopción de Tailwind CSS v4, sistema de design tokens, resaltado de sintaxis con `highlight.js`, tipografía monoespaciada self-hosted, layout/encabezado compartido, microinteracciones de feedback visual y verificación final de preservación de funcionalidad. El alcance es exclusivamente de capa de presentación (Requirement 7); no se modifican `GameService`, `AuthService`, `game.types.ts` ni `app.routes.ts` en su lógica pública. Las siete áreas se implementan en orden de dependencia estricto: Tailwind primero (base del build), tokens después (usados por todo lo demás), luego highlight.js y tipografía (independientes entre sí pero ambos dependientes de Tailwind), luego layout compartido (usa utilities y tokens), luego microinteracciones (usa tokens de color y el layout), y por último la verificación integral.

## Tasks

### 1. Tailwind CSS v4

- [ ] 1.1 Verificar árbol de trabajo limpio y ejecutar baseline de pruebas
  - Confirmar con `git status` que no hay cambios sin commitear (si los hay, detener y avisar antes de continuar, según el mecanismo de rollback del Requirement 1.6).
  - Ejecutar `npm test` (Vitest) y registrar el número exacto de pruebas exitosas actuales como baseline para comparar tras cada fase posterior.
  - _Requirements: 1.5, 1.6_

- [ ] 1.2 Ejecutar el schematic `ng add tailwind`
  - Correr `ng add tailwind` en la raíz del proyecto sin editar manualmente `angular.json` ni `tsconfig.json`.
  - Verificar que el schematic haya insertado `@import "tailwindcss";` en `src/styles.scss` y generado/ajustado la configuración de PostCSS necesaria.
  - Si el schematic falla, ejecutar `git checkout -- .` para restaurar el estado previo y reportar el error antes de reintentar.
  - _Requirements: 1.1, 1.6_

- [ ] 1.3 Pinear la versión exacta de `tailwindcss` en `package.json`
  - Revisar la versión instalada realmente por el schematic en `package.json`/`package-lock.json` y reescribirla sin prefijo `^` ni `~` (valor de referencia: `4.3.3`, pero usar la versión real instalada si difiere).
  - Ejecutar `npm install` para regenerar el lockfile de forma consistente con la versión fijada.
  - _Requirements: 1.4_

- [ ] 1.4 Verificar el build de producción y aplicar al menos una utility de prueba
  - Añadir una clase utilitaria de Tailwind (por ejemplo `class="p-4"`) en un componente ya existente para confirmar que se renderiza correctamente en el navegador.
  - Ejecutar `ng build` (configuración de producción) y confirmar código de salida `0` y cero errores de compilación.
  - _Requirements: 1.1, 1.2_

- [ ] 1.5 Correr la suite Vitest completa y comparar contra el baseline
  - Ejecutar `npm test` y confirmar que el número de pruebas exitosas es idéntico al baseline registrado en la tarea 1.1.
  - Si alguna prueba falla, corregir la causa antes de continuar con la fase 2 (no se permite avanzar con pruebas rotas).
  - _Requirements: 1.5_

### 2. Sistema de design tokens y migración de componentes

- [ ] 2.1 Declarar el bloque `@theme` en `src/styles.scss`
  - Añadir el bloque `@theme` inmediatamente después de `@import "tailwindcss";` con los colores semánticos (`--color-background`, `--color-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--color-success`, `--color-error`, `--color-border`, `--color-border-subtle`), el token `--font-mono` (con el fallback stack completo) y los tokens de espaciado (`--spacing-xs` a `--spacing-xl`), según los valores exactos de la tabla del design.md.
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [ ] 2.2 Migrar `login.scss` y `register.scss` a tokens
  - Reemplazar `#4f46e5` → `var(--color-accent)`, `#888` → `var(--color-text-secondary)`, `#e53e3e` → `var(--color-error)`, `#333` → `var(--color-border)`, `#444` → `var(--color-border-subtle)` en ambos archivos.
  - Reemplazar los valores de espaciado con coincidencia exacta (`0.25rem`→`var(--spacing-xs)`, `0.5rem`→`var(--spacing-sm)`, `1rem`→`var(--spacing-md)`, `1.5rem`→`var(--spacing-lg)`, `2rem`→`var(--spacing-xl)`); dejar `4rem` y `#666` sin modificar por no tener coincidencia exacta.
  - No modificar selectores, estructura HTML ni breakpoints.
  - _Requirements: 2.3, 2.6_

- [ ] 2.3 Migrar `codeguessr-game.scss` a tokens
  - Reemplazar los mismos colores hardcodeados que en la tarea 2.2 (`#4f46e5`, `#888`, `#e53e3e`, `#444`) por sus tokens correspondientes.
  - Reemplazar el fondo `#1e1e1e` de `.snippet-card` por `var(--color-surface)`.
  - Reemplazar `font-family: 'Fira Code', monospace;` dentro de `pre` por `font-family: var(--font-mono);`.
  - Migrar los valores de espaciado con coincidencia exacta a sus tokens correspondientes.
  - _Requirements: 2.3, 2.4, 2.6_

- [ ] 2.4 Migrar `session-summary.scss` a tokens
  - Reemplazar `#4f46e5` → `var(--color-accent)`, `#888` → `var(--color-text-secondary)`, `#333` → `var(--color-border)`, `#e53e3e` → `var(--color-error)`.
  - Migrar los valores de espaciado con coincidencia exacta a sus tokens correspondientes.
  - _Requirements: 2.3, 2.6_

- [ ] 2.5 Migrar `leaderboard.scss` a tokens
  - Reemplazar `#4f46e5` (en `h2` de resultado y `.back-link`) → `var(--color-accent)`, `#888` → `var(--color-text-secondary)`, `#333` (borde de `.leaderboard-table th/td`) → `var(--color-border)`, `#e53e3e` → `var(--color-error)`.
  - Migrar los valores de espaciado con coincidencia exacta a sus tokens correspondientes.
  - _Requirements: 2.3, 2.6_

- [ ] 2.6 Verificar visualmente la migración de tokens y correr Vitest
  - Con DevTools, inspeccionar que los colores/espaciados migrados en las cinco pantallas resuelven al valor esperado vía `var(--token)`.
  - Ejecutar `npm test` y confirmar que el número de pruebas exitosas sigue siendo el mismo que el baseline.
  - _Requirements: 1.5, 7.4_

### 3. Resaltado de sintaxis con highlight.js

- [ ] 3.1 Instalar y pinear `highlight.js`
  - Ejecutar `npm install highlight.js@11.11.1` (o la última versión estable exacta disponible) y verificar en `package.json` que quede fijada sin `^`, `~`, `>=` ni rango abierto.
  - _Requirements: 3.5_

- [ ] 3.2 Crear la directiva standalone `HighlightCode`
  - Crear `src/app/shared/directives/highlight-code.ts` exportando la directiva `HighlightCode` con selector `[appHighlightCode]`, usando `highlight.js/lib/core` y registrando el subset de lenguajes (`javascript`, `typescript`, `python`, `csharp`, `java`, `xml` como `html`, `css`, `json`, `bash`, `go`, `rust`, `sql`) una sola vez a nivel de módulo.
  - Implementar el `input<string>()` con un `effect()` que llame a `hljs.highlightAuto(code)`, use `DomSanitizer.bypassSecurityTrustHtml` para escribir `innerHTML`, y capture cualquier fallo en un `try/catch` que caiga a `el.textContent = code` sin lanzar error visible.
  - No normalizar espacios, tabs ni saltos de línea del código de entrada en ningún punto de la directiva.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3.3 Aplicar la directiva en `codeguessr-game.html`
  - Reemplazar `<pre><code>{{ game.currentRound()!.Code }}</code></pre>` por `<pre><code [appHighlightCode]="game.currentRound()!.Code"></code></pre>`.
  - Importar `HighlightCode` en los `imports` standalone de `CodeguessrGame` (`codeguessr-game.ts`).
  - _Requirements: 3.1, 3.2_

- [ ] 3.4 Importar el tema visual `atom-one-dark`
  - Añadir `@import 'highlight.js/styles/atom-one-dark.css';` en `src/styles.scss`.
  - _Requirements: 3.1_

- [ ] 3.5 Verificar resaltado, escape de HTML y presupuesto de build
  - Cargar varias rondas en el navegador y confirmar coloreado coherente por lenguaje.
  - Verificar con un snippet que contenga `<`, `>` y `&` (por ejemplo un snippet HTML/JS) que no se ejecuta ningún script y que el layout no se rompe.
  - Ejecutar `ng build` de producción y confirmar que el presupuesto de `500kB` inicial de `angular.json` sigue respetándose.
  - _Requirements: 3.1, 3.3, 3.4_

### 4. Tipografía monoespaciada self-hosted (JetBrains Mono)

- [ ] 4.1 Obtener y colocar los archivos woff2 de JetBrains Mono
  - Descargar (o generar el subconjunto) de los archivos `JetBrainsMono-Regular.woff2` (peso 400) y `JetBrainsMono-Bold.woff2` (peso 700) desde la fuente oficial (licencia SIL Open Font).
  - Colocarlos en `public/fonts/jetbrains-mono/`.
  - _Requirements: 4.1_

- [ ] 4.2 Declarar las reglas `@font-face` en `src/styles.scss`
  - Añadir los dos bloques `@font-face` (`font-weight: 400` y `font-weight: 700`) apuntando a `/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2` y `/fonts/jetbrains-mono/JetBrainsMono-Bold.woff2` respectivamente, con `font-display: swap`, antes del bloque `@theme`.
  - _Requirements: 4.1_

- [ ] 4.3 Aplicar `var(--font-mono)` al contenedor del snippet
  - Confirmar que `pre` dentro de `.snippet-card` en `codeguessr-game.scss` use `font-family: var(--font-mono);` (ya cubierto por la tarea 2.3; verificar que el token resuelva ahora a `JetBrains Mono` real en vez del fallback del sistema).
  - _Requirements: 4.2, 4.3_

- [ ] 4.4 Verificar carga de fuente en DevTools
  - En la pestaña Network/Fonts de DevTools, confirmar que el `.woff2` se sirve desde el propio origen (no un CDN de terceros) y que el snippet renderiza con `JetBrains Mono` una vez cargada la fuente.
  - _Requirements: 4.1, 4.2, 4.3_

### 5. Layout y encabezado compartido

- [ ] 5.1 Crear el componente standalone `AppHeader`
  - Crear `src/app/shared/components/app-header/app-header.ts`, `app-header.html` y `app-header.scss`.
  - En `app-header.ts`: inyectar `Router`, `GameService` y `AuthService`; exponer `currentUser`, `totalScore`, `roundIndex` como propiedades protegidas de solo lectura; definir el signal computado `showRoundAndScore` (verdadero solo si `sessionStatus() === 'playing'` y `currentRound() !== null`); implementar `onLogoActivate()` con la lógica de navegación descrita en el design.md (autenticado o sesión activa → `/play`, si no → `/login`).
  - En `app-header.html`: renderizar el logo "TechGuessr" como elemento clickeable con `role="link"`, `tabindex="0"` y manejadores `(click)`, `(keydown.enter)`, `(keydown.space)` sobre `onLogoActivate()`; mostrar `<div class="score-info">` con ronda y puntaje solo cuando `showRoundAndScore()` sea verdadero, usando un único bloque `@if` para que ambos indicadores aparezcan/desaparezcan siempre juntos.
  - En `app-header.scss`: estilos base del encabezado usando los tokens de color/espaciado del Sistema_Tokens (no valores hardcodeados nuevos).
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 7.2, 7.3_

- [ ] 5.2 Integrar `AppHeader` en el shell de la aplicación
  - En `src/app/app.html`, añadir `<app-header />` antes de `<router-outlet></router-outlet>`.
  - En `src/app/app.ts`, importar `AppHeader` y añadirlo al array `imports` del componente raíz.
  - _Requirements: 5.1, 5.2_

- [ ] 5.3 Remover el encabezado duplicado de login y register
  - Eliminar el `<h1>TechGuessr...</h1>` (y cualquier subtítulo de marca redundante) de `login.html` y `register.html`, sin modificar la lógica de `login.ts`/`register.ts`.
  - _Requirements: 5.1_

- [ ] 5.4 Remover el encabezado duplicado de codeguessr-game
  - Eliminar el `<h1>` de marca y el `<div class="score-info">` de `codeguessr-game.html` (ese indicador pasa a vivir exclusivamente en `AppHeader`), sin modificar la lógica de `codeguessr-game.ts`.
  - _Requirements: 5.1_

- [ ] 5.5 Verificar navegación y visibilidad del encabezado en las 5 pantallas
  - Navegar por login, register, codeguessr-game, session-summary y leaderboard confirmando que el encabezado es el mismo componente en todas.
  - Confirmar que ronda y puntaje aparecen y desaparecen siempre juntos, nunca por separado.
  - Confirmar que el logo funciona tanto con clic como con teclado (Enter/Espacio) y navega correctamente según el estado de autenticación/sesión.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

### 6. Microinteracciones y transiciones de feedback visual

- [ ] 6.1 Crear el helper `animateCount()`
  - Crear `src/app/shared/animate-count.ts` exportando la función `animateCount(target: number, durationMs: number): Signal<number>` basada en `requestAnimationFrame`, según la implementación del design.md (con manejo de `durationMs <= 0` para mostrar el valor final de forma instantánea).
  - _Requirements: 6.2_

- [ ] 6.2 Añadir la media query global `prefers-reduced-motion` en `src/styles.scss`
  - Añadir el bloque `@media (prefers-reduced-motion: reduce)` con las reglas de `animation-duration`, `animation-iteration-count`, `transition-duration` y `scroll-behavior` descritas en el design.md.
  - _Requirements: 6.6_

- [ ] 6.3 Aplicar transición de reveal ✅/❌ en `codeguessr-game`
  - En `codeguessr-game.ts`, agregar la lógica de presentación necesaria para exponer el estado de acierto/fallo por tramo (Language/Framework/Project) desde `Correctness`, sin modificar `GameService` ni `game.types.ts`.
  - En `codeguessr-game.html`, aplicar `[class.correct]`/`[class.incorrect]` a cada `<li>` de `.correctness-list`.
  - En `codeguessr-game.scss`, añadir `transition: background-color 400ms, transform 400ms;` y los colores de fondo desde `var(--color-success)`/`var(--color-error)` para las clases `.correct`/`.incorrect`.
  - _Requirements: 6.1_

- [ ] 6.4 Integrar `animateCount()` para el conteo de puntaje de ronda
  - En `codeguessr-game.ts`, invocar `animateCount()` al recibir `lastResult()`, con una duración entre 300-1000ms (recomendado 600ms), detectando `prefers-reduced-motion` vía `window.matchMedia('(prefers-reduced-motion: reduce)').matches` para pasar `durationMs = 0` en ese caso.
  - En `codeguessr-game.html`, mostrar el signal retornado por `animateCount()` en lugar del valor final estático de `roundScore`.
  - _Requirements: 6.2, 6.6_

- [ ] 6.5 Añadir transición de entrada/salida del snippet en `codeguessr-game`
  - En `codeguessr-game.ts`, mantener/alternar un signal booleano que cambie en cada `loadNextRound()` para disparar la transición.
  - En `codeguessr-game.scss`, definir `@keyframes fade-slide-in` (opacity + transform) aplicado a `.snippet-card` vía `[class.entering]`, con duración ≤400ms.
  - _Requirements: 6.3_

- [ ] 6.6 Añadir aparición escalonada en `session-summary`
  - En `session-summary.html`, calcular `style.animation-delay` por índice (`index * 100ms`) dentro del `@for` de la lista de rondas.
  - En `session-summary.scss`, definir `@keyframes fade-in-up` con un desfase entre 50-150ms por elemento y duración total ≤1500ms.
  - _Requirements: 6.4_

- [ ] 6.7 Añadir resaltado de fila propia en `leaderboard`
  - En `leaderboard.ts`, exponer la comparación entre `entry.Username` y `auth.currentUser()?.username` (o el equivalente ya expuesto) sin modificar `GameService`/`AuthService`.
  - En `leaderboard.html`, aplicar `[class.own-row]` a cada `<tr>` correspondiente.
  - En `leaderboard.scss`, definir `.own-row` con `var(--color-accent)` en baja opacidad como fondo, sin animación.
  - _Requirements: 6.5_

- [ ] 6.8 Verificar microinteracciones con `prefers-reduced-motion` activado
  - Activar `prefers-reduced-motion` (mediante configuración del sistema operativo o emulación de DevTools) y confirmar que las transiciones de las tareas 6.3, 6.5, 6.6 y 6.7 caen a ≤50ms, y que el conteo de puntaje (tarea 6.4) se muestra de forma instantánea, sin perder ninguna información funcional.
  - _Requirements: 6.6_

### 7. Verificación final de preservación de funcionalidad

- [ ] 7.1 Ejecutar build de producción completo
  - Correr `ng build` (configuración de producción) y confirmar código de salida `0`, cero errores de compilación y presupuesto de `500kB` inicial respetado.
  - _Requirements: 1.2, 7.1, 7.2_

- [ ] 7.2 Ejecutar la suite Vitest completa y comparar contra el baseline
  - Correr `npm test` y confirmar que el número de pruebas exitosas coincide con el baseline de la tarea 1.1, incluyendo `game.service.spec.ts`.
  - Si alguna prueba falla como consecuencia directa de un cambio de presentación intencional de este spec (no de una regresión de lógica de negocio), actualizar únicamente esa aserción y documentar el motivo del cambio en el mensaje de commit o en el propio test.
  - _Requirements: 1.5, 7.4_

- [ ] 7.3 Checklist de verificación visual manual de las 5 pantallas
  - Login/Register: confirmar tokens de color/espaciado aplicados y ausencia de encabezado propio.
  - CodeGuessr (juego): confirmar resaltado de sintaxis, tipografía JetBrains Mono, transición de reveal ✅/❌, conteo animado de puntaje y transición de entrada/salida de snippet.
  - Resumen de sesión: confirmar aparición escalonada de la lista de rondas.
  - Leaderboard: confirmar resaltado de la fila propia.
  - Encabezado compartido: confirmar presencia consistente del logo y comportamiento de ronda/puntaje en las 5 pantallas.
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7.4 Confirmar preservación de contratos de API y lógica de dominio
  - Revisar que `AuthService`, `GameService`, `game.types.ts` y `app.routes.ts` no tengan cambios de lógica pública ni de contrato (solo, si aplica, lectura de signals existentes desde `AppHeader` u otros componentes de presentación).
  - _Requirements: 7.1, 7.2, 7.5_

## Task Dependency Graph

```mermaid
graph TD
    T1_1[1.1 Baseline limpio + Vitest] --> T1_2[1.2 ng add tailwind]
    T1_2 --> T1_3[1.3 Pinear version tailwindcss]
    T1_3 --> T1_4[1.4 Build produccion + utility]
    T1_4 --> T1_5[1.5 Vitest vs baseline]

    T1_5 --> T2_1[2.1 Bloque @theme]
    T2_1 --> T2_2[2.2 Migrar login/register]
    T2_1 --> T2_3[2.3 Migrar codeguessr-game]
    T2_1 --> T2_4[2.4 Migrar session-summary]
    T2_1 --> T2_5[2.5 Migrar leaderboard]
    T2_2 --> T2_6[2.6 Verificar tokens + Vitest]
    T2_3 --> T2_6
    T2_4 --> T2_6
    T2_5 --> T2_6

    T1_5 --> T3_1[3.1 Instalar highlight.js]
    T3_1 --> T3_2[3.2 Directiva HighlightCode]
    T3_2 --> T3_3[3.3 Aplicar en codeguessr-game.html]
    T2_3 --> T3_4[3.4 Importar tema atom-one-dark]
    T3_3 --> T3_5[3.5 Verificar resaltado + budget]
    T3_4 --> T3_5

    T2_1 --> T4_1[4.1 Colocar woff2 JetBrains Mono]
    T4_1 --> T4_2[4.2 Declarar @font-face]
    T2_3 --> T4_3[4.3 Aplicar var(--font-mono)]
    T4_2 --> T4_3
    T4_3 --> T4_4[4.4 Verificar carga de fuente]

    T2_6 --> T5_1[5.1 Crear AppHeader]
    T5_1 --> T5_2[5.2 Integrar en app.html/app.ts]
    T5_2 --> T5_3[5.3 Remover header login/register]
    T5_2 --> T5_4[5.4 Remover header codeguessr-game]
    T5_3 --> T5_5[5.5 Verificar navegacion + visibilidad]
    T5_4 --> T5_5

    T2_6 --> T6_1[6.1 Helper animateCount]
    T2_6 --> T6_2[6.2 Media query reduced-motion]
    T5_5 --> T6_3[6.3 Transicion reveal correcto/incorrecto]
    T6_1 --> T6_4[6.4 Integrar animateCount en ronda]
    T5_5 --> T6_5[6.5 Transicion entrada/salida snippet]
    T5_5 --> T6_6[6.6 Aparicion escalonada resumen]
    T5_5 --> T6_7[6.7 Resaltado fila propia leaderboard]
    T6_2 --> T6_8[6.8 Verificar reduced-motion]
    T6_3 --> T6_8
    T6_4 --> T6_8
    T6_5 --> T6_8
    T6_6 --> T6_8
    T6_7 --> T6_8

    T3_5 --> T7_1[7.1 Build produccion final]
    T4_4 --> T7_1
    T6_8 --> T7_1
    T7_1 --> T7_2[7.2 Vitest final vs baseline]
    T7_2 --> T7_3[7.3 Checklist visual 5 pantallas]
    T7_3 --> T7_4[7.4 Confirmar preservacion contratos/logica]
```

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1"] },
    { "wave": 2, "tasks": ["1.2"] },
    { "wave": 3, "tasks": ["1.3"] },
    { "wave": 4, "tasks": ["1.4"] },
    { "wave": 5, "tasks": ["1.5"] },
    { "wave": 6, "tasks": ["2.1", "3.1"] },
    { "wave": 7, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "4.1"] },
    { "wave": 8, "tasks": ["2.6", "3.3", "3.4", "4.2"] },
    { "wave": 9, "tasks": ["3.5", "4.3", "5.1"] },
    { "wave": 10, "tasks": ["4.4", "5.2"] },
    { "wave": 11, "tasks": ["5.3", "5.4"] },
    { "wave": 12, "tasks": ["5.5"] },
    { "wave": 13, "tasks": ["6.1", "6.2", "6.3", "6.5", "6.6", "6.7"] },
    { "wave": 14, "tasks": ["6.4"] },
    { "wave": 15, "tasks": ["6.8"] },
    { "wave": 16, "tasks": ["7.1"] },
    { "wave": 17, "tasks": ["7.2"] },
    { "wave": 18, "tasks": ["7.3"] },
    { "wave": 19, "tasks": ["7.4"] }
  ]
}
```

## Notes

- Orden de dependencia estricto entre las 7 áreas: Tailwind (1) debe quedar instalado y verificado antes de declarar tokens (2), porque el bloque `@theme` requiere `@import "tailwindcss";` ya presente en `src/styles.scss`. Las áreas 3 (highlight.js) y 4 (tipografía) dependen de que los tokens de color/fuente existan, pero son independientes entre sí y pueden ejecutarse en paralelo. El layout compartido (5) depende de que los tokens estén migrados (usa clases/variables de tema en su propio SCSS). Las microinteracciones (6) dependen de los tokens de color (éxito/error/acento) y de que el layout compartido ya esté integrado, porque varias transiciones se verifican navegando por las pantallas con el encabezado ya en su lugar.
- No se incluyen tareas de infraestructura AWS, CI/CD, ni testing automatizado nuevo de UI (sin `TestBed` para `AppHeader`, sin snapshot testing de `HighlightCode`, sin tests de animaciones CSS), en línea con la sección "Fuera de alcance" del design.md. La verificación de las áreas 3 a 6 es manual en el navegador, tal como describe la Testing Strategy del diseño.
- La suite Vitest existente (`game.service.spec.ts` y equivalentes) se usa como red de seguridad tras cada fase (tareas 1.1, 1.5, 2.6, 7.2): el número de pruebas exitosas no debe reducirse en ningún punto, salvo el ajuste de aserciones explícitamente permitido por Requirement 7.4 cuando la falla es consecuencia directa de un cambio de presentación intencional.
- Todas las tareas de este plan son obligatorias; el design.md no marca ninguna de las siete áreas como opcional.
