import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  breakdowns,
  callSheetAcks,
  callSheets,
  characters,
  locations,
  projectMembers,
  sceneCharacters,
  scenes,
  scheduleItems,
  shootingDays,
  users,
} from "@shotpilot/database";
import { PROJECT_ROLES, conflict, invalid, notFound } from "@shotpilot/shared";
import { z } from "zod";
import type { ServiceContext } from "./context";
import { requireProject } from "./authz";
import { recordAudit } from "./audit";
import { draftSchedule, shootDates, validateDay, weekendFor, type Conflict, type SchedScene } from "./scheduler";
import { SCENARIO_RULES } from "./estimation";

const PAGE_PLAN = { pagesPerDay: 4, maxLocationsPerDay: 2 };

async function loadSchedScenes(ctx: ServiceContext, breakdownId: string): Promise<(SchedScene & { locationName: string })[]> {
  const rows = await ctx.db
    .select({ s: scenes, loc: locations.name })
    .from(scenes)
    .leftJoin(locations, eq(locations.id, scenes.locationId))
    .where(and(eq(scenes.breakdownId, breakdownId), sql`${scenes.confirmation} <> 'rejected'`))
    .orderBy(asc(scenes.sortOrder));
  const ids = rows.map((r) => r.s.id);
  const links = ids.length
    ? await ctx.db
        .select({ sceneId: sceneCharacters.sceneId, name: characters.name })
        .from(sceneCharacters)
        .innerJoin(characters, eq(characters.id, sceneCharacters.characterId))
        .where(inArray(sceneCharacters.sceneId, ids))
    : [];
  return rows.map((r) => ({
    id: r.s.id,
    number: r.s.number,
    locationKey: r.s.locationId ?? `scene-${r.s.id}`,
    locationName: r.loc ?? "Unspecified",
    timeOfDay: r.s.timeOfDay,
    intExt: r.s.intExt,
    lineCount: r.s.sourceRef ? r.s.sourceRef.endLine - r.s.sourceRef.startLine + 1 : 10,
    characters: links.filter((l) => l.sceneId === r.s.id).map((l) => l.name),
  }));
}

export const DraftScheduleInput = z.object({
  breakdownId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scenario: z.enum(["lean", "standard", "premium"]).default("standard"),
  generalCall: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
});

/**
 * Creates a draft shooting schedule from a breakdown. Replaces the project's existing
 * schedule only if no call sheet has been generated yet; once call sheets exist,
 * regeneration is refused so published information is never silently invalidated.
 */
export async function draftScheduleFromBreakdown(ctx: ServiceContext, projectId: string, raw: unknown) {
  const pa = await requireProject(ctx, projectId, "schedule", "edit");
  await requireProject(ctx, projectId, "breakdown", "view");
  const input = DraftScheduleInput.parse(raw);
  const bd = await ctx.db.query.breakdowns.findFirst({ where: and(eq(breakdowns.id, input.breakdownId), eq(breakdowns.projectId, projectId)) });
  if (!bd) throw notFound("Breakdown");
  const existingSheets = await ctx.db.query.callSheets.findFirst({ where: eq(callSheets.projectId, projectId) });
  if (existingSheets) throw conflict("Call sheets already exist for this project, so the schedule can't be regenerated. Move scenes between days instead.");

  const sceneRows = await loadSchedScenes(ctx, bd.id);
  if (!sceneRows.length) throw invalid("This breakdown has no scenes to schedule.");
  const rules = SCENARIO_RULES[input.scenario];
  const plan = draftSchedule(sceneRows, { pagesPerDay: rules.pagesPerDay, maxLocationsPerDay: rules.maxLocationsPerDay });
  const dates = shootDates(input.startDate, plan.length, weekendFor(pa.project.country));

  return ctx.db.transaction(async (tx) => {
    await tx.delete(shootingDays).where(eq(shootingDays.projectId, projectId));
    for (const [i, ids] of plan.entries()) {
      const [day] = await tx
        .insert(shootingDays)
        .values({ projectId, breakdownId: bd.id, dayNumber: i + 1, shootDate: dates[i]!, generalCall: input.generalCall })
        .returning();
      await tx.insert(scheduleItems).values(ids.map((sceneId, k) => ({ projectId, shootingDayId: day!.id, sceneId, sortOrder: k })));
    }
    await recordAudit(tx, { workspaceId: pa.project.workspaceId, projectId, actorId: pa.userId, action: "schedule.drafted", entityType: "project", entityId: projectId, data: { days: plan.length, scenario: input.scenario } });
    return { days: plan.length };
  });
}

