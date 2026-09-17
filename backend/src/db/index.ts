/**
 * PostgreSQL database connection using node-postgres connection pool.
 * Reads the connection string from DATABASE_URL env var.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/medreminder",
});

export const db = drizzle(pool, { schema });
