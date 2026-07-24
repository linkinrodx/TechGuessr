# Requirements Document

## Introduction

CodeGuessr es la única modalidad de juego del MVP de TechGuessr: un juego de adivinanza técnica de un solo jugador en el que se presenta al usuario un snippet de código anonimizado y debe adivinar, en cascada, el lenguaje, el framework/librería y el proyecto de origen. El MVP incluye un único modo de partida (Clásico, 10 rondas), autenticación de usuarios vía AWS Cognito, y una tabla de mejores puntajes simple. Estos requisitos se derivan del diseño técnico ya acordado en `design.md` y en `docs/arquitectura.md`, y delimitan el comportamiento observable del sistema (frontend Angular, API Gateway + Lambda, DynamoDB, Cognito) sin introducir alcance fuera del MVP (sin multiplayer, sin otras modalidades, sin generación dinámica de contenido con Kiro en runtime).

## Requirements

### Requirement 1: Autenticación de usuario

**User Story:** Como jugador, quiero registrarme e iniciar sesión con una cuenta, para poder guardar mi puntaje y aparecer en la tabla de mejores puntajes.

#### Acceptance Criteria

1. WHEN un usuario nuevo se registra con email, nombre de usuario y contraseña THEN el sistema SHALL crear la cuenta en el Cognito User Pool y requerir confirmación antes de permitir el login.
2. WHEN un usuario confirma su registro con el código enviado THEN el sistema SHALL habilitar la cuenta para iniciar sesión.
3. WHEN un usuario envía credenciales válidas (email y contraseña correctos) THEN el sistema SHALL emitir un JWT válido y permitir el acceso a las rutas autenticadas de la API.
4. IF un usuario envía credenciales inválidas THEN el sistema SHALL rechazar el login sin revelar si el email existe o no.
5. WHEN un usuario cierra sesión THEN el frontend SHALL descartar el JWT local y dejar de adjuntarlo en llamadas posteriores a la API.
6. IF una petición a una ruta autenticada de la API no incluye un JWT válido THEN el sistema SHALL responder 401 y el frontend SHALL redirigir a la pantalla de login.

### Requirement 2: Creación de sesión de partida Clásica

**User Story:** Como jugador autenticado, quiero iniciar una nueva partida Clásica, para empezar a jugar 10 rondas de CodeGuessr.

#### Acceptance Criteria

1. WHEN un usuario autenticado solicita crear una sesión (`POST /sessions`) THEN el sistema SHALL crear una nueva sesión con `status = 'in_progress'`, `totalRounds = 10` y `roundsPlayed` vacío, asociada al `userId` del JWT.
2. WHEN la sesión se crea exitosamente THEN el sistema SHALL responder con el `sessionId` generado y `totalRounds`.
3. IF el dataset de snippets disponibles tiene menos de 10 snippets utilizables THEN el sistema SHALL responder 500 al intentar crear la sesión.

### Requirement 3: Obtención de la siguiente ronda sin filtración de respuestas

**User Story:** Como jugador, quiero recibir el siguiente snippet de la partida sin ver las respuestas correctas, para que el juego sea un desafío real.

#### Acceptance Criteria

1. WHEN un jugador solicita la siguiente ronda (`GET /rounds/next`) de una sesión `in_progress` sin ronda pendiente sin responder THEN el sistema SHALL devolver un nuevo `roundId`, el `code` del snippet, `roundIndex` y `difficulty`.
2. THE response de `GET /rounds/next` SHALL NOT incluir los campos reales `language`, `framework` ni `project` del snippet devuelto.
3. IF la sesión referenciada ya está `finished` THEN el sistema SHALL responder 409 al solicitar la siguiente ronda.
4. IF la sesión tiene una ronda ya entregada que aún no fue respondida THEN el sistema SHALL responder 409 en lugar de entregar una ronda nueva.
5. IF la sesión referenciada no pertenece al usuario autenticado THEN el sistema SHALL responder 403 sin revelar si la sesión existe.

### Requirement 4: Envío de respuesta y cálculo de puntaje en cascada

**User Story:** Como jugador, quiero enviar mis adivinanzas de lenguaje, framework y proyecto para una ronda, para recibir una corrección y un puntaje calculados de forma justa.

#### Acceptance Criteria

1. WHEN un jugador envía una respuesta (`POST /rounds/{roundId}/answer`) con al menos el campo `language` THEN el sistema SHALL calcular la corrección server-side comparando contra los valores reales del snippet, normalizando texto (trim y case-insensitive).
2. IF `correctness.language` es `false` THEN el sistema SHALL establecer `correctness.framework` y `correctness.project` en `null` y SHALL NOT evaluar esos tramos.
3. IF el snippet tiene `framework = null` THEN el sistema SHALL omitir el tramo de framework (y por extensión el de project) del cálculo de puntaje, sin sumar ni restar puntos por ese tramo.
4. WHEN se calcula el puntaje de una ronda THEN el sistema SHALL producir un `roundScore` tal que `0 <= roundScore <= MAX_ROUND_SCORE`, calculado a partir de los tramos acertados y el tiempo de respuesta medido server-side entre `startedAt` y `answeredAt`.
5. THE cálculo de `roundScore` SHALL NOT depender del valor de `clientElapsedMs` enviado por el cliente; ese campo es únicamente referencial.
6. WHEN una respuesta se procesa exitosamente THEN el sistema SHALL responder con `correctness`, `correctAnswers`, `explanation`, `roundScore`, `totalScoreSoFar` y `sessionFinished`.
7. IF el `roundId` no existe o no pertenece a la sesión/usuario autenticado THEN el sistema SHALL responder 404.
8. IF la ronda referenciada por `roundId` ya fue respondida previamente THEN el sistema SHALL responder 409 sin modificar `roundScore`, `totalScore` ni `correctness` almacenados (idempotencia).

