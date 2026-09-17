/**
 * Cron scheduler for automated dose management.
 *
 * Three scheduled jobs run in the background:
 * 1. Every minute: create "pending" dose logs when a schedule's time arrives, send reminder emails
 * 2. Every 15 minutes: sweep pending doses older than 2 hours to "missed" status
 * 3. Daily at 9 AM: check pill counts and send refill reminders when running low
 */

import cron from "node-cron";
import { db } from "../db/index.js";
import { doseLogs, medications, schedules, users } from "../db/schema.js";
import { eq, and, lt } from "drizzle-orm";
import { sendDoseReminder, sendRefillReminder } from "./email.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export function startScheduler() {
  // Job 1: Create pending dose logs and send reminder emails every minute
  cron.schedule("* * * * *", () => {
    try {
      createPendingDoses();
    } catch (err) {
      console.error("Dose reminder job failed:", err);
    }
  });

  // Job 2: Mark missed doses every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    try {
      sweepMissedDoses();
    } catch (err) {
      console.error("Missed dose sweep failed:", err);
    }
  });

  // Job 3: Check refill needs daily at 9 AM
  cron.schedule("0 9 * * *", () => {
    try {
      checkRefills();
    } catch (err) {
      console.error("Refill check failed:", err);
    }
  });

  console.log("Scheduler started");
}

/**
 * Finds schedules matching the current HH:MM, creates a pending dose_log
 * for each (if one doesn't already exist for today), and sends a reminder email.
 */
function createPendingDoses() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
  const todayDate = now.toISOString().split("T")[0];

  const activeSchedules = db
    .select({
      schedule: schedules,
      med: medications,
      user: users,
    })
    .from(schedules)
    .innerJoin(medications, eq(schedules.medicationId, medications.id))
    .innerJoin(users, eq(medications.userId, users.id))
    .where(
      and(
        eq(schedules.timeOfDay, currentTime),
        eq(schedules.enabled, true),
        eq(medications.active, true)
      )
    )
    .all();

  for (const { schedule, med, user } of activeSchedules) {
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

    const log = db
      .insert(doseLogs)
      .values({
        medicationId: med.id,
        scheduleId: schedule.id,
        status: "pending",
        scheduledAt,
      })
      .returning()
      .get();

    const confirmUrl = `${FRONTEND_URL}/confirm/${log.id}`;
    sendDoseReminder(user.email, med.name, med.dosage, schedule.label, confirmUrl).catch(
      (err) => console.error(`Failed to send dose email to ${user.email}:`, err)
    );
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

// Alert users when any medication has <= refillThresholdDays of pills left
function checkRefills() {
  const medsWithUsers = db
    .select({
      med: medications,
      user: users,
    })
    .from(medications)
    .innerJoin(users, eq(medications.userId, users.id))
    .where(eq(medications.active, true))
    .all();

  for (const { med, user } of medsWithUsers) {
    const daysLeft =
      med.frequency > 0 ? med.remainingPillCount / med.frequency : Infinity;

    if (daysLeft <= user.refillThresholdDays) {
      sendRefillReminder(
        user.email,
        med.name,
        med.remainingPillCount,
        daysLeft
      ).catch((err) =>
        console.error(`Failed to send refill email to ${user.email}:`, err)
      );
    }
  }
}
