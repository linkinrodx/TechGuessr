# TechGuessr

Juego de adivinanza técnica inspirado en [GeoGuessr](https://www.geoguessr.com): en cada ronda se muestra un fragmento de código anonimizado y hay que adivinar el lenguaje, el framework/librería y el proyecto de origen. Suma puntos por precisión y velocidad.

Proyecto desarrollado para el **Hackathon IA Masivo Online AWS por Código Facilito (Kiro + AWS)**.

**🎮 Jugar ahora:** https://d1mdus2p5exf7z.cloudfront.net/

## Modalidad incluida en el MVP: CodeGuessr

Cada partida es una serie **Clásica de 10 rondas**. En cada ronda ves un snippet de código real (sin nombre de archivo, autor ni URL) y respondes en cascada:

1. **Lenguaje** (ej. TypeScript, Python, Go...)
2. **Framework/librería**, solo si acertaste el lenguaje (ej. Angular, Django, Spring...)
3. **Proyecto de origen**, solo si acertaste el framework

El puntaje se calcula 100% en el servidor (nunca confía en lo que envía el cliente), combinando precisión y velocidad de respuesta.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (standalone components, signals), TypeScript, SCSS |
| Autenticación | AWS Cognito (User Pool, flujo SRP vía `amazon-cognito-identity-js`) |
| API | AWS API Gateway (HTTP API) + JWT Authorizer |
| Backend | AWS Lambda, **.NET 10 (C#)** |
| Base de datos | AWS DynamoDB |
| Hosting | AWS S3 + CloudFront |
| Infraestructura como código | AWS CDK (TypeScript) |
| Testing | Vitest (frontend), xUnit + FsCheck — property-based testing (backend) |

Documentación completa de arquitectura, decisiones técnicas y desviaciones respecto al diseño original: [`docs/arquitectura.md`](docs/arquitectura.md) y [`.kiro/specs/codeguessr-mvp/`](.kiro/specs/codeguessr-mvp/) (requirements, design, tasks).

## Rol de Kiro en este proyecto

Kiro se usó como asistente de desarrollo durante todo el proceso: generación de la spec (requirements/design/tasks) a partir de un diseño técnico conversado, implementación de infraestructura CDK y lógica de backend en .NET, curaduría del dataset de snippets, y redacción de las explicaciones educativas que se muestran al jugador después de cada ronda. El juego **no depende de Kiro en runtime** — funciona de punta a punta sin ninguna llamada a un modelo de IA durante la partida.

## Estructura del repositorio

```
TechGuessr/
  .kiro/
    steering/          # contexto de proyecto para Kiro (producto, stack, convenciones)
    specs/
      codeguessr-mvp/   # requirements.md, design.md, tasks.md del MVP
  docs/
    arquitectura.md      # documento de referencia de arquitectura y estado del proyecto
    iam-policy.json       # policy de IAM acotada usada para el despliegue
  src/
    app/
      core/               # AuthService, GameService, interceptor HTTP
      features/
        auth/               # Login, Register
        codeguessr/           # pantalla de juego, resumen, leaderboard
      shared/types/         # contrato de API compartido
      data/
        snippets.json         # dataset curado (16 snippets)
  infra/
    lib/                  # stacks de AWS CDK (datos, auth, API, frontend)
    lambda-dotnet/
      GameFunction/          # código de la Lambda (.NET 10)
      GameFunction.Tests/     # tests unitarios + property-based testing (xUnit/FsCheck)
    tools/
      SeedSnippets/           # script .NET de carga del dataset a DynamoDB
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

Cargar el dataset de snippets contra la tabla desplegada:

```bash
cd infra/tools/SeedSnippets
$env:AWS_PROFILE = "techguessr"
dotnet run
```

Desplegar el frontend a S3/CloudFront:

```bash
npm run build -- --configuration production
aws s3 sync dist/TechGuessr/browser s3://<nombre-del-bucket> --delete --profile techguessr
aws cloudfront create-invalidation --distribution-id <id-distribucion> --paths "/*" --profile techguessr
```

## Alcance y roadmap

El MVP entregado es intencionalmente acotado (single-player, una sola modalidad, tabla de mejores puntajes simple) para garantizar que funcione de punta a punta dentro de la ventana del hackathon. Roadmap post-hackathon: más modalidades (StackGuessr, CommitGuessr, UIGuessr, TerminalGuessr, AIGuessr), multiplayer en tiempo real, sistema de ELO, y generación dinámica de contenido con Kiro en runtime. Detalle completo en [`.kiro/steering/product.md`](.kiro/steering/product.md).
