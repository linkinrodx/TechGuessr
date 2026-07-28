# Design Document

## Overview

Este documento describe el diseño técnico de la revisión de UI/UX de TechGuessr. El alcance es exclusivamente de capa de presentación: adopción de Tailwind CSS v4, un sistema de design tokens, resaltado de sintaxis real con `highlight.js`, tipografía monoespaciada self-hosted, un layout/encabezado compartido entre pantallas, y microinteracciones de feedback visual. Ninguno de estos cambios toca `GameService`, `AuthService`, `game.types.ts` ni `app.routes.ts` en su lógica pública (Requirement 7).

El proyecto ya usa Angular v22 con `@angular/build:application` (basado en Vite) para `ng build`/`ng serve`, componentes standalone, signals para estado, y SCSS por componente. El diseño respeta esa base sin introducir NgModules, sin migrar a RxJS donde no haga falta, y sin agregar dependencias fuera de las tres explícitamente requeridas por los requirements (`tailwindcss`, `highlight.js`, la fuente monoespaciada self-hosted).

Estado actual relevante (verificado en el código):

- `src/styles.scss` está vacío (solo un comentario). No hay tokens ni imports globales todavía.
- `src/app/app.html` solo contiene `<router-outlet></router-outlet>`, sin encabezado.
- Cada pantalla (`login.html`, `register.html`, `codeguessr-game.html`, `session-summary.html`, `leaderboard.html`) repite su propio título "TechGuessr" y sus propios colores hardcodeados en el `.scss` correspondiente.
- El snippet de la ronda se renderiza como texto plano dentro de `<pre><code>{{ game.currentRound()!.Code }}</code></pre>` en `codeguessr-game.html`, sin resaltado ni fuente monoespaciada real (la declaración `font-family: 'Fira Code', monospace;` en `codeguessr-game.scss` nunca se acompañó de un `@font-face` ni de un import, por lo que cae siempre al fallback `monospace` del sistema).
- No existen animaciones ni transiciones en ningún componente.

## Architecture

La revisión se organiza en cuatro capas que se construyen una sobre otra, en el mismo orden en que deben implementarse (cada capa depende de la anterior):

```
┌─────────────────────────────────────────────────────────────┐
│ 4. Microinteracciones (CSS puro + signals)                   │
│    - Depende de: tokens (colores de éxito/error) y layout    │
├─────────────────────────────────────────────────────────────┤
│ 3. Layout compartido (AppHeader standalone)                  │
│    - Depende de: Tailwind (utilities) y tokens (colores)     │
├─────────────────────────────────────────────────────────────┤
│ 2. Resaltado de sintaxis + tipografía monoespaciada           │
│    - Depende de: Tailwind (base) para no romper el build     │
├─────────────────────────────────────────────────────────────┤
│ 1. Tailwind CSS v4 + Sistema de design tokens                │
│    - Base: styles.scss (@import + @theme)                    │
└─────────────────────────────────────────────────────────────┘
```

No hay cambios de arquitectura de la aplicación en sí (sigue siendo una SPA Angular con `GameService`/`AuthService` como única puerta de acceso a la API y a Cognito). El único componente nuevo con responsabilidad estructural es `AppHeader`, que se inserta en `app.html` envolviendo el `<router-outlet>` — es decir, pasa a formar parte del shell de la aplicación, no de cada feature.

```
app.html (root)
  <app-header />          ← nuevo, envuelve el outlet
  <router-outlet />        ← sin cambios en su configuración de rutas
    login | register | codeguessr-game | session-summary | leaderboard
```

### Versiones a pinear

| Dependencia | Versión exacta a fijar en `package.json` | Verificado |
|---|---|---|
| `tailwindcss` | `4.3.3` | Última versión estable de la serie 4.x publicada en el registro de npm al momento de este diseño (`registry.npmjs.org/tailwindcss/latest`). |
| `highlight.js` | `11.11.1` | Última versión estable publicada en el registro de npm (`registry.npmjs.org/highlight.js/latest`). Cumple Requirement 3.5 (sin `^`, `~`, `>=` ni rango abierto). |

