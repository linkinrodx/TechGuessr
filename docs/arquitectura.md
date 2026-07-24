# TechGuessr — Stack, Arquitectura y Alcance

> Documento vivo. Refleja las decisiones tomadas hasta ahora durante la planeación del Hackathon IA Masivo Online AWS por Código Facilito (Kiro + AWS). Se actualiza a medida que el proyecto avanza.

## 1. Resumen del proyecto

TechGuessr es un juego de adivinanza técnica inspirado en GeoGuessr: cada ronda presenta un desafío (snippet de código, error, diff, UI, comando de terminal) y el jugador debe adivinar algo específico sobre él. Suma puntos por precisión y velocidad.

El detalle completo de las modalidades de juego (CodeGuessr, StackGuessr, CommitGuessr, UIGuessr, TerminalGuessr, AIGuessr) está documentado en `Hackathon-Kiro/docs/propuestas-ideas.md`. Este documento se enfoca en **cómo se construye**, no en el diseño de juego.

## 2. Repositorios

El proyecto vive en **dos repositorios separados**, sin relación de submódulo entre ellos:

| Repositorio | Contenido | Rol |
|---|---|---|
| `linkinrodx/Hackathon-Kiro` | Documentación del hackathon (reglamento, criterios, propuestas, tablero) | Gestión y planeación, no se entrega como producto |
| `linkinrodx/TechGuessr` | Todo el código del producto (frontend, infraestructura, docs técnicos) | Repositorio público que se entrega como "software funcional" ante el jurado |

`Hackathon-Kiro/.gitignore` excluye la carpeta `/TechGuessr/` para que Git no intente versionar el repo anidado como archivos sueltos. `TechGuessr/` ya tiene su propio `git init` y remoto (`origin` → `https://github.com/linkinrodx/TechGuessr.git`).

## 3. Stack tecnológico

### Frontend

| Elemento | Elección | Motivo |
|---|---|---|
| Framework | **Angular v22** (última estable, junio 2026) | Experiencia previa del equipo en Angular; v22 estabiliza Signal Forms, Resource API y Angular Aria |
| Lenguaje | TypeScript | Estándar de Angular |
| Estilos | SCSS | Elegido en el scaffold inicial (`ng new --style=scss`) |
| Runtime requerido | Node.js ≥ v22.22.3 (en uso: v26.0.0) | Angular CLI v22 no soporta versiones de Node más antiguas |
| Arquitectura de componentes | Standalone components + signals | Angular moderno ya no requiere NgModules; signals reduce boilerplate de RxJS para estado simple de juego |

### Backend e infraestructura AWS

| Pieza | Servicio AWS | Rol |
|---|---|---|
| Hosting frontend | **S3 + CloudFront** | S3 sirve el build estático de Angular; CloudFront da HTTPS (necesario para Cognito) y CDN |
| API | **API Gateway (HTTP API) + Lambda** | Lógica de juego: obtener ronda, validar respuesta, registrar puntaje |
| Base de datos | **DynamoDB** | Usuarios, catálogo de preguntas/snippets, puntajes. Sin servidor que administrar, encaja con Lambda |
| Autenticación | **Cognito (User Pool)** | Registro/login de usuarios; emite JWT que valida API Gateway |
| Infraestructura como código | **AWS CDK (TypeScript)** | Define todos los recursos anteriores de forma reproducible y versionada |

Justificación de DynamoDB sobre RDS: los criterios de evaluación piden "al menos un servicio" de AWS y no exigen RDS específicamente; DynamoDB evita la complejidad de VPC/subnets y es más rápido de tener funcionando dentro de la ventana del hackathon.

### Herramientas de desarrollo

- **Kiro**: apoyo en generación de código durante el desarrollo, curaduría/generación del dataset de preguntas, y explicaciones post-ronda dentro del propio juego (rol de potenciador, no de dependencia — el juego funciona sin llamadas a Kiro en runtime).
- **AWS CLI**: gestión/despliegue manual y verificación de recursos.

## 4. Arquitectura

```
                        ┌─────────────────────────┐
                        │        Usuario          │
                        └────────────┬────────────┘
                                     │ HTTPS
                                     ▼
                        ┌─────────────────────────┐
                        │   CloudFront (CDN)      │
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │  S3 (build Angular)     │  ← frontend estático
                        └─────────────────────────┘

                        ┌─────────────────────────┐
                        │   Angular App (SPA)     │
                        └────────────┬────────────┘
                                     │ fetch/HTTP + JWT
                                     ▼
                        ┌─────────────────────────┐
                        │  API Gateway (HTTP API) │
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Lambda (lógica juego) │
                        └──────┬──────────┬───────┘
                               │          │
                               ▼          ▼
                    ┌──────────────┐  ┌──────────────┐
                    │  DynamoDB    │  │   Cognito    │
                    │ (datos juego)│  │ (usuarios)   │
                    └──────────────┘  └──────────────┘
```

**Flujo típico de una partida:**

1. El usuario inicia sesión (Cognito) desde la SPA de Angular servida vía CloudFront/S3.
2. La SPA pide una ronda a la API (`GET /rounds/next`) incluyendo el JWT de Cognito.
3. Lambda consulta DynamoDB, devuelve un snippet/pregunta sin la respuesta.
4. El usuario responde; la SPA envía la respuesta a la API (`POST /rounds/{id}/answer`).
5. Lambda valida contra DynamoDB, calcula puntaje, guarda el resultado y responde con el desglose de puntos.
6. Al final de la partida, la SPA muestra el resumen y el puntaje se refleja en la tabla de mejores puntajes (semilla del futuro ranking/ELO).

