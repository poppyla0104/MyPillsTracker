#!/bin/bash
# Build and deploy the React frontend to S3 + invalidate CloudFront cache
# Usage: ./deploy-frontend.sh

set -euo pipefail

STACK_NAME="medreminder"
REGION="${AWS_REGION:-us-east-1}"
PROJECT_ROOT="$(dirname "$0")/.."

# Get bucket name and distribution ID from CloudFormation outputs
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation list-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResourceSummaries[?LogicalResourceId=='CloudFrontDistribution'].PhysicalResourceId" \
  --output text)

echo "Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm run build

echo "Uploading to s3://$BUCKET..."
aws s3 sync dist/ "s3://$BUCKET" --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text

echo "Done! Frontend deployed."
