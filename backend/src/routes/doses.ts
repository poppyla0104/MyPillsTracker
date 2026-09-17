/**
 * Dose tracking routes: confirm doses, view today's schedule, history, and refill needs.
 * The confirm endpoint uses an atomic transaction to update both the dose log
 * and the medication's remaining pill count in a single operation.
 */

import { Router } from "express";
import { db } from "../db/index.js";
import { doseLogs, medications, schedules } from "../db/schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// POST /api/doses/:logId/confirm - mark a pending dose as taken
// Atomic: updates dose status AND decrements pill count in one transaction
router.post("/:logId/confirm", async (req: AuthRequest, res) => {
  const logId = Number(req.params.logId);

  const [log] = await db
    .select({
      log: doseLogs,
      med: medications,
    })
    .from(doseLogs)
    .innerJoin(medications, eq(doseLogs.medicationId, medications.id))
    .where(
      and(eq(doseLogs.id, logId), eq(medications.userId, req.userId!))
    );

  if (!log) {
    res.status(404).json({ error: "Dose log not found" });
    return;
  }

  if (log.log.status === "taken") {
    res.status(400).json({ error: "Dose already confirmed" });
    return;
  }

  if (log.log.status === "missed") {
    res.status(400).json({ error: "Dose was marked as missed" });
    return;
  }

  const now = new Date().toISOString();
  const newRemaining = Math.max(0, log.med.remainingPillCount - 1);
  const daysLeft = log.med.frequency > 0 ? newRemaining / log.med.frequency : 0;

  // Both updates succeed or neither does
  await db.transaction(async (tx) => {
    await tx
      .update(doseLogs)
      .set({ status: "taken", takenAt: now })
      .where(eq(doseLogs.id, logId));

    await tx
      .update(medications)
      .set({ remainingPillCount: newRemaining })
      .where(eq(medications.id, log.med.id));
  });

  const [updatedLog] = await db
    .select()
    .from(doseLogs)
    .where(eq(doseLogs.id, logId));

  res.json({
    ...updatedLog,
    remainingPillCount: newRemaining,
    refillWarning: daysLeft <= 5,
  });
});

// GET /api/doses/today - all dose logs for today, joined with medication and schedule info
router.get("/today", async (req: AuthRequest, res) => {
  const today = new Date().toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00`;
  const endOfDay = `${today}T23:59:59`;

  const logs = await db
    .select({
      log: doseLogs,
      medicationName: medications.name,
      dosage: medications.dosage,
      scheduleLabel: schedules.label,
      scheduleTime: schedules.timeOfDay,
    })
    .from(doseLogs)
    .innerJoin(medications, eq(doseLogs.medicationId, medications.id))
    .innerJoin(schedules, eq(doseLogs.scheduleId, schedules.id))
    .where(
      and(
        eq(medications.userId, req.userId!),
        gte(doseLogs.scheduledAt, startOfDay),
        lte(doseLogs.scheduledAt, endOfDay)
      )
    )
    .orderBy(doseLogs.scheduledAt);

  const result = logs.map((row) => ({
    ...row.log,
    medicationName: row.medicationName,
    dosage: row.dosage,
    scheduleLabel: row.scheduleLabel,
    scheduleTime: row.scheduleTime,
  }));

  res.json(result);
});

// GET /api/doses/history - filterable dose log history (default: last 30 days)
router.get("/history", async (req: AuthRequest, res) => {
  const { medId, from, to } = req.query;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Date strings must match the format stored in the database (no trailing Z)
  const toDateStr = (d: Date) => d.toISOString().split("T")[0];
  const startDate =
    typeof from === "string" ? from : `${toDateStr(thirtyDaysAgo)}T00:00:00`;
  const endDate =
    typeof to === "string" ? to : `${toDateStr(new Date())}T23:59:59`;

  const logs = await db
    .select({
      log: doseLogs,
      medicationName: medications.name,
      dosage: medications.dosage,
      scheduleLabel: schedules.label,
    })
    .from(doseLogs)
    .innerJoin(medications, eq(doseLogs.medicationId, medications.id))
    .innerJoin(schedules, eq(doseLogs.scheduleId, schedules.id))
    .where(
      and(
        eq(medications.userId, req.userId!),
        gte(doseLogs.scheduledAt, startDate),
        lte(doseLogs.scheduledAt, endDate),
        ...(medId ? [eq(doseLogs.medicationId, Number(medId))] : [])
      )
    )
    .orderBy(desc(doseLogs.scheduledAt))
    .limit(200);

  const result = logs.map((row) => ({
    ...row.log,
    medicationName: row.medicationName,
    dosage: row.dosage,
    scheduleLabel: row.scheduleLabel,
  }));

  res.json(result);
});

// GET /api/doses/refills - medications where daysLeft <= 5 (need pharmacy refill)
router.get("/refills", async (req: AuthRequest, res) => {
  const meds = await db
    .select()
    .from(medications)
    .where(
      and(
        eq(medications.userId, req.userId!),
        eq(medications.active, true)
      )
    );

  const needsRefill = meds.filter((med) => {
    const daysLeft = med.frequency > 0 ? med.remainingPillCount / med.frequency : Infinity;
    return daysLeft <= 5;
  });

  res.json(needsRefill);
});

export default router;
