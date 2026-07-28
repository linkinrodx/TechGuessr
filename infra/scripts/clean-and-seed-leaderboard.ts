/**
 * Script de limpieza + seed de datos de prueba para la tabla techguessr-scores.
 *
 * Vacía por completo el leaderboard (los 3 shards: codeguessr, commitguessr,
 * uiguessr) y carga usuarios de prueba con puntajes modestos (no cercanos al
 * máximo posible por modalidad), útiles para demo sin ensuciar el ranking
 * con valores irreales.
 *
 * Techos de puntaje por sesión (10 rondas, ver Domain/Scoring.cs,
 * Domain/CommitScoring.cs, Domain/UIScoring.cs):
 *   - codeguessr:    300 pts/ronda  -> máx 3,000
 *   - commitguessr: 1800 pts/ronda  -> máx 18,000
 *   - uiguessr:     1800 pts/ronda  -> máx 18,000
 *
 * Uso:
 *   $env:AWS_PROFILE = "techguessr"
 *   npx ts-node infra/scripts/clean-and-seed-leaderboard.ts
 *
 * Requiere:
 *   - AWS CLI configurado con el perfil `techguessr`.
 *   - La tabla techguessr-scores ya creada (cdk deploy techguessr-data-stack).
 *
 * Análogo a migrate-ui-screenshots.ts / migrate-commits.ts en patrón de
 * conexión (AWS SDK v3, DynamoDBDocumentClient).
 */

import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = 'techguessr-scores';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

interface SeedEntry {
  username: string;
  totalScore: number;
  leaderboardShard: 'codeguessr' | 'commitguessr' | 'uiguessr';
  daysAgo: number;
}

// Puntajes modestos: muy por debajo del techo de cada modalidad, variados
// para que el orden del leaderboard no se vea artificial.
const SEED_ENTRIES: SeedEntry[] = [
  // codeguessr (techo 3,000)
  { username: 'Carlos', totalScore: 480, leaderboardShard: 'codeguessr', daysAgo: 6 },
  { username: 'Andrea', totalScore: 620, leaderboardShard: 'codeguessr', daysAgo: 5 },
  { username: 'Maria', totalScore: 710, leaderboardShard: 'codeguessr', daysAgo: 4 },
  { username: 'Dina', totalScore: 890, leaderboardShard: 'codeguessr', daysAgo: 3 },
  { username: 'Jose', totalScore: 1040, leaderboardShard: 'codeguessr', daysAgo: 2 },
  { username: 'Valentina', totalScore: 1150, leaderboardShard: 'codeguessr', daysAgo: 1 },

  // commitguessr (techo 18,000)
  { username: 'Carlos', totalScore: 2400, leaderboardShard: 'commitguessr', daysAgo: 6 },
  { username: 'Andrea', totalScore: 3100, leaderboardShard: 'commitguessr', daysAgo: 5 },
  { username: 'Maria', totalScore: 3800, leaderboardShard: 'commitguessr', daysAgo: 4 },
  { username: 'Dina', totalScore: 4600, leaderboardShard: 'commitguessr', daysAgo: 3 },
  { username: 'Jose', totalScore: 5200, leaderboardShard: 'commitguessr', daysAgo: 2 },
  { username: 'Valentina', totalScore: 6000, leaderboardShard: 'commitguessr', daysAgo: 1 },

  // uiguessr (techo 18,000)
  { username: 'Carlos', totalScore: 2100, leaderboardShard: 'uiguessr', daysAgo: 6 },
  { username: 'Andrea', totalScore: 2900, leaderboardShard: 'uiguessr', daysAgo: 5 },
  { username: 'Maria', totalScore: 3600, leaderboardShard: 'uiguessr', daysAgo: 4 },
  { username: 'Dina', totalScore: 4300, leaderboardShard: 'uiguessr', daysAgo: 3 },
  { username: 'Jose', totalScore: 4900, leaderboardShard: 'uiguessr', daysAgo: 2 },
  { username: 'Valentina', totalScore: 5500, leaderboardShard: 'uiguessr', daysAgo: 1 },
];

async function clearTable(): Promise<number> {
  console.log(`🧹 Escaneando ${TABLE_NAME} para borrar todos los items existentes...\n`);

  let deletedCount = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ProjectionExpression: 'scoreId',
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    const items = scanResult.Items ?? [];
    if (items.length > 0) {
      // BatchWriteCommand admite máx. 25 operaciones por request.
      for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: batch.map((item) => ({
                DeleteRequest: { Key: { scoreId: item['scoreId'] } },
              })),
            },
          }),
        );
        deletedCount += batch.length;
        console.log(`   🗑️  Borrados ${deletedCount} items hasta ahora...`);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  console.log(`\n✅ Tabla vaciada: ${deletedCount} items borrados.\n`);
  return deletedCount;
}

async function seedTestUsers(): Promise<void> {
  console.log(`🌱 Cargando ${SEED_ENTRIES.length} entradas de prueba...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const entry of SEED_ENTRIES) {
    const achievedAt = new Date(Date.now() - entry.daysAgo * 24 * 60 * 60 * 1000).toISOString();

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            scoreId: randomUUID(),
            userId: `test-${entry.username.toLowerCase()}`,
            username: entry.username,
            totalScore: entry.totalScore,
            sessionId: randomUUID(),
            achievedAt,
            leaderboardShard: entry.leaderboardShard,
          },
        }),
      );
      successCount++;
      console.log(
        `✅ [${entry.leaderboardShard}] ${entry.username} → ${entry.totalScore} pts`,
      );
    } catch (error) {
      errorCount++;
      console.error(`❌ Error cargando ${entry.username} (${entry.leaderboardShard}):`, error);
    }
  }

  console.log(`\n📊 Resumen de seed:`);
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Limpieza + seed de techguessr-scores\n');
  await clearTable();
  await seedTestUsers();
  console.log('\n🎉 ¡Listo!');
}

main().catch((error) => {
  console.error('\n💥 Error fatal:', error);
  process.exit(1);
});
