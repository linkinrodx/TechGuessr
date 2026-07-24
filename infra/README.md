# TechGuessr — Infraestructura (AWS CDK)

Infraestructura como código de TechGuessr, definida con AWS CDK en TypeScript. Despliega 4 stacks independientes en la cuenta de AWS del proyecto.

Ver [`../docs/arquitectura.md`](../docs/arquitectura.md) para el diseño completo y las URLs/IDs de los recursos ya desplegados, y [`../.kiro/specs/codeguessr-mvp/design.md`](../.kiro/specs/codeguessr-mvp/design.md) para el contrato de API y modelos de datos.

## Stacks

| Stack | Recursos | Depende de |
|---|---|---|
| `techguessr-data-stack` | DynamoDB: `techguessr-snippets`, `techguessr-sessions`, `techguessr-scores` | — |
| `techguessr-auth-stack` | Cognito User Pool + User Pool Client | — |
| `techguessr-api-stack` | API Gateway (HTTP API), JWT Authorizer, Lambda "game function" (.NET 10) | `data-stack`, `auth-stack` |
| `techguessr-frontend-stack` | Bucket S3 (privado) + distribución CloudFront (OAC) | — |

## Estructura

```
infra/
  bin/app.ts              # punto de entrada de la app CDK, cablea las 4 stacks
  lib/
    data-stack.ts            # DynamoDB
    auth-stack.ts             # Cognito
    api-stack.ts               # API Gateway + Lambda (empaqueta lambda-dotnet/GameFunction vía local bundling)
    frontend-stack.ts            # S3 + CloudFront
  lambda-dotnet/
    GameFunction/              # código de la Lambda (.NET 10, C#)
      Domain/                    # lógica pura: Scoring.cs, SessionTransitions.cs
      Repositories/               # acceso a DynamoDB
      Api/                          # tipos de request/response
      Function.cs                    # entrypoint, enrutamiento por (method, path)
    GameFunction.Tests/          # xUnit + FsCheck (property-based testing)
  tools/
    SeedSnippets/               # programa de consola .NET para cargar el dataset a DynamoDB
```

## Requisitos

- Node.js ≥ 22.22.3 y .NET 10 SDK instalados localmente (el empaquetado de la Lambda usa **local bundling**: ejecuta `dotnet publish` directamente en la máquina que corre `cdk deploy`, sin Docker).
- AWS CLI y credenciales configuradas (ver sección siguiente).

## Configurar credenciales

El despliegue usa un usuario IAM dedicado (`techguessr-deployer`) con una policy acotada por prefijo de recurso (`techguessr-*`, `cdk-*`), no una policy administrada amplia. Ver [`../docs/iam-policy.json`](../docs/iam-policy.json).

```bash
aws configure --profile techguessr
aws configure set region us-east-1 --profile techguessr
```

## Comandos

```bash
npm install
npm run build            # compila el CDK (TypeScript) — necesario antes de synth/deploy
```

```bash
$env:AWS_PROFILE = "techguessr"      # PowerShell
npx cdk bootstrap                     # solo la primera vez por cuenta/región
npx cdk synth                          # genera CloudFormation sin desplegar, valida el bundling de la Lambda
npx cdk deploy --all                    # despliega las 4 stacks
npx cdk deploy techguessr-api-stack      # despliega solo una stack
```

**Importante:** después de editar cualquier archivo `.ts` en `lib/` o `bin/`, correr `npm run build` antes de `cdk deploy`/`synth` — CDK ejecuta el `.js` ya compilado (`bin/app.js`), no el `.ts` directamente. Si no recompilas, el deploy usará código viejo sin avisarte.

## Bootstrap de CDK y permisos de ejecución

`cdk bootstrap` crea un rol de ejecución de CloudFormation (`cdk-hnb659fds-cfn-exec-role-*`) con la policy administrada **AdministratorAccess** por defecto — ese rol es el que efectivamente aplica los cambios de infraestructura, no el usuario IAM acotado. Es el comportamiento estándar de CDK. Para esta cuenta (personal, sin otros usuarios) se aceptó el bootstrap por defecto; si se despliega en una cuenta compartida/productiva, usar `--cloudformation-execution-policies` para acotarlo.

## Cargar el dataset de snippets

```bash
cd tools/SeedSnippets
$env:AWS_PROFILE = "techguessr"
dotnet run
```

Lee `src/app/data/snippets.json` (ruta relativa por defecto, configurable por argumento), valida las reglas del dataset (mínimo de snippets utilizables, `framework: null → project: null`, sin IDs duplicados) y carga a la tabla `techguessr-snippets` vía `BatchWriteItem`. Ver `Program.cs` para los argumentos opcionales (ruta del JSON, nombre de tabla, región).

## Tests

```bash
cd lambda-dotnet/GameFunction.Tests
dotnet test
```

Incluye property-based testing (FsCheck) para las invariantes de puntaje (`Scoring.cs`) y de transición de sesión (`SessionTransitions.cs`) — ver `.kiro/specs/codeguessr-mvp/design.md`, sección "Correctness Properties".

## Desplegar el frontend (después de `cdk deploy`)

El `frontend-stack` crea el bucket S3 y CloudFront, pero no sube el build de Angular automáticamente. Ver [`../README.md`](../README.md), sección "Desplegar la infraestructura", para los comandos de `aws s3 sync` + `aws cloudfront create-invalidation`.