Ambas se fijan sin prefijo `^` ni `~`, cumpliendo Requirement 1.4 y 3.5 respectivamente. Dado que `ng add tailwind` puede instalar la última versión disponible en el momento de ejecutarlo (que podría ser un patch más nuevo que `4.3.3` si el schematic corre después de este diseño), el paso de implementación debe verificar la versión resultante y reescribirla sin rango en `package.json` como paso explícito, no asumir que el schematic ya lo hace.

## Components and Interfaces

### 1. Tailwind CSS v4 (Requirement 1)

**Instalación.** Se ejecuta `ng add tailwind` (schematic oficial mantenido por el equipo de Angular/Tailwind para v22). Este comando, al ser el mecanismo soportado explícitamente por Requirement 1.1, es responsable de:

- Agregar `tailwindcss` (y sus dependencias internas, p. ej. `@tailwindcss/postcss` o el plugin de Vite correspondiente) a `devDependencies`.
- Insertar `@import "tailwindcss";` al inicio de `src/styles.scss`.
- Generar/ajustar la configuración de PostCSS necesaria para que `@angular/build:application` (Vite) procese Tailwind, sin requerir edición manual de `angular.json` ni `tsconfig.json` (Requirement 1.1).

**Configuración CSS-first (sin `tailwind.config.js` clásico).** Tailwind v4 elimina el archivo de configuración JS como paso obligatorio: el theming se declara directamente en CSS mediante el bloque `@theme` dentro de `src/styles.scss`, justo después del `@import "tailwindcss";`. Esto es intencional y no un paso omitido — ver sección de design tokens más abajo, que ocupa ese mismo bloque `@theme`. Si el schematic genera un `tailwind.config.js` vacío o mínimo, se conserva tal cual (no se edita manualmente más allá de lo que el propio schematic escriba), respetando la restricción de Requirement 1.1 de no tocar archivos de configuración fuera de los generados por el schematic.

**Convivencia de utilities con SCSS por componente.** No se introduce ningún mecanismo especial de aislamiento porque no hace falta: cada componente Angular ya tiene encapsulación de estilos por defecto (`ViewEncapsulation.Emulated`), que Angular implementa añadiendo un atributo único (`_ngcontent-*`) a los elementos del componente y reescribiendo los selectores del `.scss` de ese componente para incluir ese atributo. Esto sube la especificidad efectiva de cualquier selector definido en el SCSS de un componente (p. ej. `.game-header` en `codeguessr-game.scss`) por encima de una clase utilitaria global de Tailwind con la misma propiedad, porque las utilities de Tailwind son selectores de clase simple sin el atributo de encapsulación. En la práctica:

- Una clase utilitaria (`class="p-4"`) y una regla SCSS del propio componente (`.snippet-card { padding: 1rem; }`) sobre el mismo elemento **no compiten por especificidad de forma ambigua**: gana la regla SCSS del componente por tener mayor especificidad real una vez que Angular reescribe el selector.
- El único caso de conflicto real sería el uso de `!important` en una utility (Tailwind no lo hace por defecto, salvo el prefijo explícito `!` que el propio desarrollador decida usar) o en el SCSS del componente. El diseño no introduce `!important` en ningún punto nuevo.
- Esto satisface Requirement 1.3 sin necesidad de `@layer` manual ni de reordenar imports: es la cascada estándar de CSS combinada con el mecanismo de encapsulación que Angular ya aplica.

**Verificación de build y presupuesto.** Tras la adopción, `ng build` (configuración `production`, la default de este proyecto) debe completar con código de salida `0` y cero errores (Requirement 1.2). El presupuesto de `500kB` inicial en `angular.json` no debería verse afectado de forma significativa por Tailwind v4, porque su motor (Oxide) solo emite las utilities efectivamente usadas en las plantillas (`purge`/`content-scanning` automático, sin necesidad de configurar rutas de contenido manualmente como en v3). El presupuesto sí debe vigilarse en conjunto con `highlight.js` (ver punto 3).

**Rollback ante fallo de instalación (Requirement 1.6).** Antes de ejecutar `ng add tailwind`, el árbol de trabajo debe estar limpio (sin cambios sin commitear) para que, si el schematic falla a mitad de camino, `git checkout -- .` (o equivalente) restaure el estado previo sin dejar el repositorio en un estado no compilable. Esto es un paso de proceso, no de código: se documenta aquí porque Requirement 1.6 lo exige como parte del diseño de la adopción, no porque el propio schematic necesite lógica adicional.

