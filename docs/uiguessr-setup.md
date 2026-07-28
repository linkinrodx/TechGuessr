# Configuración de UIGuessr

## Descripción

UIGuessr es un modo de juego donde el jugador ve un screenshot de una interfaz de usuario (sin branding obvio) y debe adivinar:
1. ¿Qué app/sitio web es?
2. ¿Qué acción estaba realizando el usuario?
3. ¿De qué año aproximado es esta UI?

## Estado actual

✅ **Implementado:**
- Servicio de juego local (`UIGameService`) con lógica completa de puntaje
- Componente de juego (`UIguessrGame`) con formulario de adivinanza
- Componente de resumen de sesión (`UISessionSummary`)
- Sistema de tipos en TypeScript
- Dataset de 16 screenshots (metadata en `src/app/data/ui-screenshots.json`)
- Rutas configuradas en `app.routes.ts`
- Botón activo en la página Home

⚠️ **Pendiente:**
- Imágenes reales de UI screenshots (actualmente solo existe la carpeta `public/assets/ui-screenshots/`)

## Cómo agregar las imágenes

### Opción 1: Wayback Machine (recomendado para screenshots históricos reales)

1. Visita https://web.archive.org/
2. Busca el sitio web en el año específico (ej. "twitter.com" en 2010)
3. Toma un screenshot del navegador mostrando la interfaz completa
4. Guarda como PNG en `public/assets/ui-screenshots/`
5. Renombra según el dataset: `twitter-2010.png`, `facebook-2008.png`, etc.

### Opción 2: Buscar imágenes existentes

Busca en Google Imágenes términos como:
- "Twitter 2010 interface screenshot"
- "Facebook 2008 UI design"
- "Gmail 2011 inbox screenshot"

**Importante:** Verifica que las imágenes sean de uso libre o tengas permiso de usarlas.

### Opción 3: Placeholder temporales (para testing)

Si necesitas probar el modo sin las imágenes reales, puedes crear placeholders usando un generador como:
- https://placehold.co/ (ej. `https://placehold.co/800x600/6b46c1/white?text=Twitter+2010`)
- Simplemente descarga imágenes de 800x600px con el nombre de cada app

## Lista de imágenes necesarias

Según `src/app/data/ui-screenshots.json`:

| Archivo | App | Año | Acción | Dificultad |
|---------|-----|-----|--------|------------|
| `twitter-2010.png` | Twitter | 2010 | Timeline principal | easy |
| `facebook-2008.png` | Facebook | 2008 | Perfil de usuario | easy |
| `youtube-2012.png` | YouTube | 2012 | Reproduciendo video | medium |
| `gmail-2011.png` | Gmail | 2011 | Bandeja de entrada | medium |
| `instagram-2013.png` | Instagram | 2013 | Feed de fotos | medium |
| `spotify-2015.png` | Spotify | 2015 | Reproduciendo música | hard |
| `reddit-2009.png` | Reddit | 2009 | Navegando subreddit | hard |
| `netflix-2014.png` | Netflix | 2014 | Catálogo de películas | medium |
| `amazon-2007.png` | Amazon | 2007 | Página de producto | hard |
| `github-2011.png` | GitHub | 2011 | Repositorio de código | medium |
| `linkedin-2010.png` | LinkedIn | 2010 | Perfil profesional | easy |
| `slack-2016.png` | Slack | 2016 | Chat de equipo | medium |
| `airbnb-2012.png` | Airbnb | 2012 | Búsqueda de alojamiento | hard |
| `whatsapp-2015.png` | WhatsApp | 2015 | Lista de chats | easy |
| `dropbox-2013.png` | Dropbox | 2013 | Explorador de archivos | medium |
| `pinterest-2011.png` | Pinterest | 2011 | Tablero de pins | medium |

## Puntuación

El sistema de puntuación sigue una cascada:

1. **App correcta:** +500 puntos
2. **Si app correcta, Acción correcta:** +400 puntos adicionales
3. **Si app y acción correctas:**
   - Año exacto: +900 puntos adicionales
   - Año ±1: +600 puntos adicionales

**Puntaje máximo por ronda:** 1,800 puntos (500 + 400 + 900)

## Probar el modo

Una vez que las imágenes estén en su lugar:

1. Iniciar el servidor de desarrollo: `npm start`
2. Navegar a http://localhost:4200
3. Hacer login (requerido)
4. Click en el botón "UIGuessr"
5. ¡Jugar!

## Expandir el dataset

Para agregar más screenshots:

1. Editar `src/app/data/ui-screenshots.json`
2. Agregar un nuevo objeto con la estructura:
   ```json
   {
     "id": "ui-017",
     "imageUrl": "/assets/ui-screenshots/nombre-app-año.png",
     "app": "Nombre App",
     "action": "Acción del usuario",
     "year": 2015,
     "difficulty": "medium",
     "explanation": "Contexto histórico de por qué es reconocible"
   }
   ```
3. Agregar la imagen correspondiente en `public/assets/ui-screenshots/`

## Arquitectura

- **Frontend-only:** UIGuessr no requiere backend. Todo el juego funciona localmente en el navegador.
- **Servicio:** `UIGameService` maneja el estado de la sesión, selección aleatoria de screenshots y validación de respuestas.
- **Componentes:** `UIguessrGame` (pantalla de juego) y `UISessionSummary` (resumen final).
- **Sin integración con DynamoDB/API:** A diferencia de CodeGuessr, este modo no guarda puntajes en el servidor (puede agregarse en el futuro).

## Próximos pasos (opcional, post-MVP)

- [ ] Agregar más screenshots (objetivo: 50+)
- [ ] Integrar con backend para persistir puntajes
- [ ] Leaderboard específico de UIGuessr
- [ ] Modo "Retro" con solo UIs antiguas
- [ ] Hints visuales (mostrar un detalle del screenshot)
