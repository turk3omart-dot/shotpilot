import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HeuristicProvider } from "@shotpilot/ai";
import { ctxFor, db, makeProject, makeUser } from "../../../tests/helpers";
import { addScriptVersion, generateBudget, getBudget, runScriptAnalysisJob, startScriptAnalysis, updateBudgetLine, updateScene, getBreakdown } from "./index";
import { estimateProduction, type EstimationInput, type RateMap } from "./estimation";
import { SAMPLE_SA_RATE_CARD } from "@shotpilot/database";

const script = readFileSync(new URL("../../../tests/fixtures/the-last-light.fountain", import.meta.url), "utf8");
const rates: RateMap = new Map(SAMPLE_SA_RATE_CARD.items.map((i) => [i.key, i]));

const input: EstimationInput = {
  country: "SA",
  currency: "SAR",
  charactersWithDialogue: ["A", "B"],
  scenes: [
    { number: "1", intExt: "EXT", timeOfDay: "DAY", locationKey: "l1", lineCount: 60, characterNames: ["A"], elements: [{ category: "drone", quantity: null, confirmation: "unconfirmed" }] },
    { number: "2", intExt: "INT", timeOfDay: "DAY", locationKey: "l2", lineCount: 80, characterNames: ["A", "B"], elements: [] },
    { number: "3", intExt: "EXT", timeOfDay: "NIGHT", locationKey: "l1", lineCount: 40, characterNames: ["B"], elements: [{ category: "extras", quantity: 30, confirmation: "confirmed" }] },
  ],
};

describe("estimation engine", () => {
  it("scenarios differ by resources, in order lean < standard < premium", () => {
    const [l, s, p] = (["lean", "standard", "premium"] as const).map((sc) => estimateProduction(input, sc, rates));
    expect(l!.total).toBeLessThan(s!.total);
    expect(s!.total).toBeLessThan(p!.total);
    expect(p!.headcount).toBeGreaterThan(l!.headcount);
  });

  it("every line is quantity × units × rate with a basis", () => {
    const e = estimateProduction(input, "standard", rates);
    for (const line of e.lines) {
      expect(line.estimated).toBeCloseTo(line.quantity * line.units * line.rate, 2);
      expect(line.basis.length).toBeGreaterThan(0);
    }
    expect(e.lines.find((l) => l.rateKey === "cast.extra")?.quantity).toBe(30);
  });

  it("removing the night scene removes night lighting; rejecting an element removes its cost", () => {
    const base = estimateProduction(input, "standard", rates);
    expect(base.lines.some((l) => l.rateKey === "equip.lighting_night_extra")).toBe(true);
    const noNight = estimateProduction({ ...input, scenes: input.scenes.filter((s) => s.number !== "3") }, "standard", rates);
    expect(noNight.lines.some((l) => l.rateKey === "equip.lighting_night_extra")).toBe(false);
    const rejectedDrone = estimateProduction(
      { ...input, scenes: input.scenes.map((s) => (s.number === "1" ? { ...s, elements: [{ category: "drone", quantity: null, confirmation: "rejected" }] } : s)) },
      "standard",
      rates,
    );
    expect(rejectedDrone.lines.some((l) => l.rateKey === "crew.drone_pilot")).toBe(false);
  });

  it("missing rates are reported, not invented", () => {
    const partial: RateMap = new Map([...rates].filter(([k]) => k !== "crew.dop"));
    const e = estimateProduction(input, "standard", partial);
    expect(e.missingRates).toContain("crew.dop");
    expect(e.lines.some((l) => l.rateKey === "crew.dop")).toBe(false);
  });
});

describe("budgets", () => {
  async function setup() {
    const owner = await makeUser("Producer");
    const { project } = await makeProject(owner.id);
    const ctx = ctxFor(owner.id);
    const v = await addScriptVersion(ctx, project.id, { text: script });
    const provider = new HeuristicProvider();
    const { job } = await startScriptAnalysis(ctx, v.id, { provider });
    const r = (await runScriptAnalysisJob(db, job.id, provider)) as { breakdownId: string };
    return { ctx, project, breakdownId: r.breakdownId };
  }

  it("generates a labelled draft budget from the breakdown", async () => {
    const { ctx, project, breakdownId } = await setup();
    const { budget } = await generateBudget(ctx, project.id, { breakdownId, scenario: "standard" });
    const b = await getBudget(ctx, budget.id);
    expect(b.rateCardIsSample).toBe(true);
    expect(b.budget.assumptions.join(" ")).toMatch(/SAMPLE rates/);
    expect(b.lines.length).toBeGreaterThan(10);
    expect(b.totals.total).toBeGreaterThan(b.totals.estimated);
  });

  it("regenerating after a breakdown change never touches committed or actual costs", async () => {
    const { ctx, project, breakdownId } = await setup();
    const { budget } = await generateBudget(ctx, project.id, { breakdownId, scenario: "standard" });
    const b = await getBudget(ctx, budget.id);
    const line = b.lines[0]!;
    await updateBudgetLine(ctx, line.id, line.version, { committed: 1234, actual: 1000 });

    const bd = await getBreakdown(ctx, breakdownId);
    await updateScene(ctx, bd.scenes[4]!.id, bd.scenes[4]!.version, { confirmation: "rejected" });
    const { budget: b2 } = await generateBudget(ctx, project.id, { breakdownId, scenario: "standard" });
    expect(b2.id).not.toBe(budget.id);

    const original = await getBudget(ctx, budget.id);
    expect(original.lines[0]!.committed).toBe(1234);
    expect(original.lines[0]!.actual).toBe(1000);
  });

  it("stale budget line edits are rejected", async () => {
    const { ctx, project, breakdownId } = await setup();
    const { budget } = await generateBudget(ctx, project.id, { breakdownId, scenario: "lean" });
    const line = (await getBudget(ctx, budget.id)).lines[0]!;
    await updateBudgetLine(ctx, line.id, line.version, { rate: 1 });
    await expect(updateBudgetLine(ctx, line.id, line.version, { rate: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
