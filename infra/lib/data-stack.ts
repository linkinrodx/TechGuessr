import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Stack de datos de TechGuessr.
 *
 * Ver docs/arquitectura.md y .kiro/specs/codeguessr-mvp/design.md (sección "Data Models").
 */
export class DataStack extends cdk.Stack {
  public readonly snippetsTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;
  public readonly scoresTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // techguessr-snippets: catálogo curado de snippets.
    // randomBucket permite seleccionar un snippet al azar con Query en vez de Scan
    // (ver GET /rounds/next en design.md).
    this.snippetsTable = new dynamodb.Table(this, 'SnippetsTable', {
      tableName: 'techguessr-snippets',
      partitionKey: { name: 'snippetId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.snippetsTable.addGlobalSecondaryIndex({
      indexName: 'byRandomBucket',
      partitionKey: { name: 'randomBucket', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'snippetId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // techguessr-sessions: una partida Clásica (10 rondas) en curso o finalizada.
    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'techguessr-sessions',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: 'byUserId',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // techguessr-scores: tabla de mejores puntajes (leaderboard), ordenada por totalScore.
    this.scoresTable = new dynamodb.Table(this, 'ScoresTable', {
      tableName: 'techguessr-scores',
      partitionKey: { name: 'scoreId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.scoresTable.addGlobalSecondaryIndex({
      indexName: 'byTotalScore',
      // Partición fija: todo el leaderboard vive en una sola partición lógica
      // para poder ordenar globalmente por totalScore con una sola Query.
      // Aceptable para el tamaño de datos de un MVP de hackathon.
      partitionKey: { name: 'leaderboardShard', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'totalScore', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
