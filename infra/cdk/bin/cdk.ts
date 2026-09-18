#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { MedreminderStack } from '../lib/cdk-stack';

const app = new cdk.App();
new MedreminderStack(app, 'medreminder', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
  },
});
