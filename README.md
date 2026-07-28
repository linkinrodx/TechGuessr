# TechGuessr

Juego de adivinanza técnica inspirado en [GeoGuessr](https://www.geoguessr.com): en cada ronda se muestra un fragmento de contenido técnico (código, diff, screenshot de UI o texto) sin sus metadatos identificatorios, y hay que adivinar información específica sobre él. Suma puntos por precisión y, en algunos modos, por velocidad.

Proyecto desarrollado para el **Hackathon IA Masivo Online AWS por Código Facilito (Kiro + AWS)**.

**🎮 Jugar ahora:** https://d1mdus2p5exf7z.cloudfront.net/

## Modos de juego

| Modo | Mecánica | Backend |
|---|---|---|
| **CodeGuessr** | Snippet de código real (sin nombre de archivo, autor ni URL). Respondes en cascada: lenguaje → framework/librería (solo si aciertas lenguaje) → proyecto de origen (solo si aciertas framework). Puntaje combina precisión y velocidad de respuesta. | Lambda .NET + DynamoDB, con leaderboard global |
| **CommitGuessr** | Diff anonimizado de un commit real. Adivinas el tipo de cambio (obligatorio), el mensaje de commit correcto, el esfuerzo estimado (±20%) y el número de archivos modificados (los tres últimos opcionales, evaluados de forma independiente). | Lambda .NET + DynamoDB, con leaderboard global |
| **UIGuessr** | Screenshot histórico de una app o sitio web sin branding visible. Adivinas la app (obligatorio), la acción que se estaba realizando y el año aproximado (opcionales, evaluados en cascada). | Lambda .NET + DynamoDB, con leaderboard global |
| **AIGuessr** | Dos submodos: **Human or AI** (¿este texto lo escribió una persona o un modelo?) y **Hallucination Hunter** (detecta qué afirmaciones de una lista son falsas/alucinadas). | Local en el cliente (dataset curado embebido, sin llamadas al backend) |

Cada partida es una serie de **10 rondas**. El puntaje de los modos con backend se calcula 100% en el servidor (nunca confía en lo que envía el cliente).

**Próximamente:** StackGuessr (diagnóstico de stack traces) y TerminalGuessr (adivinar comando/SO a partir de output de terminal) — visibles en el home como "Próximamente", aún no implementados.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (standalone components, signals), TypeScript, SCSS, Tailwind (utilidades puntuales) |
| Autenticación | AWS Cognito (User Pool, flujo SRP vía `amazon-cognito-identity-js`) |
| API | AWS API Gateway (HTTP API) + JWT Authorizer |
| Backend | AWS Lambda, **.NET 10 (C#)** — una sola "game function" que enruta los handlers de los 3 modos con backend |
| Base de datos | AWS DynamoDB (6 tablas: snippets, commits, ui-screenshots + sus sesiones, y scores compartida) |
| Hosting | AWS S3 + CloudFront |
| Infraestructura como código | AWS CDK (TypeScript) — 4 stacks: datos, auth, API, frontend |
| Testing | Vitest (frontend), xUnit + FsCheck — property-based testing (backend) |

Documentación completa de arquitectura, decisiones técnicas y estado del proyecto: [`docs/arquitectura.md`](docs/arquitectura.md). Comparativa detallada entre modos de juego: [`docs/codeguessr-vs-commitguessr.md`](docs/codeguessr-vs-commitguessr.md), [`docs/aiguessr-implementation.md`](docs/aiguessr-implementation.md), [`docs/uiguessr-setup.md`](docs/uiguessr-setup.md).

## Rol de Kiro en este proyecto

Kiro se usó como asistente de desarrollo durante todo el proceso: generación de specs (requirements/design/tasks) a partir de diseños técnicos conversados, implementación de infraestructura CDK y lógica de backend en .NET, curaduría de los datasets de cada modo, y redacción de las explicaciones educativas que se muestran al jugador después de cada ronda. El juego **no depende de Kiro en runtime** — funciona de punta a punta sin ninguna llamada a un modelo de IA durante la partida.

Specs de Kiro versionadas en el repo: [`.kiro/specs/codeguessr-mvp/`](.kiro/specs/codeguessr-mvp/) (requirements, design, tasks del MVP original) y [`.kiro/specs/ui-ux-revamp/`](.kiro/specs/ui-ux-revamp/). Contexto de proyecto para Kiro (producto, stack, convenciones): [`.kiro/steering/`](.kiro/steering/).

## Estructura del repositorio

```
TechGuessr/
  .kiro/
    steering/          # contexto de proyecto para Kiro (producto, stack, convenciones)
    specs/
      codeguessr-mvp/    # requirements.md, design.md, tasks.md del MVP
      ui-ux-revamp/       # spec de la iteración de UI/UX
  docs/
    arquitectura.md               # documento de referencia de arquitectura y estado del proyecto
    aiguessr-implementation.md    # diseño y estado de AIGuessr
    codeguessr-vs-commitguessr.md # comparativa técnica entre modos
    uiguessr-setup.md             # setup de UIGuessr
    iam-policy.json               # policy de IAM acotada usada para el despliegue
  src/
    app/
      core/               # AuthService, GameService, {Commit,UI,AI}GameService, interceptor HTTP
      features/
        auth/               # Login, Register
        codeguessr/           # pantalla de juego, resumen, leaderboard
        commitguessr/         # pantalla de juego (diffs)
        uiguessr/             # pantalla de juego (screenshots)
        aiguessr/             # Human or AI + Hallucination Hunter
        leaderboards/         # rankings globales
      shared/types/         # contrato de API compartido
      data/
        snippets.json         # dataset curado de CodeGuessr (22 snippets)
        commits.json           # dataset curado de CommitGuessr (10 diffs)
        ui-screenshots.json     # dataset curado de UIGuessr (16 screenshots)
        ai-content.json          # dataset curado de AIGuessr (Human/AI + Hallucination Hunter)
  infra/
    lib/                  # stacks de AWS CDK (datos, auth, API, frontend)
    lambda-dotnet/
      GameFunction/          # código de la Lambda (.NET 10)
      GameFunction.Tests/     # tests unitarios + property-based testing (xUnit/FsCheck)
    tools/
      SeedSnippets/           # script .NET de carga del dataset de CodeGuessr a DynamoDB
    scripts/
      migrate-commits.ts        # migración del dataset de CommitGuessr a DynamoDB
      migrate-ui-screenshots.ts  # migración del dataset de UIGuessr a DynamoDB
```

## Correr el proyecto localmente

Requisitos: Node.js ≥ 22.22.3, .NET 10 SDK, AWS CLI, AWS CDK CLI.

```bash
npm install
npm start          # dev server en http://localhost:4200
```

El frontend local ya apunta a la API y al User Pool de Cognito reales (ver `src/environments/environment.ts`), así que puedes registrarte y jugar sin desplegar nada.

### Tests

```bash
npm test                                             # frontend (Vitest)
cd infra/lambda-dotnet/GameFunction.Tests && dotnet test   # backend (xUnit + FsCheck)
```

## Desplegar la infraestructura

```bash
cd infra
npm install
npm run build
aws configure --profile techguessr   # credenciales del usuario IAM (ver docs/iam-policy.json)
$env:AWS_PROFILE = "techguessr"
npx cdk bootstrap    # solo la primera vez
npx cdk deploy --all
```

Cargar los datasets contra las tablas desplegadas:

```bash
# CodeGuessr
cd infra/tools/SeedSnippets
$env:AWS_PROFILE = "techguessr"
dotnet run

# CommitGuessr y UIGuessr
cd ../../
npx ts-node scripts/migrate-commits.ts
npx ts-node scripts/migrate-ui-screenshots.ts
```

Desplegar el frontend a S3/CloudFront:

```bash
npm run build -- --configuration production
aws s3 sync dist/TechGuessr/browser s3://<nombre-del-bucket> --delete --profile techguessr
aws cloudfront create-invalidation --distribution-id <id-distribucion> --paths "/*" --profile techguessr
```

## Alcance y roadmap

Cuatro modos de juego están implementados y jugables (CodeGuessr, CommitGuessr, UIGuessr, AIGuessr); los tres primeros con backend en AWS y leaderboard global, AIGuessr con lógica local en el cliente. Roadmap post-hackathon: StackGuessr y TerminalGuessr, backend para AIGuessr con leaderboard propio, multiplayer en tiempo real, sistema de ELO, y generación dinámica de contenido con Kiro en runtime. Detalle completo en [`.kiro/steering/product.md`](.kiro/steering/product.md) y [`docs/arquitectura.md`](docs/arquitectura.md).
