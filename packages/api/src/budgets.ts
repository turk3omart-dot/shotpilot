import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  SAMPLE_SA_RATE_CARD,
  breakdowns,
  budgetLineItems,
  budgets,
  characters,
  rateCardItems,
  rateCards,
  sceneCharacters,
  scenes,
  breakdownElements,
  type Executor,
} from "@shotpilot/database";
import { conflict, invalid, notFound } from "@shotpilot/shared";
import { z } from "zod";
import type { ServiceContext } from "./context";
import { requireProject } from "./authz";
import { recordAudit } from "./audit";
import { estimateProduction, type EstimationInput, type RateMap, type Scenario } from "./estimation";

/** Global sample card, created on first use. Workspaces can add their own cards. */
export async function ensureSampleRateCard(db: Executor) {
  const existing = await db.query.rateCards.findFirst({ where: and(isNull(rateCards.workspaceId), eq(rateCards.isSample, true), eq(rateCards.country, "SA")) });
  if (existing) return existing;
  const [card] = await db
    .insert(rateCards)
    .values({ name: SAMPLE_SA_RATE_CARD.name, country: "SA", currency: "SAR", isSample: true, workspaceId: null })
    .returning();
  await db.insert(rateCardItems).values(SAMPLE_SA_RATE_CARD.items.map((i) => ({ ...i, rateCardId: card!.id })));
  return card!;
}

async function pickRateCard(db: Executor, workspaceId: string, country: string, currency: string) {
  const own = await db.query.rateCards.findFirst({
    where: and(eq(rateCards.workspaceId, workspaceId), eq(rateCards.country, country), eq(rateCards.currency, currency)),
    orderBy: desc(rateCards.createdAt),
  });
  if (own) return own;
  const sample = await ensureSampleRateCard(db);
  if (sample.currency !== currency) {
    throw invalid(`No rate card for ${country}/${currency}. Add a rate card for this currency before generating a budget.`);
  }
  return sample;
}

export async function loadEstimationInput(db: Executor, breakdownId: string, country: string, currency: string): Promise<EstimationInput> {
  const sceneRows = await db.select().from(scenes).where(eq(scenes.breakdownId, breakdownId)).orderBy(asc(scenes.sortOrder));
  const ids = sceneRows.map((s) => s.id);
  const els = ids.length ? await db.select().from(breakdownElements).where(inArray(breakdownElements.sceneId, ids)) : [];
  const links = ids.length
    ? await db
        .select({ sceneId: sceneCharacters.sceneId, name: characters.name, hasDialogue: characters.hasDialogue })
        .from(sceneCharacters)
        .innerJoin(characters, eq(characters.id, sceneCharacters.characterId))
        .where(inArray(sceneCharacters.sceneId, ids))
    : [];
  return {
    country,
    currency,
    charactersWithDialogue: [...new Set(links.filter((l) => l.hasDialogue).map((l) => l.name))],
    scenes: sceneRows
      .filter((s) => s.confirmation !== "rejected")
      .map((s) => ({
        number: s.number,
        intExt: s.intExt,
        timeOfDay: s.timeOfDay,
        locationKey: s.locationId,
        lineCount: s.sourceRef ? s.sourceRef.endLine - s.sourceRef.startLine + 1 : 10,
        characterNames: links.filter((l) => l.sceneId === s.id).map((l) => l.name),
        elements: els.filter((e) => e.sceneId === s.id).map((e) => ({ category: e.category, quantity: e.quantity, confirmation: e.confirmation })),
      })),
  };
}

export const GenerateBudgetInput = z.object({
  breakdownId: z.string().uuid(),
  scenario: z.enum(["lean", "standard", "premium"]),
});

/**
 * Creates a NEW draft budget from a breakdown. Existing budgets — and any quoted,
 * committed or actual figures on them — are never modified by generation.
 */
