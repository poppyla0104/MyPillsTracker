#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { MedreminderStack } from './cdk-stack';

const app = new cdk.App();
new MedreminderStack(app, 'poppillztracker', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
  },
});
