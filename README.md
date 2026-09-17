# MyPillsTracker

A full-stack medication reminder app that helps users track daily medications, confirm doses, monitor remaining pill counts, and get notified when it's time to take a dose or refill a prescription.

## Features

- **Medication management** - Add medications with name, dosage, frequency (times per day), and total pill count
- **Scheduled dose tracking** - Automatic dose log creation at each scheduled time with pending/taken/missed status
- **User-verified confirmation** - Pill count only decrements when the user explicitly confirms they took the dose
- **Refill reminders** - Warns when remaining pills are running low (configurable threshold, default 5 days)
- **Dose history & adherence stats** - View taken/missed counts and adherence percentage, filterable by medication
- **Email notifications** - Reminder emails with one-click "Mark as Taken" button, plus daily refill alerts

## Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- SQLite via Drizzle ORM + better-sqlite3
- JWT authentication (bcryptjs + jsonwebtoken)
- Zod request validation
- node-cron for scheduled jobs
- Nodemailer (Ethereal test accounts for dev)

**Frontend:**
- React + TypeScript (Vite)
- Tailwind CSS
- React Router

## Project Structure

```
my-pills-tracker/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle table definitions (users, medications, schedules, dose_logs)
│   │   │   └── index.ts           # SQLite connection with WAL mode
│   │   ├── routes/
│   │   │   ├── auth.ts            # POST /register, POST /login
│   │   │   ├── medications.ts     # CRUD + refill endpoint
│   │   │   └── doses.ts           # Confirm dose, today's schedule, history, refills
│   │   ├── services/
│   │   │   ├── scheduler.ts       # 3 cron jobs: dose reminders, missed sweep, refill check
│   │   │   └── email.ts           # Nodemailer email templates
│   │   ├── middleware/
│   │   │   └── auth.ts            # JWT middleware
│   │   └── index.ts               # Express entry point
│   ├── data/                      # SQLite database file (auto-created)
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # Typed fetch wrapper with JWT auth
│   │   ├── context/AuthContext.tsx # Auth state provider
│   │   ├── components/Layout.tsx  # App shell with nav
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Today's doses + refill warnings
│   │   │   ├── AddMed.tsx         # Add medication form
│   │   │   ├── MedDetail.tsx      # Medication detail + pill progress bar
│   │   │   ├── History.tsx        # Adherence stats + dose log table
│   │   │   ├── ConfirmDose.tsx    # Email confirmation landing page
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   └── App.tsx                # Router config
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── README.md
```

## Prerequisites

- **Node.js >= 22** (required by better-sqlite3)
- npm

If you use nvm:
```bash
nvm install 22
nvm use 22
```

## Getting Started

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Set up the database

```bash
cd backend
npx drizzle-kit push
```

This creates the SQLite database at `backend/data/med-reminder.db` with all tables.

### 3. Start the backend

```bash
cd backend
npx tsx src/index.ts
```

The API server starts on `http://localhost:3001`. On startup it creates an Ethereal test email account and prints the credentials to the console.

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

The React app starts on `http://localhost:5173` and proxies `/api` requests to the backend.

### 5. Use the app

1. Open `http://localhost:5173` and register an account
2. Add a medication with name, dosage, frequency, pill count, and schedule times
3. When a scheduled time arrives, the cron job creates a pending dose log
4. Click "Mark as Taken" on the dashboard to confirm (decrements pill count)
5. View adherence stats on the History page
6. When pills run low, a refill warning banner appears on the dashboard

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/medications` | List active medications |
| GET | `/api/medications/:id` | Medication detail + schedules + logs |
| POST | `/api/medications` | Create medication + schedules |
| PUT | `/api/medications/:id` | Update medication |
| DELETE | `/api/medications/:id` | Soft-delete (deactivate) |
| POST | `/api/medications/:id/refill` | Reset pill count |
| POST | `/api/doses/:logId/confirm` | Confirm dose (atomic pill decrement) |
| GET | `/api/doses/today` | Today's dose logs |
| GET | `/api/doses/history` | Filterable history (default 30 days) |
| GET | `/api/doses/refills` | Medications needing refill |

## How Dose Tracking Works

1. **Scheduler creates pending doses** - Every minute, the cron job checks if any schedule's `timeOfDay` matches the current time. If so, it creates a `pending` dose log and sends a reminder email.

2. **User confirms** - The user clicks "Mark as Taken" on the dashboard (or the button in the email). This triggers an atomic SQLite transaction that sets the log status to `taken` and decrements the medication's `remainingPillCount`.

3. **Missed dose sweep** - Every 15 minutes, another cron job finds pending doses older than 2 hours and marks them as `missed`. No pill count is decremented for missed doses.

4. **Refill alerts** - Daily at 9 AM, the scheduler calculates `daysLeft = remainingPillCount / frequency`. If `daysLeft <= refillThresholdDays` (default 5), it sends a refill reminder email. The dashboard also shows a warning banner.

## Email (Development)

In dev mode, emails are sent to an Ethereal fake SMTP account. No real emails are delivered. View captured emails at https://ethereal.email/login using the credentials printed to the backend console on startup.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `JWT_SECRET` | `dev-secret-change-in-production` | JWT signing secret |
| `FRONTEND_URL` | `http://localhost:5173` | Used in email confirmation links |

## License

MIT