### 2. Sistema de design tokens (Requirement 2)

Todos los tokens se declaran en un único bloque `@theme` en `src/styles.scss`, inmediatamente después de `@import "tailwindcss";`. Un bloque `@theme` en Tailwind v4 genera automáticamente tanto custom properties CSS (`var(--color-accent)`) como utilities correspondientes (`bg-accent`, `text-accent`, etc.), cubriendo a la vez Requirement 2.1 (definición centralizada) y 2.2 (exposición vía utility o variable).

```scss
@import "tailwindcss";

@theme {
  /* Colores semánticos */
  --color-background: #121212;
  --color-surface: #1e1e1e;
  --color-text-primary: #f5f5f5;
  --color-text-secondary: #888888;
  --color-accent: #4f46e5;
  --color-success: #22c55e;
  --color-error: #e53e3e;
  --color-border: #333333;
  --color-border-subtle: #444444;

  /* Tipografía */
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Code',
    'Roboto Mono', Consolas, 'Liberation Mono', monospace;

  /* Espaciado */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

Nota sobre `--color-success`: los requirements no piden reemplazar ningún hardcode existente por él (no hay un verde hardcodeado en el código actual), pero Requirement 2.1 exige definir el rol "éxito" en el propio sistema de tokens independientemente de si ya hay un uso existente que migrar; se reserva para el estado "✅" de las microinteracciones (Requirement 6.1).

**Tabla de mapeo de colores hardcodeados → tokens** (Requirement 2.3, coincidencia exacta de valor hexadecimal):

| Valor hardcodeado actual | Dónde aparece | Token nuevo |
|---|---|---|
| `#4f46e5` | Botones de acción en `login.scss`, `register.scss`, `codeguessr-game.scss`, `session-summary.scss`; `h2` de resultado y `.back-link` en `leaderboard.scss` | `--color-accent` |
| `#1e1e1e` | Fondo de `.snippet-card` en `codeguessr-game.scss` | `--color-surface` |
| `#888` | `.subtitle` (login/register), `.score-info`, `.difficulty`, `.explanation`, `.loading` (codeguessr-game), `.rank`, `.loading` (session-summary), `.loading`/`.empty` (leaderboard) | `--color-text-secondary` |
| `#e53e3e` | `.error` en los cinco componentes (login, register, codeguessr-game, session-summary, leaderboard) | `--color-error` |
| `#333` | Borde de `.auth-page` (login/register); borde inferior de `.rounds-table th/td` (session-summary) y `.leaderboard-table th/td` (leaderboard) | `--color-border` |
| `#444` | Borde de `input` en login/register/codeguessr-game | `--color-border-subtle` |

Nota: `#666` (`.hint` en `register.scss`) no coincide exactamente con ningún token definido, por lo que Requirement 2.3 no obliga a migrarlo; queda como decisión de implementación (se recomienda unificarlo a `--color-text-secondary` por consistencia visual, aunque no sea obligatorio).

**Plan de migración componente por componente**, en el orden recomendado (de menor a mayor superficie de cambio):

1. **`login.scss` / `register.scss`** (casi idénticos): reemplazar `#4f46e5`, `#888`, `#e53e3e`, `#333`, `#444` por `var(--color-accent)`, `var(--color-text-secondary)`, `var(--color-error)`, `var(--color-border)`, `var(--color-border-subtle)` respectivamente. Los `margin`/`padding` en `rem` (`1rem`, `0.5rem`, `0.25rem`, `1.5rem`, `2rem`, `4rem`) se evalúan contra los tokens de espaciado: `0.25rem→--spacing-xs`, `0.5rem→--spacing-sm`, `1rem→--spacing-md`, `1.5rem→--spacing-lg`, `2rem→--spacing-xl` cumplen coincidencia exacta (Requirement 2.6) y se migran; `4rem` no tiene token exacto y se deja como está.
2. **`codeguessr-game.scss`**: mismo reemplazo de colores; además el fondo `#1e1e1e` de `.snippet-card` pasa a `var(--color-surface)`. La declaración `font-family: 'Fira Code', monospace;` dentro de `pre` se reemplaza por `var(--font-mono)` (con la fuente ya migrada a JetBrains Mono, ver Requirement 4).
3. **`session-summary.scss`**: `#4f46e5` → accent, `#888` → text-secondary, `#333` → border, `#e53e3e` → error.
4. **`leaderboard.scss`**: mismo patrón que session-summary.

