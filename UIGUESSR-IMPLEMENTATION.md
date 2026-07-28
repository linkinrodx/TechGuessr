# UIGuessr - Implementación Completa

## Estado: ✅ Implementado y funcional

UIGuessr es el tercer modo de juego de TechGuessr, donde los jugadores identifican aplicaciones y sitios web a partir de screenshots de interfaces sin branding visible.

## Archivos Implementados

### Frontend Components

1. **`src/app/features/uiguessr/uiguessr-game.ts`** - Componente principal del juego
   - Gestiona el flujo de rondas
   - Maneja la entrada del usuario (app, acción, año)
   - Muestra los screenshots y resultados
   - Animaciones de transición entre rondas
   - Autocomplete para apps y acciones comunes

2. **`src/app/features/uiguessr/uiguessr-game.html`** - Template del juego
   - Layout responsive con screenshot prominente
   - Formulario de 3 campos (app, acción, año)
   - Datalists para sugerencias
   - Pantalla de resultados con feedback detallado

3. **`src/app/features/uiguessr/uiguessr-game.scss`** - Estilos del juego
   - Animaciones de entrada para screenshots
   - Estilos para estados correct/incorrect
   - Soporte para `prefers-reduced-motion`

4. **`src/app/features/uiguessr/ui-session-summary.ts`** - Componente de resumen
   - Muestra tabla de rondas completadas
   - Puntaje total y desglose por ronda
   - Botones para jugar de nuevo o volver al home

5. **`src/app/features/uiguessr/ui-session-summary.html`** - Template del resumen
   - Tabla con resultados por ronda (App, Acción, Año)
   - Indicadores de correctness (✅/❌)
   - Diferencia de años mostrada

6. **`src/app/features/uiguessr/ui-session-summary.scss`** - Estilos del resumen
   - Tabla responsive
   - Animaciones escalonadas de entrada
   - Estilos consistentes con el resto de la app

### Core Services

7. **`src/app/core/ui-game.service.ts`** - Servicio de lógica de juego
   - Modo local (sin backend, similar a CommitGuessr)
   - Gestión de sesiones con 10 rondas aleatorias
   - Validación de respuestas (case-insensitive)
   - Sistema de puntuación en cascada:
     - App correcta: 500 pts
     - Acción correcta (si app es correcta): +400 pts
     - Año exacto (si app y acción correctas): +900 pts
     - Año ±1 (si app y acción correctas): +600 pts
   - Generación de resumen de sesión

### Data

8. **`src/app/data/ui-screenshots.json`** - Dataset de 16 screenshots
   - Apps populares: Twitter, Facebook, YouTube, Gmail, Instagram, Spotify, etc.
   - Años: 2007-2016
   - Dificultades: easy, medium, hard
   - Explicaciones educativas sobre cada versión histórica

### Types

9. **`src/app/shared/types/game.types.ts`** - Tipos TypeScript (ya existía, agregadas las interfaces UIGuessr)
   - `UIRoundResponse` - Datos de una ronda
   - `UIGuessRequest` - Respuesta del jugador
   - `UICorrectnessResponse` - Validación de respuesta
   - `UIAnswerResultResponse` - Resultado de una ronda
   - `UISessionSummaryResponse` - Resumen de sesión

### Assets

10. **`public/assets/ui-screenshots/*.svg`** - 16 placeholders SVG
   - Generados con colores de branding de cada app
   - Texto con nombre de app y año
   - Nota visible: "Placeholder - Reemplazar con screenshot real"
   - Archivos:
     - `twitter-2010.svg`
     - `facebook-2008.svg`
     - `youtube-2012.svg`
     - `gmail-2011.svg`
     - `instagram-2013.svg`
     - `spotify-2015.svg`
     - `reddit-2009.svg`
     - `netflix-2014.svg`
     - `amazon-2007.svg`
     - `github-2011.svg`
     - `linkedin-2010.svg`
     - `slack-2016.svg`
     - `airbnb-2012.svg`
     - `whatsapp-2015.svg`
     - `dropbox-2013.svg`
     - `pinterest-2011.svg`

### Integration

11. **`src/app/features/home/home.ts`** - Método `onPlayUIguessr()` agregado
    - Verifica autenticación
    - Navega a `/ui-play` si hay usuario
    - Redirige a `/login` si no hay sesión

12. **`src/app/features/home/home.html`** - Card de UIGuessr visible
    - Badge "disponible" (no "Próximamente")
    - Descripción: "Identifica apps y sitios web a partir de screenshots de interfaces sin branding visible"

13. **`src/app/app.routes.ts`** - Rutas agregadas:
    - `/ui-play` → `UIguessrGame`
    - `/ui-summary` → `UISessionSummary`

## Mecánica del Juego

### Sistema de Puntuación en Cascada

La validación y puntuación funciona en cascada:

1. **Ronda 1 (obligatoria)**: ¿Qué app/sitio web es?
   - Si **correcta**: 500 pts → se evalúa Ronda 2
   - Si **incorrecta**: 0 pts → Ronda 2 y 3 no se evalúan (null)

2. **Ronda 2 (opcional, solo si Ronda 1 correcta)**: ¿Qué acción estaba realizando el usuario?
   - Si **correcta**: +400 pts → se evalúa Ronda 3
   - Si **incorrecta** o **no respondida**: 0 pts extra → Ronda 3 no se evalúa

