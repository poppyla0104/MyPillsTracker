# MyPillsTracker

A full-stack medication reminder app that helps users track daily medications, confirm doses, monitor remaining pill counts, and get reminded when it's time to refill.

## Features

- **Medication management** - Add medications with name, dosage, frequency (times per day), and total pill count
- **Scheduled dose tracking** - Automatic dose log creation at each scheduled time with pending/taken/missed status
- **User-verified confirmation** - Pill count only decrements when the user explicitly confirms they took the dose
- **Refill warnings** - Dashboard banner warns when remaining pills are running low (default threshold: 5 days)
- **Dose history & adherence stats** - View taken/missed counts and adherence percentage, filterable by medication

## Tech Stack

**Backend:** Node.js, Express, TypeScript, PostgreSQL (Drizzle ORM), JWT auth, Zod validation, node-cron

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router

**Infrastructure:** AWS (EC2 + RDS PostgreSQL + S3 + CloudFront + CloudWatch), deployable via CloudFormation or CDK

## Project Structure

```
my-pills-tracker/
├── backend/src/
│   ├── db/schema.ts           # Table definitions (users, medications, schedules, dose_logs)
│   ├── db/index.ts            # PostgreSQL connection pool
│   ├── routes/auth.ts         # Register + login
│   ├── routes/medications.ts  # CRUD + refill
│   ├── routes/doses.ts        # Confirm dose, today's schedule, history, refills
│   ├── services/scheduler.ts  # Cron jobs: dose creation + missed sweep
│   ├── middleware/auth.ts     # JWT middleware
│   └── index.ts               # Express entry point
├── frontend/src/
│   ├── api/client.ts          # Typed fetch wrapper with JWT auth
│   ├── context/AuthContext.tsx # Auth state provider
│   ├── components/Layout.tsx  # App shell with nav
│   ├── pages/                 # Dashboard, AddMed, MedDetail, History, Login, Register
│   └── App.tsx                # Router config
├── infra/
│   ├── template.yaml          # CloudFormation template
│   ├── deploy.sh              # CloudFormation deploy script
│   ├── deploy-frontend.sh     # Build + upload frontend to S3
│   └── cdk/                   # AWS CDK app (TypeScript)
│       ├── lib/cdk.ts         # CDK entry point
│       ├── lib/cdk-stack.ts   # Stack definition
│       └── deploy.sh          # CDK deploy script
└── README.md
```

## Prerequisites

- **Node.js >= 22**
- **PostgreSQL** (local for dev, RDS for production)
- npm

## Local Development

### 1. Set up PostgreSQL

Create a local database:
```bash
createdb medreminder
```

Or set `DATABASE_URL` to point to your PostgreSQL instance:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/medreminder"
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Run database migrations

```bash
cd backend && npx drizzle-kit push
```

### 4. Start the app

```bash
# Terminal 1: backend (port 3001)
cd backend && npx tsx src/index.ts

# Terminal 2: frontend (port 5173)
cd frontend && npm run dev
```

Open `http://localhost:5173`, register an account, and add your first medication.

## AWS Deployment

Two deployment options are available. Both provision the same resources:

| Resource | Type | Free Tier |
|----------|------|-----------|
| EC2 | t3.micro | 750 hrs/mo for 12 months |
| RDS PostgreSQL | db.t3.micro | 750 hrs/mo for 12 months |
| S3 | Frontend hosting | 5 GB free |
| CloudFront | CDN + HTTPS | 1M requests/mo free |
| CloudWatch | Logging | 5 GB ingestion + 5 GB storage free |
| Secrets Manager | JWT secret | $0.40/mo (no free tier) |

### Prerequisites (both options)

1. AWS CLI configured (`aws configure`)
2. An EC2 key pair created in your target region (default: us-east-2)

The JWT secret is auto-generated and stored in AWS Secrets Manager. No need to provide one.

### Option A: CloudFormation (YAML template)

```bash
cd infra
./deploy.sh <key-pair-name> <db-password>
```

### Option B: CDK (TypeScript)

Requires Node >= 18. If using nvm, the script auto-switches to Node 22.

```bash
# First time only: bootstrap CDK in your account/region
npx cdk bootstrap aws://<account-id>/us-east-2

# Deploy
cd infra/cdk
./deploy.sh <key-pair-name> <db-password>
```

### Deploy the frontend

After the infrastructure is up, build and upload the React app:

```bash
cd infra
./deploy-frontend.sh
```

The scripts output the CloudFront URL, EC2 IP, and RDS endpoint.

### Stack management