En todos los casos la migración es una sustitución 1:1 de valor literal por `var(--token)`; no se cambian selectores, estructura HTML ni breakpoints. Esto mantiene el riesgo de regresión visual bajo y no afecta la lógica de los componentes (Requirement 7.2).

### 3. Resaltado de sintaxis con highlight.js (Requirement 3)

**Enfoque: directiva standalone, no pipe.** Se crea `src/app/shared/directives/highlight-code.ts` exportando una directiva standalone `HighlightCode` con selector `[appHighlightCode]`, aplicada al `<code>` dentro del `<pre>` de `codeguessr-game.html`:

```html
<pre><code [appHighlightCode]="game.currentRound()!.Code"></code></pre>
```

Se elige una directiva sobre un pipe porque la directiva tiene acceso directo a `ElementRef` para escribir `innerHTML` de forma imperativa y puede reaccionar a cambios del signal de entrada (`input()`) sin depender de que Angular vuelva a evaluar una expresión de plantilla — el pipe forzaría a re-ejecutar `highlightAuto` en cada ciclo de detección de cambios salvo que se implemente memoización manual, lo que termina siendo más código que la directiva.

```typescript
import { Directive, ElementRef, inject, input, effect } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import hljs from 'highlight.js/lib/core';
// + registerLanguage por cada lenguaje del subset (ver abajo)

@Directive({
  selector: '[appHighlightCode]',
  standalone: true,
})
export class HighlightCode {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly sanitizer = inject(DomSanitizer);

  readonly appHighlightCode = input<string>('');

  constructor() {
    effect(() => {
      const code = this.appHighlightCode();
      const el = this.elementRef.nativeElement;
      try {
        const result = hljs.highlightAuto(code);
        const safeHtml = this.sanitizer.bypassSecurityTrustHtml(result.value);
        el.innerHTML = safeHtml as unknown as string;
      } catch {
        // Requirement 3.3: fallback a texto plano sin resaltado, sin error visible.
        el.textContent = code;
      }
    });
  }
}
```

**Por qué `bypassSecurityTrustHtml` es seguro aquí (Requirement 3.4).** `hljs.highlightAuto(code).value` nunca devuelve el código fuente sin procesar: internamente, `highlight.js` primero escapa los caracteres `<`, `>` y `&` del texto de entrada (usando su propia función de escape HTML) y solo después envuelve fragmentos del texto ya escapado en `<span class="hljs-...">`. Esto significa que si el snippet contiene literalmente `<script>alert(1)</script>` como parte del código fuente (por ejemplo, un snippet de HTML o JS que manipula el DOM), ese texto llega al HTML final como `&lt;script&gt;...&lt;/script&gt;` dentro de spans de clase, nunca como una etiqueta `<script>` real interpretable por el navegador. Los únicos elementos HTML "activos" que produce `highlightAuto` son los `<span>` que él mismo genera con clases fijas (`hljs-keyword`, `hljs-string`, etc.), sin atributos de evento ni URLs. Por eso confiar ese HTML vía `bypassSecurityTrustHtml` no reintroduce el riesgo de XSS que `DomSanitizer` normalmente bloquea: el sanitizador de Angular no confía en el HTML de `highlight.js` porque no puede saber que ya fue escapado por otra librería, pero la garantía real viene de la propia implementación de `highlight.js`, no de Angular.

**Subset de lenguajes (para no inflar el budget de 500kB).** Se usa `highlight.js/lib/core` (el núcleo sin lenguajes) más registro manual de un subset:

```typescript
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import csharp from 'highlight.js/lib/languages/csharp';
import java from 'highlight.js/lib/languages/java';
import xml from 'highlight.js/lib/languages/xml'; // cubre HTML
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
```

Este registro debe hacerse una sola vez (por ejemplo en el propio archivo de la directiva, ejecutado a nivel de módulo, o en `app.config.ts` como parte de la inicialización) para no repetir el registro en cada instancia de la directiva. `highlightAuto` sin argumento de lenguajes solo detecta entre los lenguajes registrados, lo que además acota el universo de falsos positivos de auto-detección.

