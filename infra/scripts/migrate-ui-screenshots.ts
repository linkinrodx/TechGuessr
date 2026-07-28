/**
 * Script de migración de screenshots de UI de JSON local a DynamoDB.
 *
 * Uso:
 *   npx ts-node infra/scripts/migrate-ui-screenshots.ts
 *
 * Requiere:
 *   - AWS CLI configurado con credenciales válidas (perfil techguessr)
 *   - La tabla techguessr-ui-screenshots ya creada (ejecutar
 *     `cdk deploy techguessr-data-stack` primero)
 *
 * Análogo a migrate-commits.ts, ver ese archivo para más contexto sobre el
 * patrón de randomBucket.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_JSON_PATH = path.join(__dirname, '..', '..', 'src', 'app', 'data', 'ui-screenshots.json');
const TABLE_NAME = 'techguessr-ui-screenshots';
const RANDOM_BUCKET_COUNT = 10;

interface UIScreenshotData {
  id: string;
  imageUrl: string;
  app: string;
  action: string;
  year: number;
  difficulty: string;
  explanation: string;
}

async function migrateUIScreenshots() {
  console.log('🚀 Iniciando migración de screenshots de UI a DynamoDB...\n');

  console.log(`📖 Leyendo screenshots desde: ${SCREENSHOTS_JSON_PATH}`);
  const screenshotsJson = fs.readFileSync(SCREENSHOTS_JSON_PATH, 'utf-8');
  const screenshots: UIScreenshotData[] = JSON.parse(screenshotsJson);
  console.log(`   Encontrados ${screenshots.length} screenshots\n`);

  const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  const docClient = DynamoDBDocumentClient.from(client);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < screenshots.length; i++) {
    const screenshot = screenshots[i];
    const randomBucket = i % RANDOM_BUCKET_COUNT;

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            screenshotId: screenshot.id,
            imageUrl: screenshot.imageUrl,
            app: screenshot.app,
            action: screenshot.action,
            year: screenshot.year,
            difficulty: screenshot.difficulty,
            explanation: screenshot.explanation,
            randomBucket: randomBucket,
          },
        }),
      );

      successCount++;
      console.log(`✅ [${i + 1}/${screenshots.length}] ${screenshot.id} → bucket ${randomBucket}`);
    } catch (error) {
      errorCount++;
      console.error(`❌ [${i + 1}/${screenshots.length}] Error migrando ${screenshot.id}:`, error);
    }
  }

  console.log(`\n📊 Resumen de migración:`);
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📦 Total: ${screenshots.length}`);

  if (errorCount === 0) {
    console.log(`\n🎉 ¡Migración completada exitosamente!`);
  } else {
    console.log(`\n⚠️  Migración completada con errores.`);
    process.exit(1);
  }
}

migrateUIScreenshots().catch((error) => {
  console.error('\n💥 Error fatal durante la migración:', error);
  process.exit(1);
});
