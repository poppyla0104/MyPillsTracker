/**
 * Express server entry point.
 * Initializes email transport, starts the cron scheduler, and mounts API routes.
 */

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import medicationRoutes from "./routes/medications.js";
import doseRoutes from "./routes/doses.js";
import { initEmail } from "./services/email.js";
import { startScheduler } from "./services/scheduler.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from the React frontend dev server
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/doses", doseRoutes);

// Simple health check endpoint for monitoring
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

async function start() {
  // Set up Ethereal test email account (dev only)
  await initEmail();
  // Start cron jobs for dose reminders, missed-dose sweeps, and refill checks
  startScheduler();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
