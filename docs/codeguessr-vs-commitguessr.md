# CodeGuessr vs CommitGuessr - Comparativa Técnica

Análisis comparativo de las dos modalidades de juego implementadas en TechGuessr.

---

## 🎯 Concepto de Juego

| Aspecto | CodeGuessr | CommitGuessr |
|---------|-----------|--------------|
| **Input principal** | Snippet de código fuente | Diff anonimizado (patch) |
| **Pregunta central** | ¿De dónde viene este código? | ¿Qué cambió y por qué? |
| **Respuestas** | Lenguaje → Framework → Proyecto | Tipo → Mensaje → Esfuerzo → Archivos |
| **Cascada** | ✅ Sí (falla lenguaje = no evalúa resto) | ❌ No (evaluación independiente) |
| **Opcionales** | Framework y Proyecto | Mensaje, Esfuerzo y Archivos |

---

## 📊 Sistema de Puntuación

### CodeGuessr

| Tramo | Puntos Base | Bonus Velocidad | Total Máx |
|-------|-------------|-----------------|-----------|
| Lenguaje | 60 | 0-40 | 100 |
| Framework | 60 | 0-40 | 100 |
| Proyecto | 60 | 0-40 | 100 |
| **Total Ronda** | | | **300** |
| **Total Partida (10)** | | | **3,000** |

**Fórmula bonus:**
- ≤3s: 40 puntos
- 3s-15s: decrecimiento lineal
- ≥15s: 0 puntos

### CommitGuessr

| Pregunta | Puntos | Validación |
|----------|--------|------------|
| Tipo de cambio | 400 | Case-insensitive |
| Mensaje | 600 | Elección múltiple (4 opciones) |
| Esfuerzo | 500 | ±20% margen |
| Archivos | 300 | Exacto |
| **Total Ronda** | **1,800** | |
| **Total Partida (10)** | **18,000** | |

**Sin bonus de velocidad** — enfoque en análisis sobre rapidez

---

## 🏗️ Arquitectura Backend

### Modelos de Datos

| Concepto | CodeGuessr | CommitGuessr |
|----------|-----------|--------------|
| **Dataset** | `Snippet` | `Commit` |
| **Sesión** | `SessionState` | `CommitSessionState` |
| **Ronda** | `RoundRecord` | `CommitRoundRecord` |
| **Guess** | `Guess(language, framework, project)` | `CommitGuess(commitType, message, effortMinutes, filesModified)` |
| **Correctness** | `Correctness(bool, bool?, bool?)` | `CommitCorrectness(bool, bool?, bool?, bool?)` |

### Tablas DynamoDB

| Tabla | CodeGuessr | CommitGuessr |
|-------|-----------|--------------|
| **Dataset** | `techguessr-snippets` | `techguessr-commits` |
| **Sesiones** | `techguessr-sessions` | `techguessr-commit-sessions` |
| **Scores** | `techguessr-scores` (compartida) | `techguessr-scores` (compartida) |
| **GSI Dataset** | `byRandomBucket` (N, S) | `byRandomBucket` (N, S) |
| **GSI Sesiones** | `byUserId` (S, S) | `byUserId` (S, S) |

### Endpoints API

| Operación | CodeGuessr | CommitGuessr |
|-----------|-----------|--------------|
| **Crear sesión** | `POST /sessions` | `POST /commit-sessions` |
| **Siguiente ronda** | `GET /rounds/next?sessionId={id}` | `GET /commit-rounds/next?sessionId={id}` |
| **Enviar respuesta** | `POST /rounds/{roundId}/answer` | `POST /commit-rounds/{roundId}/answer` |
| **Resumen** | `GET /sessions/{sessionId}/summary` | `GET /commit-sessions/{sessionId}/summary` |

---

## 🎨 Diferencias de UI

### CodeGuessr

```
┌──────────────────────────┐
│  Snippet de código       │
│  (resaltado por lenguaje)│
└──────────────────────────┘

[Input: Lenguaje] (autocompletado, ↑↓ Tab Enter)
[Input: Framework] (autocompletado)
[Input: Proyecto] (autocompletado)

[Botón: Responder]
```

**Características:**
- Autocompletado inteligente con navegación por teclado
- Umbral mínimo de 2 caracteres para sugerencias
- Focus automático en siguiente input tras selección
- Animación de entrada del snippet

### CommitGuessr