## 5. Alcance

### MVP (fecha límite: 27 de julio de 2026)

- **Single-player únicamente.** Sin multiplayer, sin salas, sin sincronización en tiempo real.
- **Una sola modalidad de juego**: CodeGuessr.
- **Un solo modo de partida**: Clásico (10 rondas).
- **Cuentas de usuario** vía Cognito (registro/login).
- **Tabla de mejores puntajes simple** (orden por puntaje más alto), como semilla de un futuro sistema de ranking — no es ELO real.
- **Dataset curado** de snippets (JSON/DynamoDB poblado a mano o con ayuda de Kiro), sin scraping en vivo de GitHub API para reducir riesgo.

### Roadmap post-hackathon (fuera del MVP, mencionado en el pitch como visión de producto)

- Modalidades adicionales: StackGuessr, CommitGuessr, UIGuessr, TerminalGuessr, AIGuessr.
- Multiplayer en tiempo real (salas, turnos, WebSockets vía API Gateway WebSocket API).
- Sistema de ELO real basado en resultados PvP.
- Modos cross-plataforma: Contrarreloj, Vs Amigos, Ranking Global, Maratón, Desafío del Día.
- Generación dinámica de preguntas con Kiro para evitar repetición.

**Razón del recorte**: con 1 persona trabajando y ~4 días disponibles al momento de esta decisión, multiplayer + ELO + varias modalidades no es alcanzable sin arriesgar que el MVP no funcione el día de la demo. El diseño de arquitectura (Lambda + DynamoDB + Cognito vía CDK) se pensó para que estas features de roadmap se puedan añadir después sin reescritura, no para excluirlas permanentemente.

## 6. Seguridad e IAM

El despliegue se hace con un usuario IAM dedicado al proyecto (no la cuenta root), con una policy acotada a los servicios y prefijos de nombre de este proyecto (`techguessr-*`, `cdk-*`) en lugar de una policy administrada amplia como `PowerUserAccess`. El JSON de la policy vive en `TechGuessr/docs/iam-policy.json`.

Limitación conocida y aceptada: `s3:*`, `apigateway:*`, `cognito-idp:*` y `cloudfront:*` no están acotados por ARN de recurso, porque esos servicios no permiten restringir por nombre de recurso antes de que el recurso exista (problema recurrente en el primer despliegue de CDK). Es un compromiso razonable para una cuenta personal de hackathon, no una política de mínimo privilegio purista para un entorno productivo compartido.

## 7. Estado actual

**MVP de CodeGuessr completo y desplegado en AWS** (todas las tareas de `.kiro/specs/codeguessr-mvp/tasks.md` están marcadas como hechas).

- [x] Repos separados creados y enlazados (`Hackathon-Kiro` con `.gitignore`, `TechGuessr` con remoto propio).
- [x] Node.js actualizado a v26.0.0, Angular CLI v22 funcionando.
- [x] Policy de IAM acotada redactada y usuario IAM (`techguessr-deployer`) creado y configurado (`aws configure --profile techguessr`).
- [x] Scaffold del proyecto Angular (Angular v22.0.8, standalone components, SCSS, routing).
- [x] AWS CDK con las 4 stacks desplegadas: datos, auth, API, frontend.
- [x] Lambda "game function" migrada a .NET 10 (C#), con lógica de puntaje y transición de sesión cubierta por property-based testing (FsCheck).
- [x] Dataset inicial de 16 snippets curado y cargado en DynamoDB.
- [x] Frontend Angular (Login, Register, CodeGuessr, Summary, Leaderboard) conectado a la API real, con autenticación Cognito (SRP) y build de producción desplegado.

### Recursos desplegados (cuenta AWS `515788229331`, región `us-east-1`)

| Recurso | Valor |
|---|---|
| Frontend (CloudFront) | `https://d1mdus2p5exf7z.cloudfront.net/` |
| API (API Gateway) | `https://3udd20jj35.execute-api.us-east-1.amazonaws.com` |
| Cognito User Pool ID | `us-east-1_kiKUt9MtG` |
| Cognito User Pool Client ID | `238nac8dfu8mcni4hore1s75c7` |
| Bucket S3 (frontend) | `techguessr-frontend-stack-sitebucket397a1860-qzhpjvi7ltra` |
| CloudFront Distribution ID | `E139XV2WCPFCQC` |

### Pendientes conocidos / deuda técnica (no bloqueante para el MVP)

- Tests unitarios de `AuthService` no escritos (requiere refactor para inyectar `CognitoUserPool` en vez de crearlo en el constructor).
- Dataset de 16 snippets es funcional pero pequeño; ampliarlo (tarea 2.1 original sugería 15-20, ya cumplido en el mínimo) mejoraría la variedad de la demo.
- No hay dominio propio ni certificado personalizado — se usa el dominio por defecto de CloudFront.
- Dos flujos manuales quedan fuera del pipeline automatizado: build+deploy del frontend (`npm run build -- --configuration production` + `aws s3 sync` + `aws cloudfront create-invalidation`) y build+deploy de infraestructura (`npm run build` en `infra/` + `cdk deploy --all`). No hay CI/CD configurado.
