# MyPillsTracker

Medication reminder app. Full-stack TypeScript.

## Tech Stack
- **Backend:** Express + Drizzle ORM + better-sqlite3 + node-cron + Nodemailer (port 3001)
- **Frontend:** React + Vite + Tailwind CSS + React Router (port 5173)
- **Auth:** JWT (bcryptjs)
- **Node version:** Requires Node 22+ (use `nvm use 22`)

## Project Structure
- `backend/` - Express API server
- `frontend/` - React SPA
- Database schema: `backend/src/db/schema.ts` (users, medications, schedules, dose_logs)
- Scheduler: `backend/src/services/scheduler.ts` (cron jobs for dose reminders, missed-dose sweep, refill checks)

## Running Locally
```bash
# Terminal 1 - Backend
cd backend && npm install && npx drizzle-kit migrate && npx tsx src/index.ts

# Terminal 2 - Frontend
cd frontend && npm install && npx vite --host
```
Frontend proxies `/api` to backend via `vite.config.ts`.

## Current State
- Backend: complete (auth, medication CRUD, dose confirmation, history, refill tracking, email notifications, scheduler)
- Frontend: complete (login/register, dashboard with "Mark as Taken", add medication form, medication detail with refill, dose history with adherence stats)
- Branch `feature/medication-reminder-app` is ready to push and PR into main
- GitHub remote: https://github.com/poppyla0104/MyPillsTracker.git
- Need to `gh auth login` before pushing

## TODO
- Browser push notifications (Web Notification API + service worker)
