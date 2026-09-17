import { Router } from "express";
import { db } from "../db/index.js";
import { doseLogs, medications, schedules } from "../db/schema.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.post("/:logId/confirm", (req: AuthRequest, res) => {
  const logId = Number(req.params.logId);

  const log = db
    .select({
      log: doseLogs,
      med: medications,
    })
    .from(doseLogs)
    .innerJoin(medications, eq(doseLogs.medicationId, medications.id))
    .where(
      and(eq(doseLogs.id, logId), eq(medications.userId, req.userId!))
    )
    .get();

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

  db.transaction(() => {
    db.update(doseLogs)
      .set({ status: "taken", takenAt: now })
      .where(eq(doseLogs.id, logId))
      .run();

    db.update(medications)
      .set({ remainingPillCount: newRemaining })
      .where(eq(medications.id, log.med.id))
      .run();
  });

  const updatedLog = db
    .select()
    .from(doseLogs)
    .where(eq(doseLogs.id, logId))
    .get();

  res.json({
    ...updatedLog,
    remainingPillCount: newRemaining,
    refillWarning: daysLeft <= 5,
  });
});

router.get("/today", (req: AuthRequest, res) => {
  const today = new Date().toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00`;
  const endOfDay = `${today}T23:59:59`;

  const logs = db
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
    .orderBy(doseLogs.scheduledAt)
    .all();

  const result = logs.map((row) => ({
    ...row.log,
    medicationName: row.medicationName,
    dosage: row.dosage,
    scheduleLabel: row.scheduleLabel,
    scheduleTime: row.scheduleTime,
  }));

  res.json(result);
});

router.get("/history", (req: AuthRequest, res) => {
  const { medId, from, to } = req.query;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const toDateStr = (d: Date) => d.toISOString().split("T")[0];
  const startDate =
    typeof from === "string" ? from : `${toDateStr(thirtyDaysAgo)}T00:00:00`;
  const endDate =
    typeof to === "string" ? to : `${toDateStr(new Date())}T23:59:59`;

  let query = db
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

  const logs = query.all();

  const result = logs.map((row) => ({
    ...row.log,
    medicationName: row.medicationName,
    dosage: row.dosage,
    scheduleLabel: row.scheduleLabel,
  }));

  res.json(result);
});

router.get("/refills", (req: AuthRequest, res) => {
  const meds = db
    .select()
    .from(medications)
    .where(
      and(
        eq(medications.userId, req.userId!),
        eq(medications.active, true)
      )
    )
    .all();

  const needsRefill = meds.filter((med) => {
    const daysLeft = med.frequency > 0 ? med.remainingPillCount / med.frequency : Infinity;
    return daysLeft <= 5;
  });

  res.json(needsRefill);
});

export default router;
