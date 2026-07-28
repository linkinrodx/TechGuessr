# Requirements Document

## Introduction

El MVP de CodeGuessr ya está funcional y desplegado, pero su interfaz es un scaffold básico de Angular sin sistema de diseño: colores repetidos y hardcodeados en cada componente, snippets de código sin resaltado de sintaxis real, tipografía monoespaciada referenciada pero nunca importada, cada pantalla (login, registro, juego, resumen de sesión, leaderboard) implementando su propio encabezado de forma aislada, y sin microinteracciones al revelar resultados de ronda.

Este spec cubre una revisión de UI/UX del frontend existente mediante la adopción de Tailwind CSS v4, un sistema de design tokens, integración de `highlight.js` para el resaltado de los snippets, importación correcta de tipografía monoespaciada, un layout/encabezado compartido entre pantallas, y microinteracciones de feedback visual en el flujo de juego. El alcance se limita estrictamente a la capa de presentación: no se modifica la lógica de negocio, los contratos de la API, ni se agregan modalidades o modos fuera del MVP (single-player, CodeGuessr, modo Clásico de 10 rondas), en línea con la ventana de tiempo restante del hackathon (~3 días, una sola persona).

Sobre el resaltado de sintaxis: se adopta la detección automática de lenguaje de `highlight.js` desde el inicio de la ronda (antes de que el jugador responda), aceptando el riesgo de que el coloreado pueda insinuar el lenguaje real, priorizando velocidad de implementación dentro del tiempo disponible.

## Requirements

### Requirement 1: Adopción de Tailwind CSS v4

**User Story:** Como desarrollador único del proyecto, quiero adoptar Tailwind CSS v4 mediante el schematic oficial de Angular, para estilar los componentes con clases utilitarias consistentes sin reescribir la lógica de negocio existente.

#### Acceptance Criteria

1. WHEN se instala Tailwind CSS v4 mediante `ng add tailwind`, THE Build_System SHALL generar únicamente los archivos de configuración necesarios (hoja de estilos global y configuración de Tailwind/PostCSS) para que las clases utilitarias de Tailwind funcionen en los componentes standalone existentes, de forma que al menos una clase utilitaria se renderice correctamente en un componente ya existente sin editar manualmente `angular.json`, `tsconfig.json` ni ningún archivo de configuración fuera de los generados por el schematic.
2. THE Build_System SHALL completar `ng build` en modo producción con código de salida exitoso y cero errores de compilación después de adoptar Tailwind CSS v4.
3. WHILE un componente combina clases utilitarias de Tailwind con reglas SCSS ya existentes en el mismo componente, THE Sistema_Estilos SHALL resolver los estilos en conflicto para una misma propiedad CSS siguiendo las reglas estándar de cascada y especificidad de CSS, de manera que ninguna clase base o de reset introducida por la adopción de Tailwind tenga prioridad por encima de un selector SCSS más específico ya existente en ese componente.
4. THE archivo `package.json` SHALL fijar la versión de la dependencia `tailwindcss` con un número de versión exacto, sin los prefijos de rango `^` o `~`.
5. THE suite de pruebas Vitest existente en el proyecto SHALL seguir ejecutándose con el mismo número de pruebas exitosas que antes de la adopción, tras completar la adopción de Tailwind CSS v4; cualquier prueba que falle tras la adopción SHALL bloquear la adopción como no exitosa, incluso si la causa parece ser un cambio de estilo menor sin impacto funcional aparente.
6. IF la instalación de Tailwind CSS v4 mediante `ng add tailwind` falla (por incompatibilidad de versión o error de ejecución del schematic), THEN THE Build_System SHALL detener el proceso sin dejar el repositorio en un estado que impida compilar con la configuración SCSS previa, y SHALL mostrar una indicación de error que permita al desarrollador identificar la causa y reintentar la instalación.

### Requirement 2: Sistema de design tokens

**User Story:** Como desarrollador, quiero centralizar los valores de color, tipografía y espaciado en un sistema de tokens de diseño, para eliminar los colores hardcodeados repetidos en cada componente y facilitar cambios de tema futuros.

#### Acceptance Criteria

