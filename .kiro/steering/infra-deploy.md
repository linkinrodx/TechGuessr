# TechGuessr — Despliegue de Infraestructura (CDK)

Reglas operativas para ejecutar comandos de AWS CDK y AWS CLI sobre este proyecto. Ver `.kiro/steering/tech-stack.md` para el resto del stack.

## ⚠️ Regla crítica: recompilar TypeScript antes de `cdk synth` / `cdk deploy`

`infra/cdk.json` define `"app": "node bin/app.js"` — CDK ejecuta el **JavaScript ya compilado** en `infra/bin/` e `infra/lib/`, **no** los archivos `.ts` directamente. Si se edita cualquier `.ts` bajo `infra/lib/` o `infra/bin/` (por ejemplo `api-stack.ts`, `data-stack.ts`) y no se recompila, `cdk synth`/`cdk deploy` sigue usando el `.js` viejo sin los cambios — sin ningún error visible que lo delate.

Este desajuste ya causó un incidente real: se agregaron rutas nuevas a `api-stack.ts` (CommitGuessr) pero el `.js` compilado no se actualizó, por lo que el despliegue nunca las incluyó y el frontend recibía 404 sin CORS (reportado como `Http failure response ... 0 undefined`).

**Por lo tanto, SIEMPRE ejecutar antes de cualquier `synth`/`deploy`:**

```bash
cd infra
npm run build   # tsc — recompila lib/*.ts y bin/*.ts a .js
```

Solo después de eso correr `cdk synth` o `cdk deploy`. No asumir que un `cdk deploy` reciente ya recogió los últimos cambios de `.ts` sin haber corrido `npm run build` en esa misma sesión.

## Perfil de AWS a usar

Este proyecto tiene un perfil de AWS CLI configurado localmente con nombre **`techguessr`** (usuario IAM `techguessr-deployer`, cuenta `515788229331`, acotado por la policy en `docs/iam-policy.json`). Usar este perfil en **todos** los comandos de AWS CLI y CDK sobre este repo, vía `--profile techguessr` o la variable de entorno `AWS_PROFILE=techguessr`.

No asumir credenciales por defecto (`aws sts get-caller-identity` sin `--profile` puede fallar con "Unable to locate credentials" aunque el perfil `techguessr` sí exista y funcione).

## Comandos habituales

```bash
cd infra

# Recompilar SIEMPRE antes de synth/deploy
npm run build

# Ver el CloudFormation generado sin desplegar (útil para verificar cambios)
npx cdk synth techguessr-api-stack --profile techguessr

# Desplegar un stack específico (orden de dependencias: data-stack y
# auth-stack primero si son nuevos, luego api-stack, ver bin/app.ts)
npx cdk deploy techguessr-data-stack --profile techguessr
npx cdk deploy techguessr-api-stack --profile techguessr

# Diff antes de desplegar a producción (recomendado para cambios de infra)
npx cdk diff techguessr-api-stack --profile techguessr
```

En Windows, si `npm`/`npx`/`cdk` falla con `PSSecurityException` por la ExecutionPolicy de PowerShell, ejecutar vía `cmd /c npm ... ` / `cmd /c npx ...` en vez de tocar la política de ejecución del sistema (ver `.kiro/steering/tech-stack.md`).

## Otros recordatorios de despliegue

- El empaquetado de la Lambda .NET usa **local bundling** (`dotnet publish` ejecutado en la máquina local durante `cdk synth`/`deploy`, sin Docker) — requiere el SDK de .NET 10 instalado localmente, no solo el runtime.
- Tras desplegar `techguessr-data-stack` por primera vez (o si se vació la tabla `techguessr-commits`), correr el script de migración antes de probar CommitGuessr end-to-end:
  ```bash
  npx ts-node infra/scripts/migrate-commits.ts
  ```
- Cambios en infraestructura son de alto riesgo (afectan recursos vivos): confirmar con el usuario antes de ejecutar `cdk deploy` contra stacks que ya existen en producción, salvo que se trate de agregar recursos nuevos claramente solicitados (ej. tablas/rutas de una modalidad nueva).
