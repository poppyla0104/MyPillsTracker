#!/bin/bash
# Deploy MyPillsTracker infrastructure with AWS CDK
# Usage: ./deploy.sh <key-pair-name> <db-password> <jwt-secret>

set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: $0 <key-pair-name> <db-password> <jwt-secret>"
  echo ""
  echo "  key-pair-name: Name of an existing EC2 key pair for SSH access"
  echo "  db-password:   PostgreSQL master password (min 8 characters)"
  echo "  jwt-secret:    Secret key for JWT signing (min 16 characters)"
  exit 1
fi

KEY_PAIR="$1"
DB_PASSWORD="$2"
JWT_SECRET="$3"

cd "$(dirname "$0")"

# Use Node 22 via nvm if available (CDK requires Node >= 18)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  nvm use 22 2>/dev/null || true
fi

echo "Installing CDK dependencies..."
npm install

echo "Deploying with CDK..."
npx cdk deploy \
  --parameters KeyPairName="$KEY_PAIR" \
  --parameters DBPassword="$DB_PASSWORD" \
  --parameters JWTSecret="$JWT_SECRET" \
  --require-approval never

echo ""
echo "Stack outputs:"
npx cdk outputs 2>/dev/null || \
  aws cloudformation describe-stacks \
    --stack-name medreminder \
    --region "${AWS_REGION:-us-east-2}" \
    --query "Stacks[0].Outputs" \
    --output table