**Tema visual.** Se importa `atom-one-dark` en `src/styles.scss`:

```scss
@import 'highlight.js/styles/atom-one-dark.css';
```

Este tema encaja con el fondo oscuro ya usado en `.snippet-card` (`--color-surface`, antes `#1e1e1e`).

**Preservación íntegra del contenido (Requirement 3.1).** La directiva no normaliza espacios, tabs ni saltos de línea: pasa el string `Code` tal cual llega desde `RoundResponse.Code` a `hljs.highlightAuto`, que solo envuelve fragmentos en spans sin tocar el texto entre ellos. El `<pre>` que envuelve al `<code>` en `codeguessr-game.html` ya preserva espacios en blanco por comportamiento estándar de CSS (`white-space: pre`), así que no se requiere ningún ajuste adicional ahí.

### 4. Tipografía monoespaciada (Requirement 4)

Self-hosting de JetBrains Mono (elegida sobre Fira Code por ser la que ya se referenciaba, aunque nunca se importó, en `codeguessr-game.scss`; cualquiera de las dos cumple el requirement, se mantiene la que ya estaba en la intención del código existente... en este caso se estandariza a JetBrains Mono por tener una licencia SIL Open Font permisiva y subconjuntos woff2 livianos oficiales).

- Archivos `.woff2` (regular 400 y bold 700, suficiente para el uso actual del snippet) ubicados en `public/fonts/jetbrains-mono/`. Al estar en `public/`, Angular los sirve tal cual bajo `/fonts/jetbrains-mono/...` sin pasar por el pipeline de bundling — no cuentan contra el presupuesto de JS/CSS de `angular.json`.
- Declaración `@font-face` en `src/styles.scss`, antes o después del bloque `@theme` (el orden no importa para `@font-face`, pero se recomienda antes para que el token `--font-mono` referencie una fuente ya declarada):

```scss
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/jetbrains-mono/JetBrainsMono-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

- El token `--font-mono` (ya mostrado en la sección de tokens) incluye el fallback stack completo (`ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Consolas, 'Liberation Mono', monospace`), y se aplica al contenedor del snippet (`pre` en `.snippet-card`) vía `font-family: var(--font-mono);`.

**Sobre el criterio de 3000ms (Requirement 4.3).** Al ser self-hosted (sin request a Google Fonts ni ningún CDN de terceros en runtime), el archivo `.woff2` se descarga desde el mismo origen (CloudFront) que el resto del bundle, eliminando la variable de latencia de un tercero. `font-display: swap` ya provee el mecanismo de fallback automático del navegador: si la fuente no cargó, el texto se muestra con el fallback monoespaciado inmediatamente y cambia a JetBrains Mono en cuanto esté disponible, sin bloquear el render ni requerir lógica JS de temporización manual. Dado que los archivos son livianos (un woff2 subconjuted de JetBrains Mono ronda pocas decenas de KB) y se sirven desde el mismo CDN que ya cumple el resto del budget de carga de la app, se considera que la carga completa cae holgadamente dentro de los 3000ms sin necesitar instrumentación adicional (p. ej. `document.fonts.ready` con temporizador) para este alcance de hackathon.

### 5. Layout compartido (Requirement 5)

Nuevo componente standalone: `src/app/shared/components/app-header/app-header.ts` (+ `.html`, `.scss`), siguiendo la convención "2025" ya usada en el resto del proyecto (sin sufijo `.component.`).

```typescript
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '../../../core/game.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeader {
  private readonly router = inject(Router);
  private readonly game = inject(GameService);
  private readonly auth = inject(AuthService);

  protected readonly currentUser = this.auth.currentUser;
  protected readonly totalScore = this.game.totalScore;
  protected readonly roundIndex = this.game.roundIndex;

  /**
   * Requirement 5.3/5.4: ronda y puntaje se muestran como una sola unidad.
   * Visibles solo si hay sesión 'playing' Y una ronda actual cargada;
   * en cualquier otro caso ambos se ocultan, sin estado intermedio.
   */
  protected readonly showRoundAndScore = computed(
    () => this.game.sessionStatus() === 'playing' && this.game.currentRound() !== null,
  );

  protected async onLogoActivate(): Promise<void> {
    const hasUser = this.currentUser() !== null;
    const hasActiveSession = this.game.sessionStatus() === 'playing';

    if (hasUser || hasActiveSession) {
      await this.router.navigateByUrl('/play');
    } else {
      await this.router.navigateByUrl('/login');
    }
  }
}
```

```html
<!-- app-header.html -->
<header class="app-header">
  <a
    class="logo"
    tabindex="0"
    role="link"
    (click)="onLogoActivate()"
    (keydown.enter)="onLogoActivate()"
    (keydown.space)="onLogoActivate()"
  >
    TechGuessr
  </a>

  @if (showRoundAndScore()) {
    <div class="score-info">
      <span>Ronda {{ roundIndex() }}/10</span>
      <span>Puntaje: {{ totalScore() }}</span>
    </div>
  }
