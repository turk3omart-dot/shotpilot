/**
 * Seeds clearly-marked DEMO data into the database in DATABASE_URL.
 * Demo rows have users.is_demo / workspaces.is_demo = true and use the
 * example.test email domain, so they can never be confused with real data.
 *
 *   pnpm db:seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { eq } from "drizzle-orm";
import { HeuristicProvider } from "@shotpilot/ai";
import { getDb, users, workspaces } from "@shotpilot/database";
import {
  addProjectMember, addScriptVersion, createProject, createWorkspace, generateBudget, runScriptAnalysisJob, signUp, startScriptAnalysis,
} from "@shotpilot/api";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_PASSWORD = "shotpilot-demo-2026";

async function main() {
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.email, "producer@demo.example.test") });
  if (existing) {
    console.log("Demo data already present. Sign in as producer@demo.example.test /", DEMO_PASSWORD);
    process.exit(0);
  }
  const mk = async (name: string, email: string) => {
    const { user } = await signUp({ db, userId: null }, { name, email, password: DEMO_PASSWORD }, { ip: `seed-${email}` });
    await db.update(users).set({ isDemo: true }).where(eq(users.id, user.id));
    return user;
  };
  const producer = await mk("Noura Al-Harbi (demo)", "producer@demo.example.test");
  const camera = await mk("Faisal Camera (demo)", "camera@demo.example.test");
  const client = await mk("Client Reviewer (demo)", "client@demo.example.test");
  const ctx = { db, userId: producer.id };

  const ws = await createWorkspace(ctx, { name: "Demo — Desert Light Productions", slug: "demo-desert-light" });
  await db.update(workspaces).set({ isDemo: true }).where(eq(workspaces.id, ws.id));
  const project = await createProject(ctx, ws.id, { name: "The Last Light", type: "short_film", description: "Demo project. A photographer chases one last frame in AlUla." });
  await addProjectMember(ctx, project.id, { email: camera.email, role: "camera_operator" });
  await addProjectMember(ctx, project.id, { email: client.email, role: "client" });

  const text = readFileSync(path.join(root, "tests/fixtures/the-last-light.fountain"), "utf8");
  const version = await addScriptVersion(ctx, project.id, { title: "The Last Light — shooting script" }, { filename: "the-last-light.fountain", bytes: new TextEncoder().encode(text) });
  const provider = new HeuristicProvider();
  const { job } = await startScriptAnalysis(ctx, version.id, { provider });
  const result = (await runScriptAnalysisJob(db, job.id, provider)) as { breakdownId?: string };
  if (result.breakdownId) await generateBudget(ctx, project.id, { breakdownId: result.breakdownId, scenario: "standard" });

  console.log(`Demo data created. Password for all demo users: ${DEMO_PASSWORD}
  producer@demo.example.test  (workspace owner / producer)
  camera@demo.example.test    (camera operator — cannot see budgets)
  client@demo.example.test    (client — cannot see scripts or breakdowns)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
