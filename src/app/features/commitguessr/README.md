# CommitGuessr

Modo de juego donde el jugador debe analizar diffs anonimizados y adivinar información sobre los commits.

## Estructura del Modo de Juego

### Rondas

Cada partida consta de **10 rondas**. En cada ronda, se presenta:
- Un diff anonimizado (sin nombre de archivo, sin autor, sin mensaje de commit)
- 4 preguntas que el jugador debe responder

### Preguntas por Ronda

1. **Tipo de cambio (obligatorio)**: 
   - 🚀 Feature (funcionalidad nueva)
   - 🐛 Bug Fix (corrección de errores)
   - 🔧 Refactor (reestructuración sin cambio de funcionalidad)
   - 📚 Docs (documentación)
   - ✅ Test (pruebas)
   - ⚡ Performance (optimización)

2. **Mensaje de commit correcto (opcional)**: 
   - Se presentan 4 opciones de mensajes
   - Solo una es la correcta
   - Solo se evalúa si se acertó el tipo de cambio

3. **Estimación de esfuerzo en minutos (opcional)**:
   - El jugador estima cuánto tiempo tomó hacer el cambio
   - Se acepta un margen de ±20% del valor real

4. **Cantidad de archivos modificados (opcional)**:
   - Bonus challenge
   - Debe ser exacto para sumar puntos

## Sistema de Puntuación

| Acierto | Puntos |
|---------|--------|
| Tipo de cambio correcto | 400 |
| Mensaje correcto | 600 |
| Estimación de esfuerzo ±20% | 500 |
| Archivos modificados exacto | 300 |

**Puntaje máximo por ronda**: 1,800 puntos  
**Puntaje máximo total (10 rondas)**: 18,000 puntos

## Dataset

Los diffs provienen de:
- Snippets reales de commits de proyectos open source
- Commits curados manualmente para representar patrones típicos
- Metadatos removidos para anonimización

Ver `src/app/data/commits.json` para el dataset completo.

## Implementación Actual

**Estado**: MVP funcional con backend .NET integrado y persistencia en DynamoDB

### Características implementadas
- ✅ 10 commits curados en `commits.json` (dataset inicial)
- ✅ Interfaz completa con selección de tipo, mensaje, y campos numéricos
- ✅ **Backend .NET completo con API Gateway + Lambda**
- ✅ **Persistencia de sesiones en DynamoDB**
- ✅ **CommitGameService para comunicación con el backend**
- ✅ Sistema de puntuación según especificación
- ✅ Resaltado de sintaxis para diffs con highlight.js
- ✅ Animaciones y transiciones
- ✅ Navegación integrada desde Home

### Arquitectura del Backend

El backend CommitGuessr sigue la misma arquitectura que CodeGuessr:

**Endpoints de API:**
- `POST /commit-sessions` - Crea una nueva sesión
- `GET /commit-rounds/next?sessionId={id}` - Obtiene la siguiente ronda
- `POST /commit-rounds/{roundId}/answer` - Envía respuesta de una ronda
- `GET /commit-sessions/{sessionId}/summary` - Obtiene resumen de sesión finalizada
- `GET /commit-leaderboard` - Leaderboard específico de CommitGuessr (público, sin auth)

**Leaderboard separado por modalidad:** CommitGuessr y CodeGuessr comparten
la tabla física `techguessr-scores`, pero cada uno usa su propio
`leaderboardShard` (`commitguessr` vs `codeguessr`). Es necesario porque el
techo de puntaje de CommitGuessr (1,800 pts/ronda) es mucho más alto que el
de CodeGuessr (300 pts/ronda); sin esta separación, CommitGuessr dominaría
siempre un ranking combinado.

**Componentes:**
- `CommitGameService` (frontend) - Servicio Angular para comunicación con API
- `CommitsRepository` - Acceso a tabla DynamoDB de commits
- `CommitSessionsRepository` - Gestión de sesiones CommitGuessr
- `CommitScoring` - Lógica de puntuación independiente
- `CommitSessionTransitions` - Máquina de estados de sesión

**Puntuación:**
- Tipo de cambio correcto: 400 puntos (obligatorio)
- Mensaje correcto: 600 puntos (opcional)
- Estimación de esfuerzo ±20%: 500 puntos (opcional)
- Archivos modificados exacto: 300 puntos (opcional)
- **Total máximo por ronda: 1,800 puntos**

### Próximos pasos (post-MVP)
- [ ] Expansión del dataset (50+ commits variados)
- [ ] Generación dinámica de distractores para mensajes
- [ ] Modo educativo con explicaciones detalladas expandidas
- [ ] Migrar datos de commits a DynamoDB (actualmente JSON local, requiere ejecutar `infra/scripts/migrate-commits.ts`)

## Componentes

- **commitguessr-game.ts**: Lógica principal del juego
- **commitguessr-game.html**: Template con formulario y resultados
- **commitguessr-game.scss**: Estilos específicos del modo
- **commit-session-summary.ts**: Resumen de partida finalizada (consume `CommitGameService`)
- **commit-leaderboard.ts**: Tabla de mejores puntajes específica de CommitGuessr

## Rutas

- `/commit`: Pantalla de juego de CommitGuessr (requiere autenticación, redirecciona a `/login` si no hay sesión)
- `/commit-summary`: Resumen de la partida finalizada
- `/commit-leaderboard`: Leaderboard específico de CommitGuessr (público)

## Diferencias con CodeGuessr

| Aspecto | CodeGuessr | CommitGuessr |
|---------|------------|--------------|
| **Input** | Snippet de código | Diff anonimizado |
| **Respuestas** | 3 tramos en cascada | 1 obligatorio + 3 opcionales |
| **Interacción** | Inputs con autocompletado | Botones + inputs numéricos |
| **Evaluación** | Cascada (si falla lenguaje, no evalúa framework) | Independiente (todas las respuestas se evalúan) |
| **Highlight** | Auto-detección | Forzado a 'diff' |