```
┌──────────────────────────┐
│  Diff anonimizado        │
│  (resaltado de sintaxis  │
│   forzado a 'diff')      │
└──────────────────────────┘

[Grid: 6 botones tipo commit] (obligatorio)
[4 botones: mensajes opcionales]
[Input numérico: esfuerzo]
[Input numérico: archivos]

[Botón: Responder]
```

**Características:**
- Selección visual con botones
- Sin autocompletado (opciones fijas)
- Campos numéricos con validación min/max
- Badge de dificultad visible

---

## 🧮 Lógica de Scoring

### CodeGuessr: Cascada

```csharp
// Si falla lenguaje, no se evalúa framework ni project
var languageCorrect = AreEqual(guess.Language, correct.Language);
if (!languageCorrect) {
    return (Language: false, Framework: null, Project: null);
}

// Si falla framework, no se evalúa project
var frameworkCorrect = AreEqual(guess.Framework, correct.Framework);
if (!frameworkCorrect) {
    return (Language: true, Framework: false, Project: null);
}

// Solo si language y framework correctos, evalúa project
var projectCorrect = AreEqual(guess.Project, correct.Project);
return (Language: true, Framework: true, Project: projectCorrect);
```

### CommitGuessr: Independiente

```csharp
// Todas las respuestas se evalúan independientemente
var commitTypeCorrect = AreEqual(guess.CommitType, correct.CommitType);

var messageCorrect = guess.Message != null 
    ? AreEqual(guess.Message, correct.Message) 
    : null;

var effortCorrect = guess.EffortMinutes != null
    ? IsWithinMargin(guess.EffortMinutes, correct.EffortMinutes, 0.20)
    : null;

var filesCorrect = guess.FilesModified != null
    ? (guess.FilesModified == correct.FilesModified)
    : null;

return (commitTypeCorrect, messageCorrect, effortCorrect, filesCorrect);
```

---

## 📁 Estructura de Archivos

### Backend .NET

```
GameFunction/
├── Domain/
│   ├── SessionModels.cs          ├── CommitSessionModels.cs
│   ├── Scoring.cs                ├── CommitScoring.cs
│   ├── SessionTransitions.cs     ├── CommitSessionTransitions.cs
│   └── ScoringModels.cs          (reutilizado)
├── Repositories/
│   ├── SnippetsRepository.cs     ├── CommitsRepository.cs
│   ├── SessionsRepository.cs     ├── CommitSessionsRepository.cs
│   └── ScoresRepository.cs       (compartido)
└── Api/
    └── ApiModels.cs (ambos en el mismo archivo)
```

### Frontend Angular

```
src/app/
├── core/
│   ├── game.service.ts           ├── commit-game.service.ts
│   └── auth.service.ts           (compartido)
├── features/
│   ├── codeguessr/               ├── commitguessr/
│   │   ├── codeguessr-game.ts   │   ├── commitguessr-game.ts
│   │   ├── codeguessr-game.html │   ├── commitguessr-game.html
│   │   ├── codeguessr-game.scss │   ├── commitguessr-game.scss
│   │   ├── session-summary.ts   │   └── README.md
│   │   └── leaderboard.ts       (compartidos)
└── shared/
    └── types/game.types.ts (ambos en el mismo archivo)
```

---

## 🔄 Flujo de Sesión

### CodeGuessr

1. Usuario → `POST /sessions` → **SessionState** creada
2. Loop 10 rondas:
   - `GET /rounds/next` → selecciona **Snippet** aleatorio
   - Usuario responde → `POST /rounds/{id}/answer`
   - Backend evalúa con **cascada** y **bonus velocidad**
   - Acumula puntaje en **SessionState**
3. Ronda 10 → `SessionState.status = Finished`
4. `GET /sessions/{id}/summary` → ranking + resumen

### CommitGuessr

1. Usuario → `POST /commit-sessions` → **CommitSessionState** creada
2. Loop 10 rondas:
   - `GET /commit-rounds/next` → selecciona **Commit** aleatorio
   - Usuario responde → `POST /commit-rounds/{id}/answer`
   - Backend evalúa **independientemente**, sin bonus
   - Acumula puntaje en **CommitSessionState**
3. Ronda 10 → `CommitSessionState.status = Finished`
4. `GET /commit-sessions/{id}/summary` → ranking + resumen

---

## 🎯 Similitudes (Arquitectura Compartida)

