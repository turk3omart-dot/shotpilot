import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { HeuristicProvider } from "@shotpilot/ai";
import { scenes } from "@shotpilot/database";
import { ctxFor, db, makeProject, makeUser } from "../../../tests/helpers";
import {
  acknowledgeCallSheet, addProjectMember, addScriptVersion, createShareLink, draftScheduleFromBreakdown, generateCallSheet, getCallSheet,
  getCallSheetByToken, getSchedule, moveScene, runScriptAnalysisJob, startScriptAnalysis, updateShootingDay,
} from "./index";
import { draftSchedule, shootDates, validateDay, type SchedScene } from "./scheduler";

const script = readFileSync(new URL("../../../tests/fixtures/the-last-light.fountain", import.meta.url), "utf8");
const sc = (id: string, loc: string, tod: string, lines = 20): SchedScene => ({ id, number: id, locationKey: loc, timeOfDay: tod, intExt: "EXT", lineCount: lines, characters: [] });

describe("scheduler rules", () => {
  it("never mixes day and night scenes and groups by location", () => {
    const days = draftSchedule([sc("1", "A", "DAY"), sc("2", "B", "NIGHT"), sc("3", "A", "DAY"), sc("4", "B", "NIGHT")], { pagesPerDay: 4, maxLocationsPerDay: 2 });
    expect(days).toEqual([["1", "3"], ["2", "4"]]);
  });
  it("splits when pages or locations exceed the plan", () => {
    expect(draftSchedule([sc("1", "A", "DAY", 150), sc("2", "A", "DAY", 150)], { pagesPerDay: 4, maxLocationsPerDay: 2 })).toHaveLength(2);
    expect(draftSchedule([sc("1", "A", "DAY"), sc("2", "B", "DAY"), sc("3", "C", "DAY")], { pagesPerDay: 4, maxLocationsPerDay: 2 })).toEqual([["1", "2"], ["3"]]);
  });
  it("flags a day/night mix as an error", () => {
    const c = validateDay({ dayId: "d", dayNumber: 1, pagesPerDay: 4, maxLocationsPerDay: 2, scenes: [sc("1", "A", "DAY"), sc("2", "A", "NIGHT")] });
    expect(c.some((x) => x.code === "day_night_mix" && x.severity === "error")).toBe(true);
  });
  it("skips the Friday-Saturday weekend for Saudi Arabia", () => {
    expect(shootDates("2026-11-05", 3, [5, 6])).toEqual(["2026-11-05", "2026-11-08", "2026-11-09"]); // Thu, Sun, Mon
  });
});

async function setup() {
  const producer = await makeUser("Producer");
  const crew = await makeUser("Gaffer");
  const client = await makeUser("Client");
  const { project } = await makeProject(producer.id);
  const p = ctxFor(producer.id);
  await addProjectMember(p, project.id, { email: crew.email, role: "camera_operator" });
  await addProjectMember(p, project.id, { email: client.email, role: "client" });
  const v = await addScriptVersion(p, project.id, { text: script });
  const provider = new HeuristicProvider();
  const { job } = await startScriptAnalysis(p, v.id, { provider });
  const r = (await runScriptAnalysisJob(db, job.id, provider)) as { breakdownId: string };
  await draftScheduleFromBreakdown(p, project.id, { breakdownId: r.breakdownId, startDate: "2026-11-05" });
  return { producer, crew, client, project, p, breakdownId: r.breakdownId };
}

