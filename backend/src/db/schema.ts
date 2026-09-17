/**
 * Database schema definitions using Drizzle ORM (PostgreSQL).
 *
 * Four tables model the medication tracking domain:
 * - users: account info and per-user refill threshold settings
 * - medications: each medication a user tracks (name, dosage, pill counts)
 * - schedules: the specific times of day a medication should be taken
 * - dose_logs: audit trail of every scheduled dose (pending -> taken/missed)
 */

import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // How many days before running out to trigger a refill reminder
  refillThresholdDays: integer("refill_threshold_days").notNull().default(5),
  timezone: text("timezone").notNull().default("America/Denver"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(), // e.g. "500mg", "20mg"
  frequency: integer("frequency").notNull(), // doses per day
  totalPillCount: integer("total_pill_count").notNull(), // original bottle count
  remainingPillCount: integer("remaining_pill_count").notNull(), // decremented on each confirmed dose
  active: boolean("active").notNull().default(true), // soft-delete flag
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * One row per scheduled time for a medication.
 * A medication taken 3x/day has 3 schedule rows (e.g. 08:00, 14:00, 20:00).
 */
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id")
    .notNull()
    .references(() => medications.id),
  timeOfDay: text("time_of_day").notNull(), // "HH:MM" in 24h format
  label: text("label").notNull(), // human-readable: "morning", "evening", "bedtime"
  enabled: boolean("enabled").notNull().default(true),
});

/**
 * Audit trail for every dose event.
 * The scheduler creates a "pending" row at the scheduled time.
 * User confirmation flips it to "taken" and decrements the pill count.
 * A sweep job flips unclaimed "pending" rows to "missed" after 2 hours.
 */
export const doseLogs = pgTable("dose_logs", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id")
    .notNull()
    .references(() => medications.id),
  scheduleId: integer("schedule_id")
    .notNull()
    .references(() => schedules.id),
  status: text("status", { enum: ["pending", "taken", "missed"] })
    .notNull()
    .default("pending"),
  // Stored as text ("2026-09-17T08:00:00") for straightforward string comparison in queries
  scheduledAt: text("scheduled_at").notNull(),
  takenAt: text("taken_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
