# TechGuessr — Producto

## Qué es

TechGuessr es un juego de adivinanza técnica inspirado en GeoGuessr. Cada ronda presenta un desafío (snippet de código, error, diff, UI, comando de terminal) y el jugador debe adivinar algo específico sobre él. Suma puntos por precisión y velocidad.

Proyecto desarrollado para el **Hackathon IA Masivo Online AWS por Código Facilito (Kiro + AWS)**. Repositorio de código: `linkinrodx/TechGuessr` (independiente del repo `linkinrodx/Hackathon-Kiro`, que solo contiene documentación del hackathon).

## Alcance del MVP (fecha límite: 27 de julio de 2026)

Estas restricciones son intencionales, no un descuido. Al proponer features o cambios, respetarlas salvo que el usuario indique explícitamente que se está trabajando en roadmap post-hackathon:

- **Single-player únicamente.** Sin multiplayer, sin salas, sin sincronización en tiempo real.
- **Una sola modalidad de juego:** CodeGuessr (adivinar lenguaje, framework, proyecto a partir de un snippet).
- **Un solo modo de partida:** Clásico (10 rondas).
- **Cuentas de usuario** vía AWS Cognito (registro/login).
- **Tabla de mejores puntajes simple** (orden por puntaje más alto). No es un sistema de ELO real.
- **Dataset curado a mano** (o con ayuda de Kiro), sin scraping en vivo de GitHub API.

## Roadmap post-MVP (no implementar salvo pedido explícito)

- Modalidades adicionales: StackGuessr, CommitGuessr, UIGuessr, TerminalGuessr, AIGuessr.
- Multiplayer en tiempo real (salas, turnos, WebSockets).
- Sistema de ELO real basado en resultados PvP.
- Modos cross-plataforma: Contrarreloj, Vs Amigos, Ranking Global, Maratón, Desafío del Día.
- Generación dinámica de preguntas con Kiro en runtime para evitar repetición.

El detalle completo de todas las modalidades (diseño de juego, puntuación, generación de datos) vive en `docs/propuestas-ideas.md` del repo `Hackathon-Kiro` (repo hermano de documentación).

## Rol de Kiro en el producto

Kiro es un **potenciador, no una dependencia**. El juego debe funcionar completamente sin llamadas a Kiro en runtime. Usos previstos:

- Generación/curaduría offline del dataset de snippets para CodeGuessr.
- Explicaciones post-ronda (por qué la respuesta correcta es la que es).
- Asistencia de desarrollo (specs, código, infraestructura) durante el hackathon.

## Restricciones de contexto del hackathon

- Equipo: 1 persona (trabajando solo).
- Ventana de tiempo: días, no semanas. Priorizar siempre "funciona de principio a fin" sobre "cobertura de features".
- Criterios de evaluación pesan: Impacto tecnológico 30%, Innovación 30%, Software funcional y entregables 30%, Uso de AWS y Kiro 10%.
- Entregables obligatorios: repo público con README, demo en línea, video de presentación (máx. 5 min).