export async function generateBudget(ctx: ServiceContext, projectId: string, raw: unknown) {
  const pa = await requireProject(ctx, projectId, "budget", "edit");
  await requireProject(ctx, projectId, "breakdown", "view");
  const input = GenerateBudgetInput.parse(raw);
  const bd = await ctx.db.query.breakdowns.findFirst({ where: and(eq(breakdowns.id, input.breakdownId), eq(breakdowns.projectId, projectId)) });
  if (!bd) throw notFound("Breakdown");

  return ctx.db.transaction(async (tx) => {
    const card = await pickRateCard(tx, pa.project.workspaceId, pa.project.country, pa.project.currency);
    const items = await tx.select().from(rateCardItems).where(eq(rateCardItems.rateCardId, card.id));
    const rates: RateMap = new Map(items.map((i) => [i.key, { rate: i.rate, unit: i.unit, label: i.label, category: i.category }]));
    const est = estimateProduction(await loadEstimationInput(tx, bd.id, pa.project.country, pa.project.currency), input.scenario as Scenario, rates);
    const assumptions = [...est.assumptions];
    if (card.isSample) assumptions.unshift("Built from SAMPLE rates. These are placeholders, not market quotations — replace with your own rate card before sharing.");
    if (bd.status !== "confirmed") assumptions.unshift("The breakdown behind this estimate has not been confirmed yet.");

    const [budget] = await tx
      .insert(budgets)
      .values({
        projectId,
        name: `${input.scenario[0]!.toUpperCase()}${input.scenario.slice(1)} estimate`,
        scenario: input.scenario,
        currency: pa.project.currency,
        rateCardId: card.id,
        breakdownId: bd.id,
        contingencyPct: est.contingencyPct,
        taxPct: est.taxPct,
        assumptions,
        createdBy: pa.userId,
      })
      .returning();
    if (est.lines.length) {
      await tx.insert(budgetLineItems).values(
        est.lines.map((l, i) => ({
          budgetId: budget!.id,
          projectId,
          section: l.section,
          category: l.category,
          label: l.label,
          quantity: l.quantity,
          units: l.units,
          unit: l.unit,
          rate: l.rate,
          estimated: l.estimated,
          basis: l.basis,
          rateKey: l.rateKey,
          origin: "parser" as const,
          sortOrder: i,
        })),
      );
    }
    await recordAudit(tx, {
      workspaceId: pa.project.workspaceId,
      projectId,
      actorId: pa.userId,
      action: "budget.generated",
      entityType: "budget",
      entityId: budget!.id,
      data: { scenario: input.scenario, breakdownId: bd.id, total: est.total },
    });
    return { budget: budget!, estimate: est, rateCardIsSample: card.isSample };
  });
}

export async function listBudgets(ctx: ServiceContext, projectId: string) {
  await requireProject(ctx, projectId, "budget", "view");
  const rows = await ctx.db
    .select({
      id: budgets.id,
      name: budgets.name,
      scenario: budgets.scenario,
      currency: budgets.currency,
      status: budgets.status,
      createdAt: budgets.createdAt,
      estimated: sql<number>`coalesce(sum(${budgetLineItems.quantity} * ${budgetLineItems.units} * ${budgetLineItems.rate}), 0)::float`,
    })
    .from(budgets)
    .leftJoin(budgetLineItems, eq(budgetLineItems.budgetId, budgets.id))
    .where(eq(budgets.projectId, projectId))
    .groupBy(budgets.id)
    .orderBy(desc(budgets.createdAt));
  return rows;
}

export async function getBudget(ctx: ServiceContext, budgetId: string) {
  const budget = await ctx.db.query.budgets.findFirst({ where: eq(budgets.id, budgetId) });
  if (!budget) throw notFound("Budget");
  const pa = await requireProject(ctx, budget.projectId, "budget", "view");
  const lines = await ctx.db.select().from(budgetLineItems).where(eq(budgetLineItems.budgetId, budgetId)).orderBy(asc(budgetLineItems.sortOrder));
  const card = budget.rateCardId ? await ctx.db.query.rateCards.findFirst({ where: eq(rateCards.id, budget.rateCardId) }) : null;
  const sum = (f: (l: (typeof lines)[number]) => number | null) => lines.reduce((n, l) => n + (f(l) ?? 0), 0);
  const estimated = sum((l) => l.estimated);
  const contingency = (estimated * budget.contingencyPct) / 100;
  const tax = ((estimated + contingency) * budget.taxPct) / 100;
  return {
    budget,
    lines,
    canEdit: pa.access.budget === "edit" && budget.status === "draft",
    rateCardIsSample: card?.isSample ?? false,
    totals: {
      estimated,
      contingency,
      tax,
      total: estimated + contingency + tax,
      quoted: sum((l) => l.quoted),
      approved: sum((l) => l.approved),
      committed: sum((l) => l.committed),
      actual: sum((l) => l.actual),
    },
  };
}

