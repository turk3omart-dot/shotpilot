import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "../packages/database/src/client";
import { LocalDiskStorage, createProject, createWorkspace, setStorage, signUp, resetRateLimits, type ServiceContext } from "../packages/api/src/index";

setStorage(new LocalDiskStorage(mkdtempSync(path.join(tmpdir(), "shotpilot-test-"))));

export const db = getDb();
export const ctxFor = (userId: string | null): ServiceContext => ({ db, userId });

export async function makeUser(name = "User") {
  resetRateLimits();
  const { user } = await signUp(ctxFor(null), { name, email: `${name.toLowerCase().replace(/\W/g, "")}-${randomUUID().slice(0, 8)}@example.test`, password: "correct-horse-battery" });
  return user;
}

export async function makeProject(ownerId: string) {
  const ctx = ctxFor(ownerId);
  const ws = await createWorkspace(ctx, { name: "Test Studio", slug: `studio-${randomUUID().slice(0, 8)}` });
  const project = await createProject(ctx, ws.id, { name: "The Last Light", type: "short_film" });
  return { ws, project };
}
