# Despliegue de CommitGuessr

Guía paso a paso para desplegar la funcionalidad de CommitGuessr en TechGuessr.

## Prerequisitos

- AWS CLI configurado con credenciales válidas
- Node.js ≥ v22.22.3
- .NET SDK 10 instalado
- Infraestructura base de TechGuessr ya desplegada (AuthStack, DataStack base, ApiStack)

## Pasos de Despliegue

### 1. Compilar el Backend .NET

Primero, asegúrate de que el código .NET compile correctamente con los nuevos archivos de CommitGuessr:

```bash
cd infra/lambda-dotnet/GameFunction
dotnet build
```

Si hay errores de compilación, corrígelos antes de continuar.

### 2. Desplegar las Tablas de DynamoDB

Despliega el DataStack actualizado que incluye las nuevas tablas:

```bash
cd infra
npx cdk deploy DataStack
```

Esto creará:
- `techguessr-commits` (con GSI `byRandomBucket`)
- `techguessr-commit-sessions` (con GSI `byUserId`)

### 3. Migrar los Datos de Commits

```bash
cd infra
node scripts/reupload-commits.js
```

El script (`infra/scripts/reupload-commits.js`) usa `@aws-sdk/client-dynamodb` (devDependency del proyecto, versión fija) directamente desde Node:
- Lee los 10 commits de `src/app/data/commits.json`
- Asigna un `randomBucket` (0-9) a cada commit para distribución uniforme
- Los sube a la tabla `techguessr-commits` con `BatchWriteItemCommand`
- Usa el perfil `techguessr` (ver `.kiro/steering/infra-deploy.md`)

**Por qué no se usa `aws dynamodb batch-write-item` del AWS CLI:** en Windows, el AWS CLI (Python/botocore) lee el archivo `--request-items file://...` con la code page del sistema (cp1252) en vez de UTF-8, corrompiendo tildes y eñes (mojibake tipo `agregÃ³` en vez de `agregó`). El SDK de Node no tiene ese problema porque nunca serializa a un archivo intermedio: los strings van directo del JSON de Node a la llamada HTTP, siempre en UTF-8.

Para verificar que no hay mojibake en los datos ya migrados:

```bash
node scripts/verify-commits-encoding.js
```

Detecta patrones típicos de UTF-8 mal decodificado (`Ã.`, `Â.`) en el campo `explanation` de cada commit.

### 4. Desplegar la Lambda Actualizada

Despliega el ApiStack con las nuevas rutas y variables de entorno:

```bash
cd infra
npx cdk deploy ApiStack
```

Esto:
- Actualiza la Lambda con el código .NET que incluye handlers de CommitGuessr
- Agrega variables de entorno `COMMITS_TABLE_NAME` y `COMMIT_SESSIONS_TABLE_NAME`
- Configura permisos IAM para las nuevas tablas
- Registra las rutas de CommitGuessr en API Gateway:
  - `POST /commit-sessions`
  - `GET /commit-rounds/next`
  - `POST /commit-rounds/{roundId}/answer`
  - `GET /commit-sessions/{sessionId}/summary`
  - `GET /commit-leaderboard` (pública, sin JWT)

### 5. Actualizar el Frontend

El frontend ya está configurado para usar CommitGuessr. Solo necesitas asegurarte de que la URL de la API esté correctamente configurada:

```bash
# Verifica que src/environments/environment.ts tenga la URL correcta
# Debería apuntar a la salida de `cdk deploy ApiStack` (ApiUrl)
```

### 6. Construir y Desplegar el Frontend

```bash
npm run build
npx cdk deploy FrontendStack
```

## Tests

Antes de desplegar, corre los tests locales:

```bash
# Backend .NET (property-based tests con FsCheck)
cd infra/lambda-dotnet/GameFunction.Tests
dotnet test

# Frontend Angular (Vitest)
cd ../../..
npx ng test --watch=false --include=**/commit-game.service.spec.ts
```

## Verificación

### 1. Verificar las Tablas

