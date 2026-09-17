# MyPillsTracker

A full-stack medication reminder app that helps users track daily medications, confirm doses, monitor remaining pill counts, and get reminded when it's time to refill.

## Features

- **Medication management** - Add medications with name, dosage, frequency (times per day), and total pill count
- **Scheduled dose tracking** - Automatic dose log creation at each scheduled time with pending/taken/missed status
- **User-verified confirmation** - Pill count only decrements when the user explicitly confirms they took the dose
- **Refill warnings** - Dashboard banner warns when remaining pills are running low (default threshold: 5 days)
- **Dose history & adherence stats** - View taken/missed counts and adherence percentage, filterable by medication

## Tech Stack

**Backend:** Node.js, Express, TypeScript, SQLite (Drizzle ORM + better-sqlite3), JWT auth, Zod validation, node-cron

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router

## Project Structure

```
my-pills-tracker/
├── backend/src/
│   ├── db/schema.ts           # Table definitions (users, medications, schedules, dose_logs)
│   ├── db/index.ts            # SQLite connection
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
└── README.md
```

## Prerequisites

- **Node.js >= 22** (required by better-sqlite3)
- npm

## Getting Started

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up the database
cd ../backend && npx drizzle-kit push

# Start the backend (port 3001)
npx tsx src/index.ts

# In another terminal, start the frontend (port 5173)
cd frontend && npm run dev
```

Open `http://localhost:5173`, register an account, and add your first medication.

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

2. **User confirms** - The user clicks "Mark as Taken" on the dashboard. An atomic SQLite transaction sets the log to `taken` and decrements `remainingPillCount`.

3. **Missed dose sweep** - Every 15 minutes, pending doses older than 2 hours are marked `missed`. No pill decrement.

4. **Refill warnings** - The dashboard checks `remainingPillCount / frequency` and shows a warning banner when the supply is running low.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `JWT_SECRET` | `dev-secret-change-in-production` | JWT signing secret |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend origin for CORS |

## License

MIT
