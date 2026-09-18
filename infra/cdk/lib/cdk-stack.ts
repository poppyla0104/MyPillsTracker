import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class MedreminderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const keyPairName = new cdk.CfnParameter(this, 'KeyPairName', {
      type: 'AWS::EC2::KeyPair::KeyName',
      description: 'EC2 key pair for SSH access',
    });

    const dbPassword = new cdk.CfnParameter(this, 'DBPassword', {
      type: 'String',
      noEcho: true,
      minLength: 8,
      description: 'PostgreSQL master password (min 8 characters)',
    });

    // --- JWT Secret (auto-generated, stored in Secrets Manager) ---
    const jwtSecret = new secretsmanager.Secret(this, 'JWTSecret', {
      secretName: 'poppillztracker/jwt-secret',
      description: 'JWT signing secret for MyPillsTracker',
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    // --- VPC ---
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { cidrMask: 24, name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // --- Security Groups ---
    const ec2Sg = new ec2.SecurityGroup(this, 'EC2SG', {
      vpc,
      description: 'Allow HTTP and SSH to EC2',
      allowAllOutbound: true,
    });
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3001), 'Backend API');

    const rdsSg = new ec2.SecurityGroup(this, 'RDSSG', {
      vpc,
      description: 'Allow PostgreSQL from EC2 only',
    });
    rdsSg.addIngressRule(ec2Sg, ec2.Port.tcp(5432), 'PostgreSQL from EC2');

    // --- RDS PostgreSQL ---
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      databaseName: 'medreminder',
      credentials: rds.Credentials.fromPassword(
        'medreminder',
        cdk.SecretValue.cfnParameter(dbPassword),
      ),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      multiAz: false,
      backupRetention: cdk.Duration.days(1),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    // --- EC2 Instance ---
    const ami = ec2.MachineImage.latestAmazonLinux2023();

    const role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    jwtSecret.grantRead(role);

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -e',
      'curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -',
      'yum install -y nodejs git jq',
      'cd /home/ec2-user',
      'git clone https://github.com/poppyla0104/MyPillsTracker.git app',
      'cd app',
      'git checkout feature/medication-reminder-app',
      'cd backend',
      'npm install',
      `JWT_VAL=$(aws secretsmanager get-secret-value --secret-id ${jwtSecret.secretName} --region ${this.region} --query SecretString --output text)`,
      `cat > .env <<ENVEOF`,
      `DATABASE_URL=postgresql://medreminder:${dbPassword.valueAsString}@${database.dbInstanceEndpointAddress}:${database.dbInstanceEndpointPort}/medreminder`,
      'JWT_SECRET=$JWT_VAL',
      'PORT=3001',
      'FRONTEND_URL=*',
      'ENVEOF',
      'npx drizzle-kit push',
      'cd ../frontend',
      'npm install',
      'npm run build',
      'npm install -g pm2',
      'cd ../backend',
      'pm2 start "npx tsx src/index.ts" --name medreminder',
      'pm2 startup systemd -u ec2-user --hp /home/ec2-user',
      'pm2 save',
      'chown -R ec2-user:ec2-user /home/ec2-user/app',
    );

    const instance = new ec2.Instance(this, 'EC2Instance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ami,
      securityGroup: ec2Sg,
      keyPair: ec2.KeyPair.fromKeyPairName(this, 'KeyPair', keyPairName.valueAsString),
      userData,
      role,
    });
    instance.node.addDependency(database);

    // --- S3 + CloudFront for Frontend ---
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `poppillztracker-frontend-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(instance.instancePublicDnsName, {
            httpPort: 3001,
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL for the application',
    });
    new cdk.CfnOutput(this, 'EC2PublicIP', {
      value: instance.instancePublicIp,
      description: 'EC2 instance public IP (for SSH)',
    });
    new cdk.CfnOutput(this, 'RDSEndpoint', {
      value: database.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    });
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket for deploying frontend builds',
    });
    new cdk.CfnOutput(this, 'JWTSecretArn', {
      value: jwtSecret.secretArn,
      description: 'Secrets Manager ARN for the JWT secret',
    });
  }
}