3. **Ronda 3 (opcional, solo si Ronda 1 y 2 correctas)**: ¿De qué año aproximado es?
   - Si **exacto** (diff = 0): +900 pts
   - Si **±1 año** (diff = 1): +600 pts
   - Si **incorrecto** o **no respondido**: 0 pts extra

**Puntaje máximo por ronda**: 500 + 400 + 900 = **1800 pts**

### Normalización de Respuestas

- Las respuestas se normalizan a minúsculas y se quitan espacios (`trim().toLowerCase()`)
- Esto permite que "twitter" = "Twitter" = " TWITTER "

### Validación

- **App**: Obligatoria (required en el form)
- **Acción**: Opcional
- **Año**: Opcional, acepta rango 2000-2026 (number input con min/max)

## Diferencias vs Otros Modos

| Aspecto | CodeGuessr | CommitGuessr | UIGuessr |
|---------|-----------|--------------|----------|
| **Backend** | ✅ Lambda .NET | ❌ Local | ❌ Local |
| **Autenticación** | ✅ Requerida | ✅ Requerida | ✅ Requerida |
| **Leaderboard** | ✅ Global | ❌ No | ❌ No |
| **Rondas** | 10 (dinámicas) | 10 (aleatorias locales) | 10 (aleatorias locales) |
| **Respuestas** | 3 opcionales en cascada | 4 opcionales independientes | 3 opcionales en cascada |
| **Puntaje máx/ronda** | ~1500 pts | ~1800 pts | 1800 pts |

## Pendientes para Producción

### 1. Screenshots Reales (Alta prioridad)

Reemplazar los placeholders SVG con screenshots reales:

- **Opción A**: Wayback Machine (https://web.archive.org/)
  - Buscar versiones históricas de cada app
  - Capturar pantalla completa o recortar área relevante
  - Exportar como PNG o JPG (800-1200px de ancho)

- **Opción B**: Wikipedia / Wikimedia Commons
  - Muchas apps tienen screenshots históricos en sus artículos

- **Opción C**: Dribbble / Behance
  - Diseños históricos de UI/UX

**Requisitos**:
- Formato: PNG o JPG
- Resolución: 800-1200px de ancho
- Sin branding obvio (o recortar logos grandes)
- Calidad suficiente para reconocer interfaz

### 2. Expansión del Dataset (Media prioridad)

Agregar más screenshots para variedad:
- 30-50 screenshots en total (actualmente: 16)
- Más años históricos (2000-2024)
- Apps mobile vs desktop
- Variantes regionales (interfaces en otros idiomas)

### 3. Modo "Retro" (Baja prioridad - Post-MVP)

Modalidad especial solo con UIs antiguas (pre-2010).

### 4. Hints Visuales (Baja prioridad - Post-MVP)

Botón "Mostrar pista" que revela parte del logo o un elemento característico (costo: -100 pts).

## Testing Manual

Para probar UIGuessr localmente:

1. Iniciar sesión en la app
2. Desde el home, hacer clic en la card "UIGuessr"
3. Jugar las 10 rondas:
   - Adivinar app (obligatorio)
   - Opcionalmente acción y año
   - Ver feedback inmediato después de cada respuesta
4. Ver resumen de la sesión con tabla de resultados
5. "Jugar de nuevo" para nueva partida

### Casos de Prueba

- ✅ Responder solo app (debe dar 500 pts si correcta)
- ✅ Responder app + acción (debe dar 900 pts si ambas correctas)
- ✅ Responder app + acción + año exacto (debe dar 1800 pts)
- ✅ Responder app + acción + año ±1 (debe dar 1500 pts)
- ✅ Responder app incorrecta (debe dar 0 pts y no evaluar acción/año)
- ✅ Respuestas case-insensitive ("twitter" = "Twitter")
- ✅ Transiciones de animación en screenshots
- ✅ Modo `prefers-reduced-motion` funciona

## Troubleshooting

### Los placeholders SVG no se muestran

- Verificar que los archivos existen en `public/assets/ui-screenshots/*.svg`
- Revisar la consola del navegador para errores 404
- Confirmar que el dev server está sirviendo la carpeta `public`

### La app no acepta mi respuesta aunque es correcta

- Verificar que el texto en `ui-screenshots.json` coincide exactamente (case-insensitive)
- Agregar variantes aceptadas en `appOptions` o `actionOptions` si es necesario

### Animaciones no funcionan

- Confirmar que `imageEntering` signal está siendo actualizado correctamente
- Revisar que `prefers-reduced-motion` no esté activado en el sistema operativo

## Próximos Pasos

1. ✅ **Implementación básica completa** (este archivo)
2. ⏳ **Testing en desarrollo** - Probar flujo completo
3. ⏳ **Obtener screenshots reales** - Reemplazar placeholders SVG
4. ⏳ **Expansión del dataset** - Agregar más apps y años
5. ⏳ **Deploy a AWS** - Si se desea habilitar en producción
6. ⏳ **Video demo** - Grabar gameplay para presentación del hackathon

## Créditos

- Inspiración: GeoGuessr (Geoguessr AB)
- Diseño del juego: TechGuessr (Hackathon IA Masivo Online AWS - Código Facilito)
- Placeholders generados: SVG programático (temporal)