**Check stack status:**
```bash
aws cloudformation describe-stacks \
  --stack-name poppillztracker \
  --region us-east-2 \
  --query "Stacks[0].StackStatus" \
  --output text
```

**View stack outputs (URLs, IPs):**
```bash
aws cloudformation describe-stacks \
  --stack-name poppillztracker \
  --region us-east-2 \
  --query "Stacks[0].Outputs" \
  --output table
```

**View failure events (if deploy fails):**
```bash
aws cloudformation describe-stack-events \
  --stack-name poppillztracker \
  --region us-east-2 \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" \
  --output table
```

**Delete the stack:**
```bash
# Empty the S3 bucket first (required before delete)
aws s3 rm s3://poppillztracker-frontend-<account-id> --recursive

# Delete the stack
aws cloudformation delete-stack \
  --stack-name poppillztracker \
  --region us-east-2

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete \
  --stack-name poppillztracker \
  --region us-east-2
```

**Fix a stuck rollback (e.g. if EC2 was manually terminated):**
```bash
aws cloudformation continue-update-rollback \
  --stack-name poppillztracker \
  --region us-east-2 \
  --resources-to-skip EC2Instance
```

**Redeploy after delete:**
```bash
cd infra
./deploy.sh <key-pair-name> <db-password>
./deploy-frontend.sh
```

### Viewing logs (CloudWatch)

Backend application logs and EC2 startup logs are shipped to CloudWatch automatically.

| Log Group | Content |
|-----------|---------|
| `/poppillztracker/backend` | App stdout and stderr (requests, errors, scheduler) |
| `/poppillztracker/cloud-init` | EC2 UserData startup logs |

**Tail logs in real time:**
```bash
aws logs tail /poppillztracker/backend --follow --region us-east-2
```

**View recent logs:**
```bash
aws logs tail /poppillztracker/backend --since 1h --region us-east-2
```

**View startup logs (useful for debugging deploy failures):**
```bash
aws logs tail /poppillztracker/cloud-init --region us-east-2
```

You can also view logs in the AWS Console under **CloudWatch > Log groups**.

### Custom domain

To use a custom domain (e.g. `www.poppillztracker.com`):

1. Request an ACM certificate in **us-east-1** (required for CloudFront):
   ```bash
   aws acm request-certificate \
     --domain-name poppillztracker.com \
     --subject-alternative-names "*.poppillztracker.com" \
     --validation-method DNS \
     --region us-east-1
   ```

2. Add the DNS validation CNAME to your domain registrar

3. After validation, add the domain as a CloudFront alternate name and attach the certificate

4. Add DNS records at your registrar:
   - `CNAME www -> <cloudfront-distribution>.cloudfront.net`
   - `URL Redirect @ -> https://www.poppillztracker.com` (for apex domain)

### Architecture

```
Users -> CloudFront -> S3 (React frontend)
                    -> EC2:3001 (Express API) -> RDS PostgreSQL
                                              -> CloudWatch Logs
```

CloudFront serves the React build from S3 and proxies `/api/*` requests to the EC2 backend. RDS sits in a private subnet, accessible only from EC2. The CloudWatch agent on EC2 ships application and startup logs.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/medications` | List active medications |
| GET | `/api/medications/:id` | Detail + schedules + logs |
| POST | `/api/medications` | Create medication + schedules |
| PUT | `/api/medications/:id` | Update medication |
| DELETE | `/api/medications/:id` | Soft-delete (deactivate) |
| POST | `/api/medications/:id/refill` | Reset pill count |
| POST | `/api/doses/:logId/confirm` | Confirm dose (atomic pill decrement) |
| GET | `/api/doses/today` | Today's dose logs |
| GET | `/api/doses/history` | Filterable history (default 30 days) |
| GET | `/api/doses/refills` | Medications needing refill |

## How Dose Tracking Works

1. **Scheduler creates pending doses** - Every minute, the cron job checks if any schedule's `timeOfDay` matches now. If so, it creates a `pending` dose log.

2. **User confirms** - The user clicks "Mark as Taken" on the dashboard. An atomic PostgreSQL transaction sets the log to `taken` and decrements `remainingPillCount`.

3. **Missed dose sweep** - Every 15 minutes, pending doses older than 2 hours are marked `missed`. No pill decrement.

4. **Refill warnings** - The dashboard checks `remainingPillCount / frequency` and shows a warning banner when the supply is running low.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/medreminder` | PostgreSQL connection string |
| `JWT_SECRET` | `dev-secret-change-in-production` | JWT signing secret (auto-generated in prod via Secrets Manager) |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend origin for CORS |

## License

MIT
