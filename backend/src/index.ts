/**
 * Express server entry point.
 * Starts the cron scheduler and mounts API routes.
 */

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import medicationRoutes from "./routes/medications.js";
import doseRoutes from "./routes/doses.js";
import { startScheduler } from "./services/scheduler.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/doses", doseRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

startScheduler();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
