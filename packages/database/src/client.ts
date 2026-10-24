import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export type Database = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run queries: the root client or a transaction. */
export type Executor = Database | Tx;

const globalForDb = globalThis as unknown as { __shotpilotDb?: { db: Database; sql: postgres.Sql } };

export function createDb(url: string, opts: { max?: number } = {}) {
  const sql = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  return { db: drizzle(sql, { schema }), sql };
}

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getDb(): Database {
  if (!globalForDb.__shotpilotDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
    globalForDb.__shotpilotDb = createDb(url);
  }
  return globalForDb.__shotpilotDb.db;
}