| Aspecto | Compartido |
|---------|------------|
| **Infraestructura** | AWS Lambda (única "game function") + API Gateway + DynamoDB |
| **Autenticación** | AWS Cognito con JWT authorizer |
| **Patrón de repositorios** | Optimistic locking con `version`, serialización JSON de rondas |
| **Selección aleatoria** | GSI `byRandomBucket` (0-9) para evitar Scan |
| **Leaderboard** | Tabla compartida `techguessr-scores` con GSI `byTotalScore` |
| **Frontend** | Angular con Signals, animaciones, accesibilidad |
| **Deployment** | AWS CDK (Infrastructure as Code) |

---

## 🧪 Testing

### CodeGuessr

**Propiedades críticas:**
- Property 1: Comparación case-insensitive con trim
- Property 2: Cascada (falla lenguaje → framework/project = null)
- Property 3: Omisión (snippet sin framework → framework = null)
- Property 4: Consistencia de suma (`totalScore = Σ roundScores`)
- Property 5: Idempotencia (respuesta duplicada → 409, sin cambios)
- Property 6: Límite de rondas (ronda 10 → status = Finished)

**Test suite:** `infra/lambda-dotnet/GameFunction.Tests/ScoringPropertyTests.cs`

### CommitGuessr

**Propiedades esperadas (no implementadas aún):**
- Comparación case-insensitive para tipo y mensaje
- Validación margen ±20% para esfuerzo
- Evaluación independiente (tipo correcto ≠ obligatorio evaluar mensaje)
- Consistencia de suma
- Idempotencia
- Límite de rondas

**Test suite:** ⚠️ Pendiente crear `CommitScoringPropertyTests.cs`

---

## 📈 Métricas de Complejidad

| Métrica | CodeGuessr | CommitGuessr | Ratio |
|---------|-----------|--------------|-------|
| **Líneas backend** | ~1,500 | ~1,200 | 0.8x |
| **Líneas frontend** | ~800 | ~400 | 0.5x |
| **Endpoints** | 5 | 4 | 0.8x |
| **Tablas DDB** | 3 | 2 (+1 compartida) | — |
| **Complejidad scoring** | Alta (cascada + velocidad) | Media (independiente) | — |

---

## 🎓 Aprendizajes Clave

### Ventajas de la Cascada (CodeGuessr)

✅ **Pro:**
- Refleja conocimiento jerárquico real (lenguaje → framework → proyecto)
- Evita "adivinanzas afortunadas" sin contexto
- Penaliza errores tempranos fuertemente

❌ **Con:**
- Más compleja de implementar y testear
- Difícil de explicar a usuarios nuevos
- Requiere dataset con jerarquía estricta

### Ventajas de Evaluación Independiente (CommitGuessr)

✅ **Pro:**
- Más simple de implementar
- Predecible para el usuario
- Flexible: permite respuestas parciales
- Incentiva intentar todas las preguntas

❌ **Con:**
- Menos realista (tipo correcto no garantiza mensaje correcto)
- Permite "shotgun approach" sin penalización

---

## 🚀 Recomendaciones de Diseño

### Para Nuevas Modalidades

Si implementas **StackGuessr**, **UIGuessr**, etc.:

1. **Decide temprano:** ¿Cascada o independiente?
2. **Considera el contexto:** Errores tempranos inválidan preguntas posteriores → Cascada
3. **Simplifica scoring:** Evita fórmulas complejas (velocidad, multiplicadores) en MVP
4. **Reutiliza:** `ScoresRepository`, `SessionStatus`, infraestructura CDK
5. **Separa dominio:** Lógica pura sin AWS facilita testing

### Mejoras Futuras

**CodeGuessr:**
- Bonus adicional por velocidad promedio de sesión
- Penalización por respuestas vacías
- Hints opcionales (-50 puntos, revela 1 letra)

**CommitGuessr:**
- Validación semántica de mensajes con IA
- Generación dinámica de distractores plausibles
- Bonus por racha de aciertos consecutivos

---

## 📚 Referencias

- [Propuestas e Ideas](../propuestas-ideas.md) - Diseño original de ambos modos
- [Arquitectura del Proyecto](arquitectura.md) - Stack técnico completo
- [CodeGuessr Design](../.kiro/specs/codeguessr-mvp/design.md) - Especificación detallada
- [CommitGuessr README](../src/app/features/commitguessr/README.md) - Implementación

---

**Actualizado:** Julio 2026  
**Autor:** linkinrodx