describe("schedule + call sheets", () => {
  it("drafts a schedule covering every scene exactly once", async () => {
    const { p, project } = await setup();
    const s = await getSchedule(p, project.id);
    expect(s.unscheduled).toHaveLength(0);
    expect(s.days.flatMap((d) => d.scenes).map((x) => x.number).sort()).toEqual(["1", "2", "3", "4", "5"]);
    expect(s.days.every((d) => !d.conflicts.some((c) => c.severity === "error"))).toBe(true);
    expect(s.days.map((d) => d.shootDate)).not.toContain("2026-11-06"); // Friday
  });

  it("a schedule change marks the affected call sheet outdated, and only that one", async () => {
    const { p, project } = await setup();
    let s = await getSchedule(p, project.id);
    const [d1, d2] = s.days;
    const a = await generateCallSheet(p, d1!.id);
    const b = await generateCallSheet(p, d2!.id);
    s = await getSchedule(p, project.id);
    expect(s.days.length).toBeGreaterThanOrEqual(3);
    for (const d of [d1!, d2!]) expect(s.days.find((x) => x.id === d.id)!.latestCallSheet!.outdated).toBe(false);
    const d3 = s.days[2]!; // no call sheet yet
    expect(d3.latestCallSheet).toBeNull();

    // Move a scene from day 1 to day 2 -> both days change.
    await moveScene(p, d1!.scenes[0]!.itemId, d2!.id);
    s = await getSchedule(p, project.id);
    expect(s.days.find((d) => d.id === d1!.id)!.latestCallSheet!.outdated).toBe(true);
    expect(s.days.find((d) => d.id === d2!.id)!.latestCallSheet!.outdated).toBe(true);

    const a2 = await generateCallSheet(p, d1!.id);
    expect(a2.revision).toBe(a.revision + 1);
    expect(b.revision).toBe(1);
    // Regenerating with no change creates no new revision.
    expect((await generateCallSheet(p, d1!.id)).id).toBe(a2.id);
  });

  it("a general call change creates a new revision and is audited via version", async () => {
    const { p, project } = await setup();
    const day = (await getSchedule(p, project.id)).days[0]!;
    const first = await generateCallSheet(p, day.id);
    await updateShootingDay(p, day.id, day.version, { generalCall: "06:30" });
    await expect(updateShootingDay(p, day.id, day.version, { generalCall: "05:00" })).rejects.toMatchObject({ code: "CONFLICT" });
    const second = await generateCallSheet(p, day.id);
    expect(second.revision).toBe(first.revision + 1);
    expect((second.content as { generalCall: string }).generalCall).toBe("06:30");
  });

  it("crew can read and acknowledge; clients cannot see call sheets; call sheets hold no budget or email data", async () => {
    const { p, project, crew, client } = await setup();
    const day = (await getSchedule(p, project.id)).days[0]!;
    const sheet = await generateCallSheet(p, day.id);
    const json = JSON.stringify(sheet.content);
    expect(json).not.toMatch(/@example\.test/);
    expect(json.toLowerCase()).not.toMatch(/budget|rate|SAR/);

    const c = ctxFor(crew.id);
    await acknowledgeCallSheet(c, sheet.id);
    expect((await getCallSheet(c, sheet.id)).acknowledged).toBe(true);
    expect((await getSchedule(p, project.id)).days[0]!.latestCallSheet!.acks).toBe(1);

    await expect(getCallSheet(ctxFor(client.id), sheet.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(generateCallSheet(c, day.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((sheet.content as { crew: { role: string }[] }).crew.some((m) => m.role === "client")).toBe(false);
  });

  it("share links work until they expire and reveal only the snapshot", async () => {
    const { p, project } = await setup();
    const day = (await getSchedule(p, project.id)).days[0]!;
    const sheet = await generateCallSheet(p, day.id);
    expect(await getCallSheetByToken(db, "not-a-token")).toBeNull();
    const { token } = await createShareLink(p, sheet.id, 1);
    expect((await getCallSheetByToken(db, token))?.revision).toBe(1);
    const { callSheets } = await import("@shotpilot/database");
    await db.update(callSheets).set({ shareExpiresAt: new Date(Date.now() - 1000) }).where(eq(callSheets.id, sheet.id));
    expect(await getCallSheetByToken(db, token)).toBeNull();
  });

  it("regenerating the schedule is refused once call sheets exist", async () => {
    const { p, project, breakdownId } = await setup();
    await generateCallSheet(p, (await getSchedule(p, project.id)).days[0]!.id);
    await expect(draftScheduleFromBreakdown(p, project.id, { breakdownId, startDate: "2026-12-01" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
void scenes;
