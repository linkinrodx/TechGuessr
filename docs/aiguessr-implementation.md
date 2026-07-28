# AIGuessr - Documentación de Implementación

## Resumen

AIGuessr es el cuarto modo de juego de TechGuessr, diseñado para entrenar a los desarrolladores en la detección de contenido generado por IA y alucinaciones. Incluye dos sub-modalidades complementarias:

1. **Human or AI**: Identifica si un fragmento de texto fue escrito por un humano o generado por IA
2. **Hallucination Hunter**: Detecta afirmaciones falsas en listas de contenido técnico

## Estructura de Archivos

```
src/app/
├── core/
│   └── ai-game.service.ts          # Servicio para manejar sesiones de AIGuessr
├── data/
│   └── ai-content.json              # Dataset con fragmentos y afirmaciones
├── features/
│   └── aiguessr/
│       ├── aiguessr-game.ts         # Componente principal del juego
│       ├── aiguessr-game.html       # Template del juego
│       ├── aiguessr-game.scss       # Estilos del juego
│       ├── ai-session-summary.ts    # Componente de resumen
│       ├── ai-session-summary.html  # Template del resumen
│       └── ai-session-summary.scss  # Estilos del resumen
└── shared/
    └── types/
        └── game.types.ts            # Tipos TypeScript para AIGuessr
```

## Tipos de Datos

### AIRoundResponse
```typescript
interface AIRoundResponse {
  RoundId: string;
  RoundIndex: number;
  Mode: 'human-or-ai' | 'hallucination-hunter';
  Content: string | string[]; // string para human-or-ai, array para hallucination-hunter
  Difficulty: 'easy' | 'medium' | 'hard';
}
```

### AIGuessRequest
```typescript
interface AIGuessRequest {
  mode: AIGameMode;
  isHuman?: boolean;                  // Para human-or-ai
  hallucinationIndices?: number[];    // Para hallucination-hunter
}
```

### AIAnswerResultResponse
```typescript
interface AIAnswerResultResponse {
  Correctness: AICorrectnessResponse;
  CorrectAnswers: AICorrectAnswersResponse;
  Explanation: string;
  RoundScore: number;
  TotalScoreSoFar: number;
  SessionFinished: boolean;
}
```

## Lógica de Puntuación

### Human or AI
- **Acierto correcto**: 500 puntos
- **Error**: 0 puntos

### Hallucination Hunter
- **Por cada alucinación correctamente identificada**: +400 puntos
- **Por cada falso positivo** (marcar una afirmación real como alucinación): -200 puntos
- **Por cada alucinación no detectada**: -100 puntos
- **Perfect score** (todo correcto): multiplicador x2

#### Ejemplo de cálculo:
```
5 afirmaciones totales: 2 alucinaciones reales, 3 afirmaciones verdaderas

Caso 1 - Respuesta perfecta:
- 2 alucinaciones detectadas correctamente: 2 × 400 = 800
- 3 afirmaciones reales marcadas como reales: sin penalización
- Perfect score bonus: 800 × 2 = 1600 puntos totales

Caso 2 - Respuesta parcial:
- 1 alucinación detectada: 1 × 400 = 400
- 1 falso positivo: -200
- 1 alucinación no detectada: -100
- Total: 100 puntos
```

## Dataset Structure (ai-content.json)

### Human or AI
```json
{
  "humanOrAI": [
    {
      "id": "hoa-1",
      "content": "Texto a evaluar...",
      "isHuman": true,
      "difficulty": "medium",
      "hints": ["Pista 1", "Pista 2"],
      "explanation": "Explicación de por qué es humano o IA"
    }
  ]
}
```

### Hallucination Hunter
```json
{
  "hallucinationHunter": [
    {
      "id": "hh-1",
      "topic": "TypeScript",
      "difficulty": "medium",
      "statements": [
        {
          "text": "Afirmación a evaluar",
          "isHallucination": false,
          "explanation": "Por qué es verdadera o falsa"
        }
      ]
    }
  ]
}
```

## Flujo de Juego

### 1. Selección de Modo
El jugador elige entre:
- **Human or AI**: Análisis de fragmentos individuales
- **Hallucination Hunter**: Detección de múltiples afirmaciones

### 2. Rondas del Juego

#### Human or AI:
1. Se muestra un fragmento de texto técnico
2. El jugador selecciona "Humano" o "IA"
3. Se muestra el resultado con explicación
4. Se otorga el puntaje correspondiente

#### Hallucination Hunter:
1. Se muestra una lista de 5-8 afirmaciones sobre un tema técnico
2. El jugador marca cada afirmación como "Real" o "Alucinación"
3. Se muestra el resultado detallado:
   - Alucinaciones correctamente identificadas
   - Falsos positivos
   - Alucinaciones no detectadas
4. Se calcula el puntaje según la fórmula

### 3. Resumen de Sesión
Después de 10 rondas:
- Puntaje total
- Precisión (% de aciertos)
- Desglose por ronda
- Mensaje de desempeño
- Ranking (opcional)

## Endpoints de API (Backend)

### POST /ai-sessions
Crea una nueva sesión de AIGuessr.

**Request:**
```json
{
  "mode": "human-or-ai" | "hallucination-hunter"
}
```