export interface ScheduleDayView {
  id: string;
  dayNumber: number;
  shootDate: string;
  generalCall: string;
  wrapTarget: string;
  notes: string | null;
  version: number;
  scenes: { itemId: string; sceneId: string; number: string; heading: string; intExt: string; timeOfDay: string; locationName: string; characters: string[]; lineCount: number }[];
  conflicts: Conflict[];
  latestCallSheet: { id: string; revision: number; createdAt: Date; outdated: boolean; acks: number } | null;
}

export async function getSchedule(ctx: ServiceContext, projectId: string) {
  const pa = await requireProject(ctx, projectId, "schedule", "view");
  const days = await ctx.db.select().from(shootingDays).where(eq(shootingDays.projectId, projectId)).orderBy(asc(shootingDays.dayNumber));
  const items = days.length
    ? await ctx.db.select().from(scheduleItems).where(eq(scheduleItems.projectId, projectId)).orderBy(asc(scheduleItems.sortOrder))
    : [];
  const bdId = days[0]?.breakdownId;
  const sceneRows = bdId ? await loadSchedScenes(ctx, bdId) : [];
  const headings = new Map(
    (await ctx.db.select({ id: scenes.id, heading: scenes.heading }).from(scenes).where(inArray(scenes.id, items.map((i) => i.sceneId).concat("00000000-0000-0000-0000-000000000000")))).map((r) => [r.id, r.heading]),
  );
  const byId = new Map(sceneRows.map((s) => [s.id, s]));
  const sheets = days.length ? await ctx.db.select().from(callSheets).where(eq(callSheets.projectId, projectId)).orderBy(desc(callSheets.revision)) : [];
  const ackCounts = sheets.length
    ? await ctx.db.select({ id: callSheetAcks.callSheetId, n: sql<number>`count(*)::int` }).from(callSheetAcks).where(inArray(callSheetAcks.callSheetId, sheets.map((s) => s.id))).groupBy(callSheetAcks.callSheetId)
    : [];

  const out: ScheduleDayView[] = [];
  for (const d of days) {
    const dayScenes = items
      .filter((i) => i.shootingDayId === d.id)
      .map((i) => {
        const s = byId.get(i.sceneId);
        return s && { itemId: i.id, sceneId: s.id, number: s.number, heading: headings.get(s.id) ?? "", intExt: s.intExt, timeOfDay: s.timeOfDay, locationName: s.locationName, characters: s.characters, lineCount: s.lineCount };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const latest = sheets.find((s) => s.shootingDayId === d.id);
    const content = await buildCallSheetContent(ctx, pa.project, d, dayScenes);
    out.push({
      id: d.id, dayNumber: d.dayNumber, shootDate: d.shootDate, generalCall: d.generalCall, wrapTarget: d.wrapTarget, notes: d.notes, version: d.version,
      scenes: dayScenes,
      conflicts: validateDay({ dayId: d.id, dayNumber: d.dayNumber, maxLocationsPerDay: PAGE_PLAN.maxLocationsPerDay, pagesPerDay: PAGE_PLAN.pagesPerDay,
        scenes: dayScenes.map((s) => sceneRows.find((r) => r.id === s.sceneId)!) }),
      latestCallSheet: latest ? { id: latest.id, revision: latest.revision, createdAt: latest.createdAt, outdated: latest.contentHash !== hashContent(content), acks: ackCounts.find((a) => a.id === latest.id)?.n ?? 0 } : null,
    });
  }
  const scheduledIds = new Set(items.map((i) => i.sceneId));
  return { days: out, unscheduled: sceneRows.filter((s) => !scheduledIds.has(s.id)).map((s) => ({ id: s.id, number: s.number })), canEdit: pa.access.schedule === "edit" };
}

export async function moveScene(ctx: ServiceContext, itemId: string, toDayId: string, position?: number) {
  const item = await ctx.db.query.scheduleItems.findFirst({ where: eq(scheduleItems.id, itemId) });
  if (!item) throw notFound("Schedule item");
  const pa = await requireProject(ctx, item.projectId, "schedule", "edit");
  const day = await ctx.db.query.shootingDays.findFirst({ where: and(eq(shootingDays.id, toDayId), eq(shootingDays.projectId, item.projectId)) });
  if (!day) throw notFound("Shooting day");
  await ctx.db.transaction(async (tx) => {
    const siblings = (await tx.select().from(scheduleItems).where(eq(scheduleItems.shootingDayId, toDayId)).orderBy(asc(scheduleItems.sortOrder))).filter((s) => s.id !== itemId);
    const at = Math.min(Math.max(position ?? siblings.length, 0), siblings.length);
    siblings.splice(at, 0, item);
    for (const [i, s] of siblings.entries()) await tx.update(scheduleItems).set({ shootingDayId: toDayId, sortOrder: i }).where(eq(scheduleItems.id, s.id));
    await recordAudit(tx, { workspaceId: pa.project.workspaceId, projectId: item.projectId, actorId: pa.userId, action: "schedule.scene_moved", entityType: "schedule_item", entityId: itemId, data: { fromDayId: item.shootingDayId, toDayId } });
  });
}

export const UpdateDayInput = z.object({
  shootDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  generalCall: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  wrapTarget: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function updateShootingDay(ctx: ServiceContext, dayId: string, expectedVersion: number, raw: unknown) {
  const day = await ctx.db.query.shootingDays.findFirst({ where: eq(shootingDays.id, dayId) });
  if (!day) throw notFound("Shooting day");
  const pa = await requireProject(ctx, day.projectId, "schedule", "edit");
  const patch = UpdateDayInput.parse(raw);
  const [u] = await ctx.db
    .update(shootingDays)
    .set({ ...patch, version: sql`${shootingDays.version} + 1`, updatedAt: new Date() })
    .where(and(eq(shootingDays.id, dayId), eq(shootingDays.version, expectedVersion)))
    .returning();
  if (!u) throw conflict("Someone else changed this day. Reload to see their version.");
  await recordAudit(ctx.db, { workspaceId: pa.project.workspaceId, projectId: day.projectId, actorId: pa.userId, action: "schedule.day_updated", entityType: "shooting_day", entityId: dayId, data: { patch } });
  return u;
}

/* ------------------------------- Call sheets ------------------------------ */

type DayRow = typeof shootingDays.$inferSelect;
type ProjectRow = Awaited<ReturnType<typeof requireProject>>["project"];

const hashContent = (c: unknown) => createHash("sha256").update(JSON.stringify(c)).digest("hex");
const CREW_ROLES = PROJECT_ROLES.filter((r) => r !== "client");

/**
 * Call-sheet content is built only from confirmed production data and contains no
 * budget figures and no email addresses. Clients are not listed as crew.
 */
async function buildCallSheetContent(ctx: ServiceContext, project: ProjectRow, day: DayRow, dayScenes: { number: string; heading: string; intExt: string; timeOfDay: string; locationName: string; characters: string[] }[]) {
  const members = await ctx.db
    .select({ name: users.name, role: projectMembers.role, title: projectMembers.title, department: projectMembers.department })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(and(eq(projectMembers.projectId, project.id), inArray(projectMembers.role, CREW_ROLES as unknown as (typeof projectMembers.role.enumValues)[number][])))
    .orderBy(asc(users.name));
  return {
    production: project.name,
    dayNumber: day.dayNumber,
    date: day.shootDate,
    generalCall: day.generalCall,
    wrapTarget: day.wrapTarget,
    notes: day.notes,
    scenes: dayScenes.map((s) => ({ number: s.number, heading: s.heading, intExt: s.intExt, timeOfDay: s.timeOfDay, location: s.locationName, cast: s.characters })),
    locations: [...new Set(dayScenes.map((s) => s.locationName))],
    cast: [...new Set(dayScenes.flatMap((s) => s.characters))].sort(),
    crew: members.map((m) => ({ name: m.name, role: m.role, title: m.title, department: m.department, call: day.generalCall })),
  };
}

export async function generateCallSheet(ctx: ServiceContext, dayId: string) {
  const day = await ctx.db.query.shootingDays.findFirst({ where: eq(shootingDays.id, dayId) });
  if (!day) throw notFound("Shooting day");
  const pa = await requireProject(ctx, day.projectId, "schedule", "edit");
  const sched = await getSchedule(ctx, day.projectId);
  const view = sched.days.find((d) => d.id === dayId)!;
  if (!view.scenes.length) throw invalid("Add at least one scene to this day first.");
  if (view.conflicts.some((c) => c.severity === "error")) throw invalid(`Resolve scheduling errors first: ${view.conflicts.filter((c) => c.severity === "error").map((c) => c.message).join(" ")}`);
  const content = await buildCallSheetContent(ctx, pa.project, day, view.scenes);
  const hash = hashContent(content);
  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${shootingDays} where ${shootingDays.id} = ${dayId} for update`);
    const [last] = await tx.select().from(callSheets).where(eq(callSheets.shootingDayId, dayId)).orderBy(desc(callSheets.revision)).limit(1);
    if (last?.contentHash === hash) return last; // nothing changed: no new revision
    const [sheet] = await tx
      .insert(callSheets)
      .values({ projectId: day.projectId, shootingDayId: dayId, revision: (last?.revision ?? 0) + 1, content, contentHash: hash, createdBy: pa.userId })
      .returning();
    await recordAudit(tx, { workspaceId: pa.project.workspaceId, projectId: day.projectId, actorId: pa.userId, action: "callsheet.generated", entityType: "call_sheet", entityId: sheet!.id, data: { revision: sheet!.revision } });
    return sheet!;
  });
}

export async function getCallSheet(ctx: ServiceContext, callSheetId: string) {
  const sheet = await ctx.db.query.callSheets.findFirst({ where: eq(callSheets.id, callSheetId) });
  if (!sheet) throw notFound("Call sheet");
  const pa = await requireProject(ctx, sheet.projectId, "schedule", "view");
  const acked = await ctx.db.query.callSheetAcks.findFirst({ where: and(eq(callSheetAcks.callSheetId, callSheetId), eq(callSheetAcks.userId, pa.userId)) });
  const ackList = pa.access.crew !== "none"
    ? await ctx.db.select({ name: users.name, at: callSheetAcks.ackedAt }).from(callSheetAcks).innerJoin(users, eq(users.id, callSheetAcks.userId)).where(eq(callSheetAcks.callSheetId, callSheetId))
    : [];
  const newer = await ctx.db.query.callSheets.findFirst({ where: and(eq(callSheets.shootingDayId, sheet.shootingDayId), sql`${callSheets.revision} > ${sheet.revision}`) });
  return { sheet, acknowledged: !!acked, acks: ackList, superseded: !!newer, canEdit: pa.access.schedule === "edit" };
}

export async function acknowledgeCallSheet(ctx: ServiceContext, callSheetId: string) {
  const sheet = await ctx.db.query.callSheets.findFirst({ where: eq(callSheets.id, callSheetId) });
  if (!sheet) throw notFound("Call sheet");
  const pa = await requireProject(ctx, sheet.projectId, "schedule", "view");
  await ctx.db.insert(callSheetAcks).values({ callSheetId, userId: pa.userId }).onConflictDoNothing();
}

/** Creates a view-only share link. The token is shown once; only its hash is stored. */
export async function createShareLink(ctx: ServiceContext, callSheetId: string, days = 7) {
  const sheet = await ctx.db.query.callSheets.findFirst({ where: eq(callSheets.id, callSheetId) });
  if (!sheet) throw notFound("Call sheet");
  const pa = await requireProject(ctx, sheet.projectId, "schedule", "edit");
  if (days < 1 || days > 30) throw invalid("Links last between 1 and 30 days.");
  const token = randomBytes(24).toString("base64url");
  await ctx.db.update(callSheets).set({ shareTokenHash: createHash("sha256").update(token).digest("hex"), shareExpiresAt: new Date(Date.now() + days * 86400_000) }).where(eq(callSheets.id, callSheetId));
  await recordAudit(ctx.db, { workspaceId: pa.project.workspaceId, projectId: sheet.projectId, actorId: pa.userId, action: "callsheet.share_link_created", entityType: "call_sheet", entityId: callSheetId, data: { days } });
  return { token };
}

/** Public lookup by share token. Returns only the frozen snapshot content. */
export async function getCallSheetByToken(db: ServiceContext["db"], token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  const sheet = await db.query.callSheets.findFirst({ where: eq(callSheets.shareTokenHash, hash) });
  if (!sheet || !sheet.shareExpiresAt || sheet.shareExpiresAt < new Date()) return null;
  return { revision: sheet.revision, createdAt: sheet.createdAt, content: sheet.content };
}


