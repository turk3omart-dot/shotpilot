import postgres from "postgres";
import { runMigrations } from "../packages/database/src/migrate";

/** Resets the test database (public schema) and applies all migrations. Never points at dev/prod. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://shotpilot:shotpilot@localhost:5432/shotpilot_test";
  if (!/_test(\?|$)/.test(url)) throw new Error(`Refusing to reset a database whose name does not end in _test: ${url}`);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`drop schema if exists public cascade`;
  await sql`drop schema if exists drizzle cascade`;
  await sql`create schema public`;
  await sql.end();
  await runMigrations(url);
}