const money = z.number().min(0).max(1e12).nullable();
export const UpdateLineInput = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  quantity: z.number().min(0).max(1e6).optional(),
  units: z.number().min(0).max(1e6).optional(),
  rate: z.number().min(0).max(1e10).optional(),
  quoted: money.optional(),
  approved: money.optional(),
  committed: money.optional(),
  actual: money.optional(),
});

export async function updateBudgetLine(ctx: ServiceContext, lineId: string, expectedVersion: number, raw: unknown) {
  const line = await ctx.db.query.budgetLineItems.findFirst({ where: eq(budgetLineItems.id, lineId) });
  if (!line) throw notFound("Budget line");
  const pa = await requireProject(ctx, line.projectId, "budget", "edit");
  const budget = await ctx.db.query.budgets.findFirst({ where: eq(budgets.id, line.budgetId) });
  if (budget?.status !== "draft") throw invalid("This budget is locked.");
  const patch = UpdateLineInput.parse(raw);
  const q = patch.quantity ?? line.quantity;
  const u = patch.units ?? line.units;
  const r = patch.rate ?? line.rate;
  const [updated] = await ctx.db
    .update(budgetLineItems)
    .set({ ...patch, estimated: Math.round(q * u * r * 100) / 100, origin: "user", version: sql`${budgetLineItems.version} + 1`, updatedAt: new Date() })
    .where(and(eq(budgetLineItems.id, lineId), eq(budgetLineItems.version, expectedVersion)))
    .returning();
  if (!updated) throw conflict("This line was changed by someone else. Reload to see the latest figures.");
  await recordAudit(ctx.db, {
    workspaceId: pa.project.workspaceId,
    projectId: line.projectId,
    actorId: pa.userId,
    action: "budget.line.updated",
    entityType: "budget_line_item",
    entityId: lineId,
    data: { patch, before: { quantity: line.quantity, units: line.units, rate: line.rate, quoted: line.quoted, committed: line.committed, actual: line.actual } },
  });
  return updated;
}



/** Side-by-side Lean / Standard / Premium totals for a breakdown, without saving anything. */
export async function previewScenarios(ctx: ServiceContext, projectId: string, breakdownId: string) {
  const pa = await requireProject(ctx, projectId, "budget", "view");
  await requireProject(ctx, projectId, "breakdown", "view");
  const bd = await ctx.db.query.breakdowns.findFirst({ where: and(eq(breakdowns.id, breakdownId), eq(breakdowns.projectId, projectId)) });
  if (!bd) throw notFound("Breakdown");
  const card = await pickRateCard(ctx.db, pa.project.workspaceId, pa.project.country, pa.project.currency);
  const items = await ctx.db.select().from(rateCardItems).where(eq(rateCardItems.rateCardId, card.id));
  const rates: RateMap = new Map(items.map((i) => [i.key, { rate: i.rate, unit: i.unit, label: i.label, category: i.category }]));
  const input = await loadEstimationInput(ctx.db, bd.id, pa.project.country, pa.project.currency);
  return {
    rateCardIsSample: card.isSample,
    rateCardName: card.name,
    scenarios: (["lean", "standard", "premium"] as const).map((s) => {
      const e = estimateProduction(input, s, rates);
      return { scenario: s, shootDays: e.shootDays, headcount: e.headcount, subtotal: e.subtotal, total: e.total, lineCount: e.lines.length };
    }),
  };
}