1. THE Sistema_Tokens SHALL definir, en una única hoja de estilos o archivo de tokens de diseño, los roles semánticos de color: fondo base, superficie/tarjeta, texto primario, texto secundario, acento primario, éxito y error, cada uno asociado a un único valor de color.
2. WHEN un componente necesita el color de acento primario, éxito o error, THE Sistema_Tokens SHALL exponer ese valor mediante una clase utilitaria o variable de tema definida en el Sistema_Tokens, en lugar de un valor hexadecimal literal escrito directamente en el componente.
3. IF un componente existente (login, registro, juego, resumen de sesión, leaderboard) contiene un valor de color hardcodeado cuyo valor hexadecimal coincide exactamente con el valor definido para alguno de los roles semánticos del Sistema_Tokens, THEN ese componente SHALL reemplazar el valor hardcodeado por la referencia a la clase utilitaria o variable de tema correspondiente a ese rol.
4. THE Sistema_Tokens SHALL definir la familia tipográfica monoespaciada del Requirement 4 como un token de fuente reutilizable expuesto mediante una variable de tema, en lugar de declararla de forma repetida en la hoja de estilos de cada componente.
5. THE Sistema_Tokens SHALL definir, en el mismo punto de configuración, un conjunto de tokens de espaciado (extra pequeño, pequeño, mediano, grande y extra grande) expresados en una unidad consistente, para uso en márgenes, padding y separaciones entre elementos.
6. IF un componente existente (login, registro, juego, resumen de sesión, leaderboard) contiene un valor de espaciado hardcodeado (margen, padding o gap) cuyo valor numérico coincide exactamente con alguno de los tokens de espaciado definidos en el Sistema_Tokens, THEN ese componente SHALL reemplazar el valor hardcodeado por la referencia a la variable de tema correspondiente a ese token.

### Requirement 3: Resaltado de sintaxis de snippets con highlight.js

**User Story:** Como jugador, quiero ver el snippet de código de cada ronda con resaltado de sintaxis real, para que el snippet sea legible y se sienta como código real de un editor.

#### Acceptance Criteria

1. WHEN el juego muestra el snippet de la ronda actual, THE Resaltador_Sintaxis SHALL renderizar el código con clases de resaltado generadas por `highlight.js`, preservando el contenido textual íntegro del snippet original (sin alterar, truncar ni agregar caracteres al código fuente), incluyendo la prohibición explícita de normalizar espacios en blanco, tabulaciones o saltos de línea, o de insertar saltos de línea adicionales con fines de legibilidad.
2. THE Resaltador_Sintaxis SHALL aplicar la detección automática de lenguaje de `highlight.js` sobre el código del snippet, sin recibir el lenguaje real de la ronda como parámetro explícito.
3. IF `highlight.js` no logra determinar un lenguaje reconocible para el código del snippet, o si la operación de resaltado falla por cualquier otro motivo, THEN el Resaltador_Sintaxis SHALL renderizar el snippet como texto monoespaciado sin resaltado, preservando el contenido textual íntegro del snippet y sin producir un error visible para el jugador.
4. THE Resaltador_Sintaxis SHALL escapar el contenido del snippet antes de insertarlo en el DOM, de forma que ninguna etiqueta HTML, atributo de evento (por ejemplo `onerror`, `onclick`) ni bloque `<script>` presente en el código del snippet se ejecute o se interprete como HTML activo en el navegador.
5. THE archivo `package.json` SHALL fijar la versión de la dependencia `highlight.js` a una versión exacta, sin operadores de rango (`^`, `~`, `>=`, `*`) ni rango abierto amplio.

### Requirement 4: Tipografía monoespaciada real

**User Story:** Como jugador, quiero que el snippet de código se muestre con una tipografía monoespaciada real, para que el alineado de caracteres sea preciso y el código se lea con claridad.

#### Acceptance Criteria

1. THE Aplicacion SHALL importar la fuente monoespaciada (Fira Code o JetBrains Mono) empaquetada localmente como parte del build de la Aplicacion, sin depender de una solicitud de red a un servicio de terceros en tiempo de ejecución ni de que el sistema operativo del jugador ya la tenga instalada.
2. WHEN se renderiza el snippet de código de una ronda, THE Aplicacion SHALL aplicar la fuente monoespaciada importada como fuente del contenedor del snippet de código.
3. IF la fuente monoespaciada importada no ha completado su carga dentro de 3000 milisegundos desde el inicio de la carga de la Aplicacion, THEN el contenedor del snippet de código SHALL recurrir a una pila de fuentes de respaldo monoespaciadas del sistema operativo, manteniendo un ancho uniforme de cada carácter.

