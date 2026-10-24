import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HeuristicProvider } from "@shotpilot/ai";
import { ctxFor, db, makeProject, makeUser } from "../../../tests/helpers";
import {
  addProjectMember,
  addScriptVersion,
  generateBudget,
  getBreakdown,
  getBudget,
  getProjectOverview,
  listProjects,
  listScripts,
  removeProjectMember,
  runScriptAnalysisJob,
  setMemberOverrides,
  startScriptAnalysis,
  updateScene,
} from "./index";

const script = readFileSync(new URL("../../../tests/fixtures/the-last-light.fountain", import.meta.url), "utf8");

async function setup() {
  const producer = await makeUser("Producer");
  const crew = await makeUser("Camera Op");
  const client = await makeUser("Client");
  const outsider = await makeUser("Outsider");
  const { ws, project } = await makeProject(producer.id);
  const p = ctxFor(producer.id);
  await addProjectMember(p, project.id, { email: crew.email, role: "camera_operator" });
  await addProjectMember(p, project.id, { email: client.email, role: "client" });
  const v = await addScriptVersion(p, project.id, { text: script });
  const provider = new HeuristicProvider();
  const { job } = await startScriptAnalysis(p, v.id, { provider });
  const r = (await runScriptAnalysisJob(db, job.id, provider)) as { breakdownId: string };
  const { budget } = await generateBudget(p, project.id, { breakdownId: r.breakdownId, scenario: "standard" });
  return { producer, crew, client, outsider, ws, project, breakdownId: r.breakdownId, budgetId: budget.id };
}

describe("authorization (server-side)", () => {
  it("a crew member cannot access confidential budgets", async () => {
    const s = await setup();
    await expect(getBudget(ctxFor(s.crew.id), s.budgetId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const overview = await getProjectOverview(ctxFor(s.crew.id), s.project.id);
    expect(overview.budgetCount).toBeUndefined();
    expect(overview.access.access.budget).toBe("none");
  });

  it("a crew member can view but not edit the breakdown", async () => {
    const s = await setup();
    const bd = await getBreakdown(ctxFor(s.crew.id), s.breakdownId);
    expect(bd.canEdit).toBe(false);
    const sc = bd.scenes[0]!;
    await expect(updateScene(ctxFor(s.crew.id), sc.id, sc.version, { notes: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a client cannot read scripts, breakdowns or budgets", async () => {
    const s = await setup();
    const c = ctxFor(s.client.id);
    await expect(listScripts(c, s.project.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getBreakdown(c, s.breakdownId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getBudget(c, s.budgetId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getProjectOverview(c, s.project.id)).access.access.conversations).toBe("none");
  });

  it("users from another organisation get NOT_FOUND, never data", async () => {
    const s = await setup();
    const o = ctxFor(s.outsider.id);
    await expect(getProjectOverview(o, s.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBudget(o, s.budgetId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listProjects(o, s.ws.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a removed project member loses access immediately", async () => {
    const s = await setup();
    await getBreakdown(ctxFor(s.crew.id), s.breakdownId);
    await removeProjectMember(ctxFor(s.producer.id), s.project.id, s.crew.id);
    await expect(getBreakdown(ctxFor(s.crew.id), s.breakdownId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listProjects(ctxFor(s.crew.id), s.ws.id)).toHaveLength(0);
  });

  it("explicit overrides can grant or revoke a section", async () => {
    const s = await setup();
    await setMemberOverrides(ctxFor(s.producer.id), s.project.id, s.crew.id, { budget: "view", breakdown: "none" });
    await expect(getBudget(ctxFor(s.crew.id), s.budgetId)).resolves.toBeTruthy();
    await expect(getBreakdown(ctxFor(s.crew.id), s.breakdownId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("unauthenticated calls are rejected", async () => {
    const s = await setup();
    await expect(getProjectOverview(ctxFor(null), s.project.id)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("crew cannot add members to the project", async () => {
    const s = await setup();
    await expect(addProjectMember(ctxFor(s.crew.id), s.project.id, { email: s.outsider.email, role: "producer" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
