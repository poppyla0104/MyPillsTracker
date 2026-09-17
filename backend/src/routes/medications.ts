/**
 * Medication CRUD routes.
 * All routes require authentication. Medications are scoped to the logged-in user.
 * Deletes are soft (set active=false) so dose history is preserved.
 */

import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { medications, schedules, doseLogs } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// Validation: creating a medication requires at least one schedule entry
const createMedSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.number().int().min(1).max(10),
  totalPillCount: z.number().int().min(1),
  schedules: z
    .array(
      z.object({
        timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
        label: z.string().min(1),
      })
    )
    .min(1),
});

const updateMedSchema = z.object({
  name: z.string().min(1).optional(),
  dosage: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

const refillSchema = z.object({
  newCount: z.number().int().min(1),
});

// GET /api/medications - list all active medications for the user
router.get("/", (req: AuthRequest, res) => {
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
  res.json(meds);
});

// GET /api/medications/:id - medication detail with schedules and recent dose logs
router.get("/:id", (req: AuthRequest, res) => {
  const med = db
    .select()
    .from(medications)
    .where(
      and(
        eq(medications.id, Number(req.params.id)),
        eq(medications.userId, req.userId!)
      )
    )
    .get();

  if (!med) {
    res.status(404).json({ error: "Medication not found" });
    return;
  }

  const medSchedules = db
    .select()
    .from(schedules)
    .where(eq(schedules.medicationId, med.id))
    .all();

  const recentLogs = db
    .select()
    .from(doseLogs)
    .where(eq(doseLogs.medicationId, med.id))
    .orderBy(desc(doseLogs.scheduledAt))
    .limit(50)
    .all();

  res.json({ ...med, schedules: medSchedules, recentLogs });
});

// POST /api/medications - create a medication and its schedule rows
router.post("/", (req: AuthRequest, res) => {
  const parsed = createMedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, dosage, frequency, totalPillCount, schedules: scheduleList } =
    parsed.data;

  // remainingPillCount starts equal to the total (full bottle)
  const med = db
    .insert(medications)
    .values({
      userId: req.userId!,
      name,
      dosage,
      frequency,
      totalPillCount,
      remainingPillCount: totalPillCount,
    })
    .returning()
    .get();

  const createdSchedules = scheduleList.map((s) =>
    db
      .insert(schedules)
      .values({ medicationId: med.id, timeOfDay: s.timeOfDay, label: s.label })
      .returning()
      .get()
  );

  res.status(201).json({ ...med, schedules: createdSchedules });
});

// PUT /api/medications/:id - update name, dosage, or active status
router.put("/:id", (req: AuthRequest, res) => {
  const parsed = updateMedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = db
    .select()
    .from(medications)
    .where(
      and(
        eq(medications.id, Number(req.params.id)),
        eq(medications.userId, req.userId!)
      )
    )
    .get();

  if (!existing) {
    res.status(404).json({ error: "Medication not found" });
    return;
  }

  const updated = db
    .update(medications)
    .set(parsed.data)
    .where(eq(medications.id, existing.id))
    .returning()
    .get();

  res.json(updated);
});

// DELETE /api/medications/:id - soft-delete by setting active=false
router.delete("/:id", (req: AuthRequest, res) => {
  const existing = db
    .select()
    .from(medications)
    .where(
      and(
        eq(medications.id, Number(req.params.id)),
        eq(medications.userId, req.userId!)
      )
    )
    .get();

  if (!existing) {
    res.status(404).json({ error: "Medication not found" });
    return;
  }

  db.update(medications)
    .set({ active: false })
    .where(eq(medications.id, existing.id))
    .run();

  res.status(204).send();
});

// POST /api/medications/:id/refill - reset pill count after pharmacy refill
router.post("/:id/refill", (req: AuthRequest, res) => {
  const parsed = refillSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = db
    .select()
    .from(medications)
    .where(
      and(
        eq(medications.id, Number(req.params.id)),
        eq(medications.userId, req.userId!)
      )
    )
    .get();

  if (!existing) {
    res.status(404).json({ error: "Medication not found" });
    return;
  }

  const updated = db
    .update(medications)
    .set({
      remainingPillCount: parsed.data.newCount,
      totalPillCount: parsed.data.newCount,
    })
    .where(eq(medications.id, existing.id))
    .returning()
    .get();

  res.json(updated);
});

export default router;