### Requirement 5: Layout y encabezado compartido entre pantallas

**User Story:** Como jugador, quiero ver un encabezado consistente con el logo, la ronda y el puntaje visibles en todas las pantallas del juego, para orientarme sin perder contexto al navegar entre pantallas.

#### Acceptance Criteria

1. THE páginas de login, registro, juego, resumen de sesión y leaderboard SHALL delegar la renderización del encabezado al Layout_Compartido, en lugar de definir cada una su propio elemento de encabezado.
2. THE Layout_Compartido SHALL mostrar el nombre/logo de TechGuessr en las pantallas de login, registro, juego, resumen de sesión y leaderboard.
3. WHILE el jugador tiene una sesión de partida con `status = 'playing'`, THE Layout_Compartido SHALL mostrar el número de ronda actual (junto al total de rondas de la sesión) y el puntaje acumulado en el encabezado, mostrando ambos indicadores como una sola unidad: si alguno de los dos datos no está disponible en ese momento, THE Layout_Compartido SHALL ocultar ambos indicadores hasta que los dos estén disponibles simultáneamente.
4. WHILE el jugador no tiene una sesión de partida en curso, THE Layout_Compartido SHALL ocultar los indicadores de ronda y puntaje del encabezado.
5. WHEN el jugador hace clic en el logo del encabezado o lo activa mediante teclado (tecla Enter o Espacio con foco en el logo), THE Layout_Compartido SHALL navegar a `/play` si el jugador está autenticado, o a `/login` si no lo está; IF el jugador no está autenticado pero tiene una sesión de partida activa (`status = 'playing'`), THEN THE Layout_Compartido SHALL navegar a `/play` en lugar de `/login`, preservando la sesión activa.

### Requirement 6: Microinteracciones y transiciones de feedback visual

**User Story:** Como jugador, quiero ver animaciones y transiciones al revelar el resultado de una ronda, avanzar entre rondas y ver mi puntaje, para que el juego se sienta dinámico y satisfactorio al jugar.

#### Acceptance Criteria

1. WHEN el sistema revela el resultado de una ronda, THE Sistema_Microinteracciones SHALL aplicar, en un lapso no mayor a 500 ms, una transición visual distinta para los tramos acertados (✅) y los tramos fallidos (❌) de esa ronda, distinguible mediante al menos uno de los siguientes cambios observables: color de fondo o borde del tramo, ícono indicador, o efecto de animación (por ejemplo, resaltado o vibración breve), aplicado de forma consistente para todos los tramos del mismo estado dentro de la ronda.
2. WHEN el puntaje de la ronda se muestra al jugador, THE Sistema_Microinteracciones SHALL animar el conteo del puntaje desde 0 hasta el valor final de `roundScore` en un lapso de entre 300 ms y 1000 ms, en lugar de mostrar el número final de forma instantánea; IF un sistema externo (por ejemplo, la preferencia `prefers-reduced-motion` del criterio 6) fija explícitamente la duración de esta animación en 0 ms, THEN THE Sistema_Microinteracciones SHALL mostrar el valor final de forma instantánea sin aplicar el rango de 300-1000 ms.
3. WHEN el jugador avanza de una ronda a la siguiente, THE Sistema_Microinteracciones SHALL aplicar, en un lapso no mayor a 400 ms, una transición de entrada y salida entre el snippet de la ronda anterior y el snippet de la ronda nueva, incluyendo las rondas en las que el puntaje obtenido (`roundScore`) sea igual a 0.
4. WHEN el jugador llega a la pantalla de resumen de sesión, THE Sistema_Microinteracciones SHALL animar la aparición del puntaje total y de cada elemento de la lista de rondas de forma escalonada, con un desfase de entre 50 ms y 150 ms entre elementos consecutivos, completando la animación de todos los elementos en un lapso no mayor a 1500 ms, en lugar de mostrar todos los elementos de forma simultánea.
5. WHEN el sistema renderiza la lista del leaderboard, THE Sistema_Microinteracciones SHALL resaltar visualmente la fila correspondiente a la entrada del jugador para diferenciarla del resto de las entradas, siempre que dicha entrada esté incluida en esa lista.
6. WHERE el sistema operativo del jugador tiene activada la preferencia `prefers-reduced-motion`, THE Sistema_Microinteracciones SHALL reemplazar las animaciones no esenciales definidas en los criterios 1 a 5 por una presentación instantánea o de una duración no mayor a 50 ms, sin omitir la información funcional final que cada una comunica (distinción entre tramos acertados y fallidos, valor final del puntaje, contenido del snippet de la ronda nueva, contenido del resumen de sesión, y distinción de la entrada del jugador en el leaderboard).

