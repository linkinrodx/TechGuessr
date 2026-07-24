import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
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

    // Permisos IAM acotados exclusivamente a las 3 tablas del proyecto
    // (ver docs/iam-policy.json para la policy del usuario IAM de despliegue;
    // esto es la policy de EJECUCIÓN de la Lambda, un ámbito distinto y más
    // acotado todavía).
    dataStack.snippetsTable.grantReadData(this.gameFunction);
    dataStack.sessionsTable.grantReadWriteData(this.gameFunction);
    dataStack.scoresTable.grantReadWriteData(this.gameFunction);

    // HTTP API con JWT authorizer apuntando al User Pool de AuthStack.
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${authStack.userPool.userPoolId}`,
      {
        jwtAudience: [authStack.userPoolClient.userPoolClientId],
      },
    );

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

    // Rutas autenticadas (requieren JWT de Cognito).
    this.httpApi.addRoutes({
      path: '/sessions',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/rounds/next',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/rounds/{roundId}/answer',
      methods: [apigwv2.HttpMethod.POST],
      integration: gameIntegration,
      authorizer: jwtAuthorizer,
    });

    this.httpApi.addRoutes({
      path: '/sessions/{sessionId}/summary',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
      authorizer: jwtAuthorizer,
    });

    // Ruta pública, sin authorizer (ver design.md, Requirement 7.4).
    this.httpApi.addRoutes({
      path: '/leaderboard',
      methods: [apigwv2.HttpMethod.GET],
      integration: gameIntegration,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'URL base de la API de TechGuessr',
    });
  }
}