**Response:**
```json
{
  "SessionId": "uuid",
  "TotalRounds": 10
}
```

### GET /ai-rounds/next
Obtiene la siguiente ronda.

**Query params:**
- `sessionId`: ID de la sesión activa

**Response:**
```json
{
  "RoundId": "uuid",
  "RoundIndex": 0,
  "Mode": "human-or-ai",
  "Content": "Texto o array de afirmaciones",
  "Difficulty": "medium"
}
```

### POST /ai-rounds/{roundId}/answer
Envía la respuesta del jugador.

**Request:**
```json
{
  "sessionId": "uuid",
  "guess": {
    "mode": "human-or-ai",
    "isHuman": true
  },
  "clientElapsedMs": 5000
}
```

**Response:**
```json
{
  "Correctness": {
    "IsCorrect": true,
    "Details": { /* detalles específicos del modo */ }
  },
  "CorrectAnswers": { /* respuestas correctas */ },
  "Explanation": "Explicación detallada",
  "RoundScore": 500,
  "TotalScoreSoFar": 1500,
  "SessionFinished": false
}
```

### GET /ai-sessions/{sessionId}/summary
Obtiene el resumen de la sesión completada.

**Response:**
```json
{
  "SessionId": "uuid",
  "TotalScore": 4200,
  "Rounds": [
    {
      "RoundId": "uuid",
      "RoundIndex": 0,
      "Correctness": { "IsCorrect": true },
      "Score": 500
    }
  ],
  "Rank": 15
}
```

## Características de UI/UX

### Selector de Modo
- Cards visuales con iconos distintivos
- Descripción clara de cada modalidad
- Información de puntuación y rondas

### Juego - Human or AI
- Fragmento de texto en área destacada
- Botones grandes "Humano" / "IA"
- Feedback visual al seleccionar
- Animaciones suaves de entrada

### Juego - Hallucination Hunter
- Lista de afirmaciones con checkboxes
- Marcado visual de afirmaciones seleccionadas
- Contador de afirmaciones marcadas
- Botón de confirmación deshabilitado hasta enviar

### Pantalla de Resultado
- Indicador claro de correcto/incorrecto
- Puntaje animado de la ronda
- Explicación detallada del resultado
- Detalles específicos según el modo
- Botón para continuar a la siguiente ronda

### Resumen de Sesión
- Grid de estadísticas (puntaje, precisión, rondas correctas)
- Mensaje de desempeño basado en precisión
- Desglose visual de cada ronda
- Acciones: jugar de nuevo, volver al inicio

## Accessibility

- Semántica HTML correcta (buttons, labels, headings)
- Foco visible en elementos interactivos
- Textos alternativos en iconos informativos
- Respeto por `prefers-reduced-motion`
- Contraste suficiente en todos los textos
- Navegación por teclado completa

## Responsive Design

- Layout adaptativo para móviles (< 768px)
- Grid de cards se convierte en columna única
- Botones apilados verticalmente en móvil
- Texto y espaciado ajustado para pantallas pequeñas

## Estado Actual

✅ **Implementado en Frontend:**
- Servicio AIGameService
- Dataset curado con 8 fragmentos Human/AI y 6 rondas Hallucination Hunter
- Componentes de juego y resumen
- Rutas configuradas
- Integración en la página de inicio

⚠️ **Pendiente:**
- Backend API en .NET para los endpoints de AIGuessr
- Lógica de puntuación en el servidor
- Persistencia de sesiones y rankings
- Tabla de leaderboard específica para AIGuessr

## Roadmap Post-MVP

### Contenido
- Expandir dataset a 50+ fragmentos por modalidad
- Agregar categorías temáticas (código, documentación, artículos técnicos)
- Generación dinámica con Kiro

### Features
- Modo "Mixto": alterna entre Human/AI y Hallucination Hunter
- Pistas opcionales (consume puntos)
- Modo educativo con explicaciones antes de responder
- Historial de desempeño por tema

### Social
- Leaderboard específico de AIGuessr
- Compartir resultados en redes
- Desafíos diarios
- Modo competitivo vs otros jugadores

## Notas de Desarrollo

### Diferencias con otros modos

**CodeGuessr/CommitGuessr/UIGuessr:**
- Una pregunta por ronda
- Respuesta simple o cascada de campos

**AIGuessr:**
- Dos modalidades completamente diferentes
- Human or AI: binaria (true/false)
- Hallucination Hunter: múltiple (array de índices)

Por eso AIGameService es un servicio separado en lugar de extender GameService.

### Consideraciones de Implementación

1. **Separación de servicios**: AIGameService maneja únicamente AIGuessr, evitando sobrecargar GameService con lógica condicional compleja.

2. **Dataset offline**: El archivo `ai-content.json` debe curarse manualmente o con asistencia de Kiro, asegurando que las "verdades" sean 100% correctas.

3. **Explicaciones detalladas**: Cada item del dataset incluye `explanation` para retroalimentación educativa post-respuesta.

4. **Puntuación justa**: Hallucination Hunter penaliza falsos positivos para incentivar precisión sobre cantidad.

## Referencias

- Documentación original en `propuestas-ideas.md`
- Steering rules en `.kiro/steering/`
- Arquitectura general en `docs/arquitectura.md`