### Requirement 7: Preservación de la funcionalidad existente durante la revisión visual

**User Story:** Como responsable único del proyecto, quiero que la revisión de UI/UX no altere la lógica de negocio ni los contratos con la API existente, para no arriesgar la estabilidad del MVP a pocos días del deadline del hackathon.

#### Acceptance Criteria

1. THE Frontend_Revisado SHALL preservar sin cambios las rutas, métodos HTTP, parámetros y estructuras de payload de solicitud/respuesta usados actualmente para comunicarse con la API (autenticación, sesión, rondas, resumen, leaderboard).
2. THE Frontend_Revisado SHALL preservar sin cambios el comportamiento funcional público y la lógica interna de los servicios de dominio existentes (`AuthService`, `GameService` y equivalentes), permitiendo únicamente los cambios de código TypeScript necesarios en componentes de presentación (por ejemplo, estado de UI del Layout_Compartido, detección de `prefers-reduced-motion`, disparo de animaciones) sin modificar reglas de negocio ni contratos de API.
3. WHEN se crea, modifica o renombra cualquier archivo del frontend como parte de esta revisión (incluyendo componentes, hojas de estilos y archivos de configuración), THE Frontend_Revisado SHALL seguir la convención de nombres de archivo "2025" (sin sufijo `.component.`) y, en el caso de componentes, el patrón de componentes standalone ya usado en el proyecto.
4. THE suite de pruebas Vitest existente (incluyendo `game.service.spec.ts` y equivalentes) SHALL seguir ejecutándose exitosamente tras aplicar los cambios de esta revisión; IF una prueba existente falla como consecuencia directa de un cambio de presentación intencional de esta revisión (y no de una regresión de lógica de negocio), THEN sus aserciones SHALL poder actualizarse para reflejar el nuevo comportamiento visual esperado, documentando el motivo del cambio en el mensaje de commit o en el propio test.
5. IF un cambio propuesto durante esta revisión requiere alterar una regla de cálculo de puntaje, una transición de estado de sesión, o el contrato de un endpoint existente, THEN ese cambio SHALL considerarse fuera del alcance de este spec y SHALL quedar excluido de la implementación.

## Glossary

- **Build_System**: Angular CLI v22 (`ng build`, `ng add`) junto con Vite, usados para compilar y empaquetar el frontend.
- **Sistema_Estilos**: la combinación de Tailwind CSS v4 y las hojas de estilos SCSS existentes que conviven en un mismo componente.
- **Sistema_Tokens**: el conjunto de variables de tema (colores, tipografía, espaciado) centralizadas en la configuración de Tailwind y/o CSS custom properties, que reemplaza los valores hardcodeados de los componentes.
- **Resaltador_Sintaxis**: la integración de la librería `highlight.js` encargada de aplicar resaltado de sintaxis al código de los snippets mostrados en cada ronda.
- **Aplicacion**: el frontend Angular de TechGuessr en su totalidad (SPA servida vía CloudFront/S3).
- **Layout_Compartido**: el componente de layout raíz (encabezado con logo, indicadores de ronda/puntaje) reutilizado por las pantallas de login, registro, juego, resumen de sesión y leaderboard.
- **Sistema_Microinteracciones**: el conjunto de animaciones y transiciones CSS/Angular (revelar resultado, conteo de puntaje, transición entre rondas, aparición escalonada del resumen, resaltado de fila propia en leaderboard) aplicadas en el flujo de juego.
- **Frontend_Revisado**: el estado del frontend de TechGuessr después de aplicar los cambios de este spec, entendido como el mismo frontend funcional del MVP con su capa de presentación renovada.
