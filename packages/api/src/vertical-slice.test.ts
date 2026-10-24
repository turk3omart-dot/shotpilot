import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { HeuristicProvider, type ScriptAnalysisProvider } from "@shotpilot/ai";
import { breakdowns, scenes } from "@shotpilot/database";
import { ctxFor, db, makeProject, makeUser } from "../../../tests/helpers";
import {
  addElement,
  addScriptVersion,
  confirmBreakdown,
  getBreakdown,
  getProjectOverview,
  runScriptAnalysisJob,
  setElementConfirmation,
  setExternalAiProcessing,
  startScriptAnalysis,
  updateScene,
} from "./index";

const script = readFileSync(new URL("../../../tests/fixtures/the-last-light.fountain", import.meta.url), "utf8");
const heuristic = new HeuristicProvider();

async function analyse(userId: string, versionId: string, provider: ScriptAnalysisProvider = heuristic) {
  const { job } = await startScriptAnalysis(ctxFor(userId), versionId, { provider });
  return runScriptAnalysisJob(db, job.id, provider);
}

describe("vertical slice: workspace → project → script → analysis → breakdown", () => {
  it("persists a reviewable breakdown with provenance", async () => {
    const owner = await makeUser("Producer");
    const { project } = await makeProject(owner.id);
    const ctx = ctxFor(owner.id);

    const v1 = await addScriptVersion(ctx, project.id, {}, { filename: "the-last-light.fountain", bytes: new TextEncoder().encode(script) });
    expect(v1.version).toBe(1);
    expect(v1.sourceKind).toBe("fountain");

    const result = await analyse(owner.id, v1.id);
    expect(result.status).toBe("succeeded");

    const bd = await getBreakdown(ctx, (result as { breakdownId: string }).breakdownId);
    expect(bd.breakdown.providerLabel).toBe("Rule-based parser (no AI)");
    expect(bd.scenes).toHaveLength(5);
    expect(bd.scenes.every((s) => s.origin === "parser" && s.confirmation === "unconfirmed")).toBe(true);
    // Same location used by scenes 3 and 5 is one entity.
    const rock = bd.locations.find((l) => l.name === "ROCK FORMATION");
    expect(rock?.sceneNumbers).toEqual(["3", "5"]);
    expect(bd.characters.find((c) => c.name === "NOURA")?.sceneNumbers).toHaveLength(4);
    expect(bd.questions.length).toBeGreaterThan(0);

    // Edit, add an element, reject a suggestion, confirm.
    const s1 = bd.scenes[0]!;
    const edited = await updateScene(ctx, s1.id, s1.version, { synopsis: "Noura drives into the desert at dawn." });
    expect(edited.origin).toBe("user");
    expect(edited.confirmation).toBe("confirmed");
    await addElement(ctx, s1.id, { category: "prop", name: "Faded photograph", quantity: 1 });
    await setElementConfirmation(ctx, s1.elements[0]!.id, "rejected");
    await confirmBreakdown(ctx, bd.breakdown.id);

    const after = await getBreakdown(ctx, bd.breakdown.id);
    expect(after.breakdown.status).toBe("confirmed");
    expect(after.scenes.every((s) => s.confirmation === "confirmed")).toBe(true);
    expect(after.scenes[0]!.elements.find((e) => e.id === s1.elements[0]!.id)?.confirmation).toBe("rejected");

    const overview = await getProjectOverview(ctx, project.id);
    expect(overview.breakdown?.sceneCount).toBe(5);
  });

  it("a script revision never overwrites a confirmed breakdown", async () => {
    const owner = await makeUser("Producer");
    const { project } = await makeProject(owner.id);
    const ctx = ctxFor(owner.id);
    const v1 = await addScriptVersion(ctx, project.id, { title: "Draft", text: script });
    const r1 = (await analyse(owner.id, v1.id)) as { breakdownId: string };
    const bd1 = await getBreakdown(ctx, r1.breakdownId);
    await updateScene(ctx, bd1.scenes[0]!.id, bd1.scenes[0]!.version, { notes: "Approved by director" });
    await confirmBreakdown(ctx, r1.breakdownId);

    const revised = script.replace(/5 EXT\. ROCK FORMATION - NIGHT 5[\s\S]*$/, "FADE OUT.");
    const v2 = await addScriptVersion(ctx, project.id, { scriptId: v1.scriptId, text: revised });
    expect(v2.version).toBe(2);
    const r2 = (await analyse(owner.id, v2.id)) as { breakdownId: string };

    const old = await getBreakdown(ctx, r1.breakdownId);
    expect(old.breakdown.status).toBe("confirmed");
    expect(old.scenes).toHaveLength(5);
    expect(old.scenes[0]!.notes).toBe("Approved by director");
    const fresh = await getBreakdown(ctx, r2.breakdownId);
    expect(fresh.breakdown.status).toBe("draft");
    expect(fresh.scenes).toHaveLength(4);
  });

  it("two users editing the same scene do not silently overwrite each other", async () => {
    const owner = await makeUser("Producer");
    const { project } = await makeProject(owner.id);
    const v1 = await addScriptVersion(ctxFor(owner.id), project.id, { text: script });
    const r = (await analyse(owner.id, v1.id)) as { breakdownId: string };
    const [scene] = await db.select().from(scenes).where(eq(scenes.breakdownId, r.breakdownId)).limit(1);
    await updateScene(ctxFor(owner.id), scene!.id, scene!.version, { notes: "first" });
    await expect(updateScene(ctxFor(owner.id), scene!.id, scene!.version, { notes: "second (stale)" })).rejects.toMatchObject({ code: "CONFLICT" });
    const [current] = await db.select().from(scenes).where(eq(scenes.id, scene!.id));
    expect(current!.notes).toBe("first");
  });

  it("a failing AI provider leaves no partial breakdown", async () => {
    const owner = await makeUser("Producer");
    const { project } = await makeProject(owner.id);
    const v1 = await addScriptVersion(ctxFor(owner.id), project.id, { text: script });
    const failing: ScriptAnalysisProvider = { id: "test-failing", label: "Failing", external: false, isAI: true, analyzeScript: async () => { throw new Error("upstream timeout"); } };
    const res = await analyse(owner.id, v1.id, failing);
    expect(res.status).toBe("failed");
    expect(await db.select().from(breakdowns).where(eq(breakdowns.projectId, project.id))).toHaveLength(0);
  });

  it("invalid AI output is rejected by validation and discarded", async () => {
    const owner = await makeUser("Producer");
    const { project } = await makeProject(owner.id);
    const v1 = await addScriptVersion(ctxFor(owner.id), project.id, { text: script });
    const garbage: ScriptAnalysisProvider = {
      id: "test-garbage", label: "Garbage", external: false, isAI: true,
      analyzeScript: async () => ({ analysis: { scenes: [{ number: "1", intExt: "SPACE" }] } as never, usage: {}, model: "x" }),
    };
    const res = await analyse(owner.id, v1.id, garbage);
    expect(res.status).toBe("failed");
    expect((res as { error: string }).error).toMatch(/failed validation/);
    expect(await db.select().from(breakdowns).where(eq(breakdowns.projectId, project.id))).toHaveLength(0);
  });

  it("refuses external AI processing until the workspace owner opts in", async () => {
    const owner = await makeUser("Owner");
    const { ws, project } = await makeProject(owner.id);
    const v1 = await addScriptVersion(ctxFor(owner.id), project.id, { text: script });
    const external: ScriptAnalysisProvider = { ...heuristic, id: "test-external", label: "External", external: true, isAI: true, analyzeScript: heuristic.analyzeScript.bind(heuristic) };
    await expect(startScriptAnalysis(ctxFor(owner.id), v1.id, { provider: external })).rejects.toMatchObject({ code: "AI_DISABLED" });
    await setExternalAiProcessing(ctxFor(owner.id), ws.id, true);
    const { job } = await startScriptAnalysis(ctxFor(owner.id), v1.id, { provider: external });
    expect(job.external).toBe(true);
  });

  it("idempotency key returns the same job instead of creating a duplicate", async () => {
    const owner = await makeUser("Producer");
    const { project } = await makeProject(owner.id);
    const v1 = await addScriptVersion(ctxFor(owner.id), project.id, { text: script });
    const a = await startScriptAnalysis(ctxFor(owner.id), v1.id, { provider: heuristic, idempotencyKey: "k-1" });
    const b = await startScriptAnalysis(ctxFor(owner.id), v1.id, { provider: heuristic, idempotencyKey: "k-1" });
    expect(b.job.id).toBe(a.job.id);
    expect(b.created).toBe(false);
  });
});