```bash
# Verificar que las tablas existen
aws dynamodb list-tables --query "TableNames[?contains(@, 'techguessr')]"

# Verificar contenido de commits (debe mostrar 10 items)
aws dynamodb scan --table-name techguessr-commits --select COUNT
```

### 2. Verificar la Lambda

```bash
# Ver las variables de entorno de la Lambda
aws lambda get-function-configuration --function-name techguessr-game-function \
  --query "Environment.Variables"
```

Debe incluir:
```json
{
  "COMMITS_TABLE_NAME": "techguessr-commits",
  "COMMIT_SESSIONS_TABLE_NAME": "techguessr-commit-sessions",
  ...
}
```

### 3. Probar la API

```bash
# Obtén un token de autenticación desde el frontend (login)
# Luego prueba crear una sesión CommitGuessr

TOKEN="tu_token_aqui"
API_URL="https://tu-api-id.execute-api.region.amazonaws.com"

curl -X POST "$API_URL/commit-sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Respuesta esperada (200):
```json
{
  "SessionId": "uuid-generado",
  "TotalRounds": 10
}
```

### 4. Probar desde el Frontend

1. Navega a `https://tu-dominio.cloudfront.net` (o localhost:4200 en desarrollo)
2. Inicia sesión
3. En la página principal, haz clic en el botón "CommitGuessr"
4. Debería cargar una ronda con un diff
5. Selecciona un tipo de commit y envía la respuesta
6. Verifica que el puntaje se actualice correctamente

## Troubleshooting

### Error: "Dataset de commits insuficiente"

**Causa:** La tabla `techguessr-commits` está vacía o tiene menos de 10 commits.

**Solución:** Ejecuta el script de migración:
```bash
npx ts-node infra/scripts/migrate-commits.ts
```

### Error: "Sesión no encontrada"

**Causa:** La tabla `techguessr-commit-sessions` no tiene permisos correctos o no existe.

**Solución:** Redespliega el DataStack y ApiStack:
```bash
cd infra
npx cdk deploy DataStack ApiStack
```

### Error de compilación .NET

**Causa:** Faltan archivos o hay errores de sintaxis en el código C#.

**Solución:** Revisa los archivos en `infra/lambda-dotnet/GameFunction/`:
- `Domain/CommitSessionModels.cs`
- `Domain/CommitScoring.cs`
- `Domain/CommitSessionTransitions.cs`
- `Repositories/CommitsRepository.cs`
- `Repositories/CommitSessionsRepository.cs`
- `Api/ApiModels.cs` (modelos de CommitGuessr)
- `Function.cs` (handlers de CommitGuessr)

### Rutas no encontradas (404)

**Causa:** Las rutas de CommitGuessr no están registradas en API Gateway.

**Solución:** Redespliega el ApiStack:
```bash
cd infra
npx cdk deploy ApiStack
```

## Rollback

Si necesitas revertir los cambios:

```bash
# 1. Eliminar las tablas de CommitGuessr
aws dynamodb delete-table --table-name techguessr-commits
aws dynamodb delete-table --table-name techguessr-commit-sessions

# 2. Revertir cambios en Git
git checkout main -- infra/lib/data-stack.ts
git checkout main -- infra/lib/api-stack.ts
git checkout main -- infra/lambda-dotnet/GameFunction/

# 3. Redesplegar
cd infra
npx cdk deploy DataStack ApiStack
```

## Siguientes Pasos

Con CommitGuessr desplegado, considera:

1. **Expandir el dataset**: Agregar más commits al archivo JSON y volver a ejecutar la migración
2. **Métricas**: Configurar CloudWatch dashboards para monitorear el uso de CommitGuessr
3. **Tests**: Ejecutar tests de integración para verificar el flujo completo
4. **Leaderboard específico**: Crear una tabla o GSI dedicado para rankings de CommitGuessr

## Recursos Adicionales

- [Documentación de CommitGuessr](../src/app/features/commitguessr/README.md)
- [Propuestas e Ideas](../../propuestas-ideas.md) - Sección CommitGuessr
- [Arquitectura del Proyecto](../docs/arquitectura.md)
