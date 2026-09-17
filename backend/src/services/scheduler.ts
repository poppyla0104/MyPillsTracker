/**
 * Cron scheduler for automated dose management.
 *
 * Two scheduled jobs run in the background:
 * 1. Every minute: create "pending" dose logs when a schedule's time arrives
 * 2. Every 15 minutes: sweep pending doses older than 2 hours to "missed" status
 */

import cron from "node-cron";
import { db } from "../db/index.js";
import { doseLogs, medications, schedules } from "../db/schema.js";
import { eq, and, lt } from "drizzle-orm";

export function startScheduler() {
  cron.schedule("* * * * *", () => {
    try {
      createPendingDoses();
    } catch (err) {
      console.error("Dose reminder job failed:", err);
    }
  });

  cron.schedule("*/15 * * * *", () => {
    try {
      sweepMissedDoses();
    } catch (err) {
      console.error("Missed dose sweep failed:", err);
    }
  });

  console.log("Scheduler started");
}

/**
 * Finds schedules matching the current HH:MM, creates a pending dose_log
 * for each (if one doesn't already exist for today).
 */
function createPendingDoses() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayDate = now.toISOString().split("T")[0];

  const activeSchedules = db
    .select({
      schedule: schedules,
      med: medications,
    })
    .from(schedules)
    .innerJoin(medications, eq(schedules.medicationId, medications.id))
    .where(
      and(
        eq(schedules.timeOfDay, currentTime),
        eq(schedules.enabled, true),
        eq(medications.active, true)
      )
    )
    .all();

  for (const { schedule, med } of activeSchedules) {
    const scheduledAt = `${todayDate}T${schedule.timeOfDay}:00`;

    // Prevent duplicate dose logs for the same schedule + date
    const existing = db
      .select()
      .from(doseLogs)
      .where(
        and(
          eq(doseLogs.scheduleId, schedule.id),
          eq(doseLogs.scheduledAt, scheduledAt)
        )
      )
      .get();

    if (existing) continue;

    db.insert(doseLogs)
      .values({
        medicationId: med.id,
        scheduleId: schedule.id,
        status: "pending",
        scheduledAt,
      })
      .run();
  }
}

// Flip any "pending" dose logs older than 2 hours to "missed" (no pill decrement)
function sweepMissedDoses() {
  const twoHoursAgo = new Date();
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

  db.update(doseLogs)
    .set({ status: "missed" })
    .where(
      and(
        eq(doseLogs.status, "pending"),
        lt(doseLogs.scheduledAt, twoHoursAgo.toISOString())
      )
    )
    .run();
}
