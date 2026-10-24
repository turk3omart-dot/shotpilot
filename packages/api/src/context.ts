import type { Database } from "@shotpilot/database";

export interface ServiceContext {
  db: Database;
  /** Authenticated user, or null for anonymous calls. Services that need a user call requireUser(). */
  userId: string | null;
}
