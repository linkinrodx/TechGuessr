# TechGuessr — Stack Técnico

Referencia rápida para decisiones de código e infraestructura. Detalle completo y justificación de cada elección en `docs/arquitectura.md`.

## Frontend

- **Angular v22** (última estable). Standalone components, sin NgModules.
- **TypeScript**, modo estricto (`strict: true`, viene por defecto del scaffold).
- **Signals** para estado reactivo simple (rondas, puntaje). Evitar RxJS salvo que el caso lo requiera genuinamente (streams async, eventos complejos).
- **SCSS** para estilos.
- Convención de nombres de archivo **"2025"** (`app.ts`, no `app.component.ts`) — es el default del scaffold, mantenerla.
- Test runner: **Vitest** (default del CLI, no Karma).
- Runtime requerido: Node.js ≥ v22.22.3 (en uso: v26.0.0).

## Backend e infraestructura AWS

- **Hosting frontend:** S3 (build estático) + CloudFront (HTTPS/CDN).
- **API:** API Gateway (HTTP API) + Lambda.
- **Lambda ("game function"):** **.NET 10** (C#), runtime administrado `Runtime.DOTNET_10`. Decisión tomada explícitamente por experiencia previa del usuario en .NET, priorizando velocidad de desarrollo confiable sobre el hecho de que el resto del repo esté en TypeScript. Empaquetado vía **local bundling** con `dotnet publish` (sin Docker, ver `infra/lib/api-stack.ts`).
- **Base de datos:** DynamoDB. No usar RDS — evita complejidad de VPC/subnets innecesaria para el MVP.
- **Autenticación:** Cognito (User Pool), JWT validado en API Gateway.
- **Infraestructura como código:** AWS CDK en TypeScript (el CDK en sí sigue en TypeScript; solo el código de la Lambda cambia a .NET). Nombrar recursos con prefijo `techguessr-` (la policy de IAM en `docs/iam-policy.json` está acotada a ese prefijo).

## Comandos habituales

```
npm start          # ng serve, dev server en localhost:4200
npm run build       # build de producción
npm test            # vitest
```

En Windows, la ExecutionPolicy de PowerShell puede bloquear `npm.ps1`. Si un comando `npm`/`npx` falla con `PSSecurityException`, ejecutarlo vía `cmd /c npm ...` en lugar de tocar la política de ejecución del sistema.

## Qué NO usar

- React, Vue u otro framework — se eligió Angular por experiencia previa del usuario.
- RDS/relacional — DynamoDB cubre el MVP sin la complejidad de red de RDS.
- AWS Amplify Hosting — se optó por S3 + CloudFront explícito en vez de Amplify.
- TypeScript/Node.js para el código de la Lambda — se migró a .NET 10 por experiencia previa del usuario (decisión tomada tras completar la infraestructura inicial; ver `docs/arquitectura.md`).
- Dependencias con rango de versión abierto (`^`/`~` amplio) para infraestructura crítica — preferir versiones fijas cuando se generen archivos de CDK/Lambda.
