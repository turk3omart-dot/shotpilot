import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  breakdownElements,
  breakdowns,
  characters,
  clarifyingQuestions,
  locations,
  sceneCharacters,
  scenes,
  scriptVersions,
  scripts,
} from "@shotpilot/database";
import { ElementInput, UpdateSceneInput, conflict, invalid, notFound } from "@shotpilot/shared";
import { z } from "zod";
import type { ServiceContext } from "./context";
import { requireProject } from "./authz";
import { recordAudit } from "./audit";

export async function listBreakdowns(ctx: ServiceContext, projectId: string) {
  await requireProject(ctx, projectId, "breakdown", "view");
  return ctx.db
    .select({
      id: breakdowns.id,
      status: breakdowns.status,
      providerLabel: breakdowns.providerLabel,
      createdAt: breakdowns.createdAt,
      confirmedAt: breakdowns.confirmedAt,
      scriptTitle: scripts.title,
      scriptVersion: scriptVersions.version,
    })
    .from(breakdowns)
    .innerJoin(scriptVersions, eq(scriptVersions.id, breakdowns.scriptVersionId))
    .innerJoin(scripts, eq(scripts.id, scriptVersions.scriptId))
    .where(eq(breakdowns.projectId, projectId))
    .orderBy(desc(breakdowns.createdAt));
}

/** The breakdown to show by default: newest confirmed or draft. */
export async function getCurrentBreakdownId(ctx: ServiceContext, projectId: string) {
  await requireProject(ctx, projectId, "breakdown", "view");
  const b = await ctx.db.query.breakdowns.findFirst({
    where: and(eq(breakdowns.projectId, projectId), ne(breakdowns.status, "superseded")),
    orderBy: desc(breakdowns.createdAt),
  });
  return b?.id ?? null;
}

export async function getBreakdown(ctx: ServiceContext, breakdownId: string) {
  const bd = await ctx.db.query.breakdowns.findFirst({ where: eq(breakdowns.id, breakdownId) });
  if (!bd) throw notFound("Breakdown");
  const pa = await requireProject(ctx, bd.projectId, "breakdown", "view");
  const version = await ctx.db.query.scriptVersions.findFirst({
    where: eq(scriptVersions.id, bd.scriptVersionId),
    columns: { id: true, version: true, scriptId: true, lineCount: true },
  });
  const sceneRows = await ctx.db.select().from(scenes).where(eq(scenes.breakdownId, breakdownId)).orderBy(asc(scenes.sortOrder));
  const sceneIds = sceneRows.map((s) => s.id);
  const [elements, links, locs, questions] = await Promise.all([
    sceneIds.length ? ctx.db.select().from(breakdownElements).where(inArray(breakdownElements.sceneId, sceneIds)).orderBy(asc(breakdownElements.category), asc(breakdownElements.name)) : [],
    sceneIds.length
      ? ctx.db
          .select({ sceneId: sceneCharacters.sceneId, character: characters })
          .from(sceneCharacters)
          .innerJoin(characters, eq(characters.id, sceneCharacters.characterId))
          .where(inArray(sceneCharacters.sceneId, sceneIds))
      : [],
    ctx.db.select().from(locations).where(eq(locations.projectId, bd.projectId)),
    ctx.db.select().from(clarifyingQuestions).where(eq(clarifyingQuestions.breakdownId, breakdownId)),
  ]);
  const locById = new Map(locs.map((l) => [l.id, l]));
  const charMap = new Map<string, { id: string; name: string; sceneNumbers: string[]; hasDialogue: boolean; confirmation: string }>();
  const scenesOut = sceneRows.map((s) => {
    const chars = links.filter((l) => l.sceneId === s.id).map((l) => l.character);
    for (const c of chars) {
      const e = charMap.get(c.id) ?? { id: c.id, name: c.name, sceneNumbers: [], hasDialogue: c.hasDialogue, confirmation: c.confirmation };
      e.sceneNumbers.push(s.number);
      charMap.set(c.id, e);
    }
    return {
      ...s,
      location: s.locationId ? locById.get(s.locationId) ?? null : null,
      characters: chars.map((c) => ({ id: c.id, name: c.name })),
      elements: elements.filter((e) => e.sceneId === s.id),
    };
  });
  const usedLocations = [...new Set(sceneRows.map((s) => s.locationId).filter(Boolean))].map((id) => {
    const l = locById.get(id!)!;
    return { ...l, sceneNumbers: sceneRows.filter((s) => s.locationId === id).map((s) => s.number) };
  });
  return {
    breakdown: bd,
    scriptVersion: version,
    canEdit: pa.access.breakdown === "edit" && bd.status !== "superseded",
    scenes: scenesOut,
    characters: [...charMap.values()].sort((a, b) => b.sceneNumbers.length - a.sceneNumbers.length || a.name.localeCompare(b.name)),
    locations: usedLocations,
    questions,
  };
}

async function loadSceneForEdit(ctx: ServiceContext, sceneId: string) {
  const scene = await ctx.db.query.scenes.findFirst({ where: eq(scenes.id, sceneId) });
  if (!scene) throw notFound("Scene");
  const pa = await requireProject(ctx, scene.projectId, "breakdown", "edit");
  const bd = await ctx.db.query.breakdowns.findFirst({ where: eq(breakdowns.id, scene.breakdownId) });
  if (bd?.status === "superseded") throw invalid("This breakdown has been superseded by a newer analysis and is read-only.");
  return { scene, pa };
}

/**
 * Updates a scene with optimistic concurrency: the caller sends the version it edited.
 * If someone else saved in between, a CONFLICT error carries the current row instead
 * of silently overwriting it.
 */
