import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

/**
 * Stack de frontend de TechGuessr.
 *
 * Ver docs/arquitectura.md ("Hosting frontend: S3 + CloudFront").
 */
export class FrontendStack extends cdk.Stack {
  public readonly siteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Bucket privado: nadie accede a S3 directamente, solo CloudFront vía OAC.
    // Nombre autogenerado por CDK (no se fija) para evitar colisiones globales de S3.
    this.siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'techguessr-frontend',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        // S3BucketOrigin.withOriginAccessControl configura automáticamente el OAC
        // y la bucket policy necesaria para que solo esta distribución lea del bucket.
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // Fallback de SPA: cualquier ruta del Angular Router que no exista como
      // archivo en S3 (404) o que S3 rechace por no tener listado de directorio
      // (403) se resuelve devolviendo index.html con 200, para que el router
      // del lado del cliente decida qué mostrar.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.siteBucket.bucketName,
      description: 'Bucket S3 con el build estático de Angular',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'Dominio de CloudFront para acceder a TechGuessr',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'ID de la distribución CloudFront (para invalidaciones de caché)',
    });
  }
}
