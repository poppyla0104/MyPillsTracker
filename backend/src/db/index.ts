/**
 * SQLite database connection.
 * Uses WAL journal mode for better concurrent read performance
 * and enforces foreign key constraints at the connection level.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "path";

const dbPath = path.join(
  import.meta.dirname ?? __dirname,
  "../../data/med-reminder.db"
);
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