export async function updateScene(ctx: ServiceContext, sceneId: string, expectedVersion: number, raw: unknown) {
  const { scene, pa } = await loadSceneForEdit(ctx, sceneId);
  const patch = UpdateSceneInput.parse(raw);
  const userEdited = Object.keys(patch).some((k) => k !== "confirmation");
  const [updated] = await ctx.db
    .update(scenes)
    .set({
      ...patch,
      // A person editing content makes it user-authored and confirmed.
      ...(userEdited ? { origin: "user" as const, confirmation: patch.confirmation ?? ("confirmed" as const) } : {}),
      version: sql`${scenes.version} + 1`,
      updatedBy: pa.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(scenes.id, sceneId), eq(scenes.version, expectedVersion)))
    .returning();
  if (!updated) {
    const current = await ctx.db.query.scenes.findFirst({ where: eq(scenes.id, sceneId) });
    throw conflict("Someone else changed this scene while you were editing. Review their version and re-apply your change.", { current });
  }
  await recordAudit(ctx.db, {
    workspaceId: pa.project.workspaceId,
    projectId: scene.projectId,
    actorId: pa.userId,
    action: "scene.updated",
    entityType: "scene",
    entityId: sceneId,
    data: { fields: Object.keys(patch), before: Object.fromEntries(Object.keys(patch).map((k) => [k, scene[k as keyof typeof scene]])) },
  });
  return updated;
}

export async function addElement(ctx: ServiceContext, sceneId: string, raw: unknown) {
  const { scene, pa } = await loadSceneForEdit(ctx, sceneId);
  const input = ElementInput.parse(raw);
  const [el] = await ctx.db
    .insert(breakdownElements)
    .values({ projectId: scene.projectId, sceneId, ...input, quantity: input.quantity ?? null, notes: input.notes ?? null, origin: "user", confidence: null, confirmation: "confirmed" })
    .returning();
  await recordAudit(ctx.db, { workspaceId: pa.project.workspaceId, projectId: scene.projectId, actorId: pa.userId, action: "element.added", entityType: "breakdown_element", entityId: el!.id });
  return el!;
}

export const ElementDecision = z.enum(["confirmed", "rejected", "unconfirmed"]);

export async function setElementConfirmation(ctx: ServiceContext, elementId: string, decision: unknown) {
  const el = await ctx.db.query.breakdownElements.findFirst({ where: eq(breakdownElements.id, elementId) });
  if (!el) throw notFound("Element");
  const { pa } = await loadSceneForEdit(ctx, el.sceneId);
  const value = ElementDecision.parse(decision);
  await ctx.db.update(breakdownElements).set({ confirmation: value, updatedAt: new Date() }).where(eq(breakdownElements.id, elementId));
  await recordAudit(ctx.db, { workspaceId: pa.project.workspaceId, projectId: el.projectId, actorId: pa.userId, action: `element.${value}`, entityType: "breakdown_element", entityId: elementId });
}

export async function deleteElement(ctx: ServiceContext, elementId: string) {
  const el = await ctx.db.query.breakdownElements.findFirst({ where: eq(breakdownElements.id, elementId) });
  if (!el) throw notFound("Element");
  const { pa } = await loadSceneForEdit(ctx, el.sceneId);
  if (el.origin !== "user") throw invalid("Suggested elements can be rejected but not deleted, so the original analysis stays traceable.");
  await ctx.db.delete(breakdownElements).where(eq(breakdownElements.id, elementId));
  await recordAudit(ctx.db, { workspaceId: pa.project.workspaceId, projectId: el.projectId, actorId: pa.userId, action: "element.deleted", entityType: "breakdown_element", entityId: elementId, data: { name: el.name, category: el.category } });
}

export async function answerQuestion(ctx: ServiceContext, questionId: string, answer: string) {
  const q = await ctx.db.query.clarifyingQuestions.findFirst({ where: eq(clarifyingQuestions.id, questionId) });
  if (!q) throw notFound("Question");
  const pa = await requireProject(ctx, q.projectId, "breakdown", "edit");
  const text = z.string().trim().min(1).max(2000).parse(answer);
  await ctx.db.update(clarifyingQuestions).set({ answer: text, answeredBy: pa.userId, answeredAt: new Date() }).where(eq(clarifyingQuestions.id, questionId));
}

/**
 * Marks a breakdown as the confirmed production breakdown. Remaining unconfirmed
 * scenes become confirmed; rejected elements stay rejected. A previously confirmed
 * breakdown for the project is superseded only by this explicit action.
 */
export async function confirmBreakdown(ctx: ServiceContext, breakdownId: string) {
  const bd = await ctx.db.query.breakdowns.findFirst({ where: eq(breakdowns.id, breakdownId) });
  if (!bd) throw notFound("Breakdown");
  const pa = await requireProject(ctx, bd.projectId, "breakdown", "edit");
  if (bd.status === "superseded") throw invalid("This breakdown has been superseded and can't be confirmed.");
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(breakdowns)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(and(eq(breakdowns.projectId, bd.projectId), eq(breakdowns.status, "confirmed"), ne(breakdowns.id, breakdownId)));
    await tx
      .update(breakdowns)
      .set({ status: "confirmed", confirmedAt: new Date(), confirmedBy: pa.userId, updatedAt: new Date() })
      .where(eq(breakdowns.id, breakdownId));
    await tx
      .update(scenes)
      .set({ confirmation: "confirmed", version: sql`${scenes.version} + 1` })
      .where(and(eq(scenes.breakdownId, breakdownId), eq(scenes.confirmation, "unconfirmed")));
    await recordAudit(tx, { workspaceId: pa.project.workspaceId, projectId: bd.projectId, actorId: pa.userId, action: "breakdown.confirmed", entityType: "breakdown", entityId: breakdownId });
  });
}