</header>
```

Nota: se usa `<a>` con `role="link"` y manejadores de teclado en vez de `<button>` para conservar la semántica visual de "logo clickeable", pero cualquiera de las dos etiquetas satisface Requirement 5.5 (clic + Enter/Espacio); se documenta la elección para que la implementación no dude entre ambas.

**Integración en el shell (`app.html`):**

```html
<app-header />
<router-outlet></router-outlet>
```

Y en `app.ts`, agregar `AppHeader` a `imports: [RouterOutlet, AppHeader]`.

**Eliminación de encabezados duplicados.** Como parte de este mismo requirement, cada pantalla deja de renderizar su propio `<h1>TechGuessr...</h1>` (login.html, register.html, codeguessr-game.html) — Requirement 5.1 exige que deleguen la renderización del encabezado al Layout_Compartido. Esto es un cambio de plantilla puramente visual: no toca los signals ni la lógica de los componentes de feature, solo remueve el `<h1>` (y en el caso de `codeguessr-game.html`, el `<div class="score-info">` que pasa a vivir en `AppHeader`).

**Por qué inyectar `GameService`/`AuthService` en `AppHeader` no viola Requirement 7.2.** El requirement permite explícitamente "cambios de código TypeScript necesarios en componentes de presentación... sin modificar reglas de negocio ni contratos de API". `AppHeader` solo lee signals ya expuestos (`totalScore`, `roundIndex`, `sessionStatus`, `currentRound`, `currentUser`) y llama a `router.navigateByUrl`, sin invocar ningún método que mute estado de `GameService` (`startSession`, `submitAnswer`, etc.) ni de `AuthService` (`login`, `logout`). Es un consumidor de solo lectura de ambos servicios.

### 6. Microinteracciones (Requirement 6)

**Decisión: CSS puro, no `@angular/animations`.** Se descarta agregar `@angular/animations` como dependencia nueva. Angular v22 ya no lo incluye por defecto en el scaffold, y el catálogo de animaciones que pide Requirement 6 (transición de color/ícono, conteo numérico, entrada/salida entre rondas, aparición escalonada, resaltado de fila) es completamente cubrible con `transition`, `@keyframes` y clases condicionales controladas por signals, sin la sobrecarga de configurar el módulo de animaciones de Angular para un timebox de hackathon. Esto también evita agregar peso al bundle inicial.

**Conteo de puntaje animado (Requirement 6.2).** Un helper reutilizable basado en `requestAnimationFrame`:

```typescript
// src/app/shared/animate-count.ts
import { signal, Signal } from '@angular/core';

export function animateCount(target: number, durationMs: number): Signal<number> {
  const value = signal(0);
  if (durationMs <= 0) {
    value.set(target);
    return value.asReadonly();
  }

  const start = performance.now();
  function tick(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    value.set(Math.round(target * progress));
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);

  return value.asReadonly();
}
```

`CodeguessrGame` lo invoca al recibir `lastResult()`, con una duración dentro de 300-1000ms (p. ej. 600ms) salvo que `prefers-reduced-motion` esté activo, en cuyo caso se invoca con `durationMs = 0` (satisface la cláusula IF de Requirement 6.2, delegando la decisión de reducir la duración a la misma media query que gobierna el resto de las animaciones).

**Media query global de accesibilidad (Requirement 6.6).** En `src/styles.scss`:

```scss
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

