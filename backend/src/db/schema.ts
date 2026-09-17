import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  refillThresholdDays: integer("refill_threshold_days").notNull().default(5),
  timezone: text("timezone").notNull().default("America/Denver"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const medications = sqliteTable("medications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  frequency: integer("frequency").notNull(),
  totalPillCount: integer("total_pill_count").notNull(),
  remainingPillCount: integer("remaining_pill_count").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  medicationId: integer("medication_id")
    .notNull()
    .references(() => medications.id),
  timeOfDay: text("time_of_day").notNull(),
  label: text("label").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const doseLogs = sqliteTable("dose_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  medicationId: integer("medication_id")
    .notNull()
    .references(() => medications.id),
  scheduleId: integer("schedule_id")
    .notNull()
    .references(() => schedules.id),
  status: text("status", { enum: ["pending", "taken", "missed"] })
    .notNull()
    .default("pending"),
  scheduledAt: text("scheduled_at").notNull(),
  takenAt: text("taken_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
c