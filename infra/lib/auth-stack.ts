import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * Stack de autenticación de TechGuessr.
 *
 * Ver docs/arquitectura.md y .kiro/specs/codeguessr-mvp/requirements.md (Requirement 1).
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'techguessr-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { username: true, email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Client sin secreto: apto para SPA (el secreto no se puede proteger en un frontend
    // estático). Solo se habilita USER_SRP_AUTH (protocolo SRP, la contraseña nunca
    // viaja en el request) en vez de USER_PASSWORD_AUTH (envía la contraseña en texto
    // plano dentro del payload cifrado por TLS, menos seguro que SRP). Amplify Auth y
    // amazon-cognito-identity-js soportan SRP de forma nativa.
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: 'techguessr-web-client',
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      // Sin Hosted UI / OAuth: el frontend habla directo con Cognito vía SDK (SRP),
      // no hay redirect a una pantalla de login alojada por Cognito.
      disableOAuth: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID (techguessr-user-pool)',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID (techguessr-web-client)',
    });
  }
}