El uso de `!important` aquí es intencional y no entra en conflicto con lo descrito en Requirement 1.3: esa regla habla de utilities de Tailwind vs. SCSS de componente, no de esta media query global de accesibilidad, cuyo propósito explícito es anular cualquier duración de animación sin importar su origen. Para la lógica JS que no puede resolverse solo con CSS (el conteo de puntaje), se detecta la preferencia una vez vía `window.matchMedia('(prefers-reduced-motion: reduce)').matches` y se usa para decidir el `durationMs` pasado a `animateCount`.

**Tabla de mapeo criterio → mecanismo técnico:**

| Criterio | Mecanismo técnico |
|---|---|
| 6.1 — Transición distinta para tramos ✅/❌ al revelar resultado, ≤500ms | Clase CSS condicional (`.correct` / `.incorrect`) en cada `<li>` de `.correctness-list`, aplicada vía `[class.correct]`/`[class.incorrect]` ligada a `Correctness.Language`/`Framework`/`Project`; `transition: background-color 400ms, transform 400ms` + color de fondo desde `--color-success`/`--color-error`. |
| 6.2 — Conteo animado de `roundScore`, 300-1000ms | Helper `animateCount()` basado en `requestAnimationFrame` (ver arriba), invocado desde `CodeguessrGame` al setear `lastResult`. |
| 6.3 — Transición de entrada/salida entre snippets, ≤400ms | Clase CSS aplicada al contenedor `.snippet-card` con `@keyframes fade-slide-in` (opacity + transform), disparada por un signal booleano que se alterna en cada `loadNextRound()` (p. ej. vía `[class.entering]`). |
| 6.4 — Aparición escalonada en resumen de sesión, 50-150ms de desfase, ≤1500ms total | `style.animation-delay` calculado por índice (`index * 100ms` como valor por defecto dentro del rango) en el `@for` de la lista de rondas de `session-summary.html`, combinado con `@keyframes fade-in-up`. |
| 6.5 — Resaltado de la fila propia en el leaderboard | Clase CSS condicional (`[class.own-row]`) en cada `<tr>` de `leaderboard.html`, comparando `entry.Username` contra `auth.currentUser()?.username`; usa `--color-accent` con opacidad baja como fondo, sin animación (es un estado persistente, no una transición puntual). |
| 6.6 — `prefers-reduced-motion` neutraliza 6.1-6.5 a ≤50ms | Media query global en `styles.scss` (arriba) para las transiciones CSS de 6.1/6.3/6.4/6.5; rama `durationMs = 0` en `animateCount()` para 6.2, decidida por `matchMedia` en el componente. |

## Data Models

Este spec no introduce ni modifica modelos de datos de dominio: `game.types.ts` permanece sin cambios (Requirement 7.1/7.2). Los únicos "modelos" nuevos son de estado puramente de presentación, ya cubiertos en las secciones anteriores:

- El signal derivado `showRoundAndScore` en `AppHeader` (booleano computado, no persistido).
- El signal retornado por `animateCount()` (número, efímero, vive solo mientras dura la animación de conteo).

Ninguno de los dos se envía a la API, se persiste, ni altera la forma de `RoundResponse`, `AnswerResultResponse`, `SessionSummaryResponse` ni `LeaderboardEntryResponse`.

## Error Handling

- **Fallo de auto-detección de `highlight.js` (Requirement 3.3):** ya cubierto en el diseño de `HighlightCode` — el `try/catch` alrededor de `highlightAuto` cae a `el.textContent = code`, preservando el contenido íntegro sin resaltado y sin lanzar un error visible al jugador. Esto también cubre el caso en que `highlightAuto` "tenga éxito" pero con una detección de baja confianza: `highlight.js` no lanza excepción en ese caso, simplemente devuelve el mejor resultado que encontró, lo cual sigue siendo un resaltado válido (no es un caso de error a manejar aparte).
- **Carga tardía o fallida de la fuente monoespaciada (Requirement 4.3):** cubierto por `font-display: swap`, que es un mecanismo del navegador, no lógica de la aplicación que pueda "fallar" de forma observable por el usuario más allá de ver el fallback stack.
- **Fallo de `ng add tailwind` (Requirement 1.6):** cubierto en la sección de Tailwind — mitigado por partir de un árbol de trabajo limpio antes de ejecutar el schematic, permitiendo revertir con `git checkout`.
- **Errores de negocio existentes (`GameError` en `GameService`):** no se tocan. `AppHeader` no introduce ningún manejo de error nuevo porque no realiza ninguna llamada que pueda fallar (solo lee signals ya existentes); si `GameService.lastError()` está seteado, sigue siendo responsabilidad exclusiva de cada pantalla de feature mostrarlo, igual que hoy.

