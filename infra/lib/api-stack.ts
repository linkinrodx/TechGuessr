import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DataStack } from './data-stack';
import { AuthStack } from './auth-stack';

export interface ApiStackProps extends cdk.StackProps {
  dataStack: DataStack;
  authStack: AuthStack;
}

/**
 * Stack de API de TechGuessr.
 *
 * Ver docs/arquitectura.md y .kiro/specs/codeguessr-mvp/design.md
 * (secciones "Architecture" y "Contrato de API").
 *
 * La Lambda "game function" está escrita en .NET 10 (C#), no en TypeScript
 * (decisión tomada tras completar esta tarea inicialmente en TypeScript;
 * ver .kiro/steering/tech-stack.md). Se empaqueta con "local bundling"
 * (dotnet publish ejecutado directamente en la máquina que corre `cdk
 * synth`/`deploy`, sin Docker) en vez del BundlingImage oficial de AWS,
 * porque esta máquina no tiene Docker instalado.
 */
export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly gameFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { dataStack, authStack } = props;

    const gameFunctionProjectDir = path.join(__dirname, '..', 'lambda-dotnet', 'GameFunction');

    // Lambda única "game function" (ver design.md, "Backend: Lambda 'game function'").
    // La implementación real de los handlers llega en la fase 3 de tasks.md;
    // por ahora el código responde 501 para cada ruta (ver lambda-dotnet/GameFunction/Function.cs).
    this.gameFunction = new lambda.Function(this, 'GameFunction', {
      functionName: 'techguessr-game-function',
      runtime: lambda.Runtime.DOTNET_10,
      architecture: lambda.Architecture.X86_64,
      handler: 'GameFunction::GameFunction.Function::FunctionHandler',
      timeout: Duration.seconds(10),
      memorySize: 512,
      environment: {
        SNIPPETS_TABLE_NAME: dataStack.snippetsTable.tableName,
        SESSIONS_TABLE_NAME: dataStack.sessionsTable.tableName,
        SCORES_TABLE_NAME: dataStack.scoresTable.tableName,
        COMMITS_TABLE_NAME: dataStack.commitsTable.tableName,
        COMMIT_SESSIONS_TABLE_NAME: dataStack.commitSessionsTable.tableName,
        UI_SCREENSHOTS_TABLE_NAME: dataStack.uiScreenshotsTable.tableName,
        UI_SESSIONS_TABLE_NAME: dataStack.uiSessionsTable.tableName,
        // Usadas por Auth/OptionalJwtValidator.cs para validar el JWT
        // manualmente: las rutas de sesión ya no tienen JWT authorizer de
        // API Gateway (ver más abajo), así que la Lambda decide ella
        // misma si el caller está autenticado o es invitado.
        USER_POOL_ID: authStack.userPool.userPoolId,
        USER_POOL_CLIENT_ID: authStack.userPoolClient.userPoolClientId,
      },
      logGroup: new logs.LogGroup(this, 'GameFunctionLogGroup', {
        logGroupName: '/aws/lambda/techguessr-game-function',
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      code: lambda.Code.fromAsset(gameFunctionProjectDir, {
        bundling: {
          image: lambda.Runtime.DOTNET_10.bundlingImage,
          local: {
            // Local bundling: ejecuta `dotnet publish` directamente en el host
            // (requiere el SDK de .NET instalado localmente) en vez de usar
            // la imagen Docker de bundling. CDK solo usa el modo Docker si
            // este método devuelve false o lanza.
            tryBundle(outputDir: string): boolean {
              execSync(
                `dotnet publish "${gameFunctionProjectDir}" --configuration Release --runtime linux-x64 --self-contained false --output "${outputDir}"`,
                { stdio: 'inherit' },
              );
              return true;
            },
          },
        },
      }),
    });

    // Permisos IAM acotados exclusivamente a las tablas del proyecto
    // (ver docs/iam-policy.json para la policy del usuario IAM de despliegue;
    // esto es la policy de EJECUCIÓN de la Lambda, un ámbito distinto y más
    // acotado todavía).
    dataStack.snippetsTable.grantReadData(this.gameFunction);
    dataStack.sessionsTable.grantReadWriteData(this.gameFunction);
    dataStack.scoresTable.grantReadWriteData(this.gameFunction);
    dataStack.commitsTable.grantReadData(this.gameFunction);
    dataStack.commitSessionsTable.grantReadWriteData(this.gameFunction);
    dataStack.uiScreenshotsTable.grantReadData(this.gameFunction);
    dataStack.uiSessionsTable.grantReadWriteData(this.gameFunction);

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'techguessr-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const gameIntegration = new integrations.HttpLambdaIntegration(
      'GameIntegration',
      this.gameFunction,
    );

    // Rutas de sesión de CodeGuessr: públicas a nivel de API Gateway (sin
    // JWT authorizer). El login ya no es obligatorio para jugar; la Lambda
    // valida el JWT ella misma cuando viene presente y trata como invitado
    // cuando no (ver Auth/OptionalJwtValidator.cs). Los invitados juegan
    // normal pero no se guardan en el leaderboard.
    this.httpApi.addRoutes({
      path: '/sessions',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/rounds/next',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/rounds/{roundId}/answer',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/sessions/{sessionId}/summary',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    // Ruta pública, sin authorizer (ver design.md, Requirement 7.4).
    this.httpApi.addRoutes({
      path: '/leaderboard',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    // ============================================================================
    // CommitGuessr Routes
    // ============================================================================

    // Rutas de sesión de CommitGuessr: públicas, análogo a CodeGuessr.
    this.httpApi.addRoutes({
      path: '/commit-sessions',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/commit-rounds/next',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/commit-rounds/{roundId}/answer',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/commit-sessions/{sessionId}/summary',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    // Ruta pública, sin authorizer (análoga a /leaderboard).
    this.httpApi.addRoutes({
      path: '/commit-leaderboard',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    // ============================================================================
    // UIGuessr Routes
    // ============================================================================

    // Rutas de sesión de UIGuessr: públicas, análogo a CodeGuessr/CommitGuessr.
    this.httpApi.addRoutes({
      path: '/ui-sessions',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/ui-rounds/next',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/ui-rounds/{roundId}/answer',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
    });

    this.httpApi.addRoutes({
      path: '/ui-sessions/{sessionId}/summary',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    // Ruta pública, sin authorizer (análoga a /leaderboard y /commit-leaderboard).
    this.httpApi.addRoutes({
      path: '/ui-leaderboard',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'URL base de la API de TechGuessr',
    });
  }
}