### Requirement 5: Límite de rondas y finalización de sesión

**User Story:** Como jugador, quiero que la partida termine automáticamente después de 10 rondas, para que el juego tenga una duración predecible y consistente con el modo Clásico.

#### Acceptance Criteria

1. THE `roundsPlayed.length` de una sesión SHALL NOT exceder 10 en ningún momento.
2. WHEN la ronda número 10 de una sesión es respondida THEN el sistema SHALL, dentro de la misma escritura atómica que registra esa respuesta, marcar la sesión como `status = 'finished'`, registrar `finishedAt` y devolver `sessionFinished = true` en la respuesta de esa ronda.
3. IF `roundsPlayed.length === 10` THEN `status` SHALL be `'finished'`; IF `status === 'finished'` THEN `roundsPlayed.length` SHALL be `10`. No SHALL existir un estado intermedio observable donde `roundsPlayed.length === 10` y `status` sea `'in_progress'`.
4. WHEN una sesión finaliza THEN el sistema SHALL escribir una entrada en la tabla de mejores puntajes con el `totalScore` calculado server-side.

### Requirement 6: Resumen de sesión finalizada

**User Story:** Como jugador, quiero ver un resumen de mi partida al terminar las 10 rondas, para revisar mis aciertos y mi puntaje total.

#### Acceptance Criteria

1. WHEN un jugador solicita el resumen (`GET /sessions/{sessionId}/summary`) de una sesión `finished` que le pertenece THEN el sistema SHALL devolver `totalScore`, el detalle de las 10 rondas (`rounds`) y su posición en el leaderboard si aplica (`rank`).
2. IF la sesión referenciada aún está `in_progress` THEN el sistema SHALL responder 409 al solicitar el resumen.
3. IF la sesión referenciada no pertenece al usuario autenticado THEN el sistema SHALL responder 403.
4. THE `totalScore` devuelto en el resumen SHALL be igual a la suma de `roundScore` de las 10 entradas de `rounds`.

### Requirement 7: Tabla de mejores puntajes (leaderboard)

**User Story:** Como jugador, quiero ver la tabla de mejores puntajes, para comparar mi desempeño con otros jugadores.

#### Acceptance Criteria

1. WHEN cualquier visitante solicita `GET /leaderboard` (con o sin autenticación) THEN el sistema SHALL devolver hasta `limit` entradas ordenadas por `totalScore` descendente.
2. THE respuesta de `GET /leaderboard` SHALL incluir únicamente `username`, `totalScore` y `achievedAt` por entrada, sin `userId` interno ni otros datos de cuenta.
3. IF no se especifica `limit` THEN el sistema SHALL usar un valor por defecto documentado y SHALL NOT exceder un máximo configurado.
4. THE endpoint `GET /leaderboard` SHALL NOT requerir JWT.

### Requirement 8: Autorización a nivel de recurso

**User Story:** Como jugador, quiero que solo yo pueda ver y responder mis propias sesiones y rondas, para que otros jugadores no puedan interferir con mi partida.

#### Acceptance Criteria

1. WHEN se procesa cualquier operación sobre una `sessionId` o `roundId` (obtener ronda, responder ronda, obtener resumen) THEN el sistema SHALL verificar que `session.userId` coincide con el `sub`/`username` del JWT antes de leer o escribir datos.
2. IF el `userId` del JWT no coincide con el propietario del recurso THEN el sistema SHALL responder 403 sin revelar si el recurso existe.

### Requirement 9: Manejo de errores del sistema

**User Story:** Como jugador, quiero recibir mensajes de error claros y consistentes cuando algo falla, para entender qué hacer a continuación sin perder el progreso de mi partida.

#### Acceptance Criteria

1. IF DynamoDB no está disponible o aplica throttling durante una operación de la API THEN el sistema SHALL responder 502 o 503 y el frontend SHALL permitir un reintento manual.
2. IF una ronda referencia un `snippetId` que no existe en la tabla de snippets THEN el sistema SHALL responder 500 y registrar el error en logs de Lambda.
3. THE frontend SHALL NOT determinar autoridad de negocio (puntaje, corrección, estado de sesión) a partir de estados de error; SHALL reflejar únicamente lo que la API devuelve.

### Requirement 10: Dataset curado de snippets

**User Story:** Como responsable del contenido del juego, quiero cargar un dataset curado de snippets anonimizados, para que las rondas tengan contenido variado y sin errores.

#### Acceptance Criteria

1. THE dataset inicial SHALL be un archivo JSON curado a mano (con apoyo offline de Kiro), importado a la tabla `techguessr-snippets` mediante un script de carga fuera del flujo de runtime.
2. THE código (`code`) de cada snippet SHALL NOT contener metadatos identificatorios (nombre de archivo, autor, URL del repositorio).
3. IF el campo `framework` de un snippet es `null` THEN su campo `project` SHALL también ser `null`.
4. THE sistema SHALL NOT realizar scraping en vivo de la API de GitHub en runtime para obtener snippets.

## Glossary

- **Sesión (Session):** una partida Clásica de 10 rondas, identificada por `sessionId`, con estado `in_progress` o `finished`.
- **Ronda (Round):** un desafío individual dentro de una sesión, identificado por `roundId`, asociado a un snippet.
- **Snippet:** fragmento de código anonimizado usado como desafío, con respuestas correctas de `language`, `framework` y `project`.
- **Cascada (de corrección):** el orden de evaluación language → framework → project, donde fallar un tramo impide evaluar los siguientes.
- **Leaderboard:** tabla de mejores puntajes, ordenada por `totalScore` descendente.
- **JWT:** JSON Web Token emitido por Cognito tras un login exitoso, usado para autenticar llamadas a la API.