## Testing Strategy

Dado el timebox del hackathon (Requirement 7.4) y que este spec es exclusivamente de presentación, la estrategia se apoya en dos pilares:

1. **Suite Vitest existente, sin tocar aserciones de negocio.** `game.service.spec.ts` (y cualquier otro spec existente) debe seguir pasando exactamente con el mismo número de pruebas exitosas después de cada una de las siete áreas de este diseño (Requirement 1.5, verificado tras Tailwind; Requirement 7.4, verificado al final de toda la revisión). Si `ng build`/`ng test` fallara por un cambio de presentación, la corrección es ajustar el código de presentación para no romper el test — no relajar ninguna aserción de `GameService`/`AuthService`, salvo el caso explícito de Requirement 7.4 (falla como consecuencia directa de un cambio de presentación intencional, documentado en el commit).
2. **Verificación visual manual para todo lo nuevo.** No se monta infraestructura de testing de componentes nueva (sin `TestBed` para `AppHeader`, sin snapshot testing de `HighlightCode`, sin tests de animaciones CSS). La verificación de cada uno de los 7 requirements se hace manualmente en el navegador durante la implementación:
   - Tailwind: confirmar visualmente que al menos una utility se renderiza en un componente existente, y que `ng build` termina en código de salida `0`.
   - Tokens: inspeccionar con DevTools que los colores/espaciados migrados resuelven al valor esperado vía `var(--token)`.
   - highlight.js: cargar varias rondas y confirmar coloreado coherente por lenguaje, incluyendo un snippet que contenga caracteres `<`/`>`/`&` para confirmar que no se rompe el layout ni se ejecuta nada.
   - Tipografía: confirmar en DevTools (pestaña Network/Fonts) que el `.woff2` se sirve desde el propio origen y que el snippet usa `JetBrains Mono` una vez cargada.
   - Layout compartido: navegar por las cinco pantallas confirmando que el encabezado es el mismo componente, que ronda+puntaje aparecen/desaparecen juntos nunca por separado, y que el logo funciona con clic y con teclado.
   - Microinteracciones: activar `prefers-reduced-motion` en el sistema operativo o mediante emulación de DevTools y confirmar que las animaciones caen a ≤50ms sin perder información.

   Esta verificación manual no sustituye una suite automatizada de UI a futuro, pero es proporcional al alcance de 3 días de una sola persona declarado en el steering del proyecto.

## Fuera de alcance

Este diseño explícitamente **no** incluye, en línea con el steering de producto (`product.md`) y de stack (`tech-stack.md`) del proyecto:

- Cualquier modalidad de juego distinta a CodeGuessr (StackGuessr, CommitGuessr, UIGuessr, TerminalGuessr, AIGuessr) ni modos de partida distintos al Clásico de 10 rondas.
- Soporte multiplayer, salas, o cualquier forma de sincronización en tiempo real.
- Un sistema de ELO real; el leaderboard sigue siendo una tabla simple ordenada por puntaje más alto, solo se le agrega resaltado visual de la fila propia (Requirement 6.5), no lógica de ranking nueva.
- Cambios a la infraestructura AWS (CDK, Lambda .NET, Cognito, DynamoDB, CloudFront) o a pipelines de CI/CD — este spec es puramente de frontend estático servido por la infraestructura ya existente.
- Tests automatizados nuevos para los componentes de UI introducidos (`AppHeader`, `HighlightCode`) o para las microinteracciones; la verificación de estos es manual, como se describe en Testing Strategy.
- Cualquier modificación a la lógica pública o interna de `GameService`, `AuthService`, a los tipos de `game.types.ts`, o a los contratos/rutas/payloads definidos en `app.routes.ts` y en la API (Requirement 7.1/7.2/7.5).
- Generación dinámica de contenido con Kiro en runtime, o cualquier dependencia de Kiro para que el juego funcione en producción.
