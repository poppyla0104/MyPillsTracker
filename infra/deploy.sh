#!/bin/bash
# Deploy MyPillsTracker infrastructure with CloudFormation
# Usage: ./deploy.sh <key-pair-name> <db-password>

set -euo pipefail

STACK_NAME="poppillztracker"
TEMPLATE="$(dirname "$0")/template.yaml"
REGION="${AWS_REGION:-us-east-2}"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <key-pair-name> <db-password>"
  echo ""
  echo "  key-pair-name: Name of an existing EC2 key pair for SSH access"
  echo "  db-password:   PostgreSQL master password (min 8 characters)"
  echo ""
  echo "  JWT secret is auto-generated and stored in AWS Secrets Manager."
  exit 1
fi

KEY_PAIR="$1"
DB_PASSWORD="$2"

echo "Deploying stack '$STACK_NAME' in $REGION..."

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --region "$REGION" \
  --parameter-overrides \
    KeyPairName="$KEY_PAIR" \
    DBPassword="$DB_PASSWORD" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

echo ""
echo "Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table
