import { and, eq, inArray } from "drizzle-orm";
import {
  aiJobs,
  breakdownElements,
  breakdowns,
  characters,
  clarifyingQuestions,
  locations,
  projects,
  sceneCharacters,
  scenes,
  scriptVersions,
  workspaces,
  type Database,
} from "@shotpilot/database";
import { normalizeName, parseScreenplay, resolveProvider, type ScriptAnalysisProvider } from "@shotpilot/ai";
import { DomainError, ScriptAnalysis, notFound, type Origin, type SourceRef } from "@shotpilot/shared";
import type { ServiceContext } from "./context";
import { requireProject } from "./authz";
import { recordAudit } from "./audit";

export interface StartAnalysisOptions {
  idempotencyKey?: string;
  provider?: ScriptAnalysisProvider;
}

/**
 * Creates (or returns the existing, for the same idempotency key) an analysis job for
 * a script version. The caller runs it with runScriptAnalysisJob — synchronously in
 * tests, in the background from the web app.
 *
 * External AI providers are refused unless the workspace owner has opted in.
 */
export async function startScriptAnalysis(ctx: ServiceContext, scriptVersionId: string, opts: StartAnalysisOptions = {}) {
  const version = await ctx.db.query.scriptVersions.findFirst({ where: eq(scriptVersions.id, scriptVersionId) });
  if (!version) throw notFound("Script version");
  const pa = await requireProject(ctx, version.projectId, "breakdown", "edit");
  await requireProject(ctx, version.projectId, "scripts", "view");

  const provider = opts.provider ?? resolveProvider();
  const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, pa.project.workspaceId) });
  if (provider.external && !ws?.aiExternalProcessingEnabled) {
    throw new DomainError(
      "AI_DISABLED",
      "AI analysis sends the script to an external AI provider. The workspace owner must enable external AI processing in workspace settings first.",
    );
  }

  if (opts.idempotencyKey) {
    const existing = await ctx.db.query.aiJobs.findFirst({
      where: and(eq(aiJobs.workspaceId, pa.project.workspaceId), eq(aiJobs.idempotencyKey, opts.idempotencyKey)),
    });
    if (existing) return { job: existing, provider, created: false };
  }

  const [job] = await ctx.db
    .insert(aiJobs)
    .values({
      workspaceId: pa.project.workspaceId,
      projectId: pa.project.id,
      kind: "script_analysis",
      provider: provider.id,
      model: provider.isAI && "model" in provider ? String((provider as { model?: string }).model) : null,
      external: provider.external,
      input: { scriptVersionId, providerLabel: provider.label },
      idempotencyKey: opts.idempotencyKey ?? null,
      createdBy: pa.userId,
    })
    .onConflictDoNothing()
    .returning();
  if (!job) {
    // Lost a race on the idempotency key.
    const existing = await ctx.db.query.aiJobs.findFirst({
      where: and(eq(aiJobs.workspaceId, pa.project.workspaceId), eq(aiJobs.idempotencyKey, opts.idempotencyKey!)),
    });
    return { job: existing!, provider, created: false };
  }
  await recordAudit(ctx.db, {
    workspaceId: pa.project.workspaceId,
    projectId: pa.project.id,
    actorId: pa.userId,
    action: "ai.job.created",
    entityType: "ai_job",
    entityId: job.id,
    data: { provider: provider.id, external: provider.external },
  });
  return { job, provider, created: true };
}

/** Clamp model-supplied line references to the real document. */
function clampRef(ref: SourceRef | null | undefined, lineCount: number): SourceRef | null {
  if (!ref) return null;
  const start = Math.min(Math.max(1, ref.startLine), lineCount);
  const end = Math.min(Math.max(start, ref.endLine), lineCount);
  return { startLine: start, endLine: end, quote: ref.quote?.slice(0, 300) };
}

/**
 * Runs an analysis job and persists the result as a NEW draft breakdown.
 * - Output is validated before anything is written; invalid output fails the job.
 * - All writes happen in one transaction: a failure leaves no partial breakdown.
 * - Existing breakdowns (including confirmed ones) are never modified.
 */
export async function runScriptAnalysisJob(db: Database, jobId: string, provider: ScriptAnalysisProvider) {
  const job = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
  if (!job) throw notFound("Job");
  if (job.status !== "queued") return job;
  const claimed = await db
    .update(aiJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(and(eq(aiJobs.id, jobId), eq(aiJobs.status, "queued")))
    .returning();
  if (!claimed.length) return job;

  try {
    const versionId = String(job.input.scriptVersionId);
    const version = await db.query.scriptVersions.findFirst({ where: eq(scriptVersions.id, versionId) });
    const project = version && (await db.query.projects.findFirst({ where: eq(projects.id, version.projectId) }));
    if (!version || !project) throw new Error("Script version no longer exists");

    const result = await provider.analyzeScript({
      text: version.sourceText,
      projectName: project.name,
      projectType: project.type,
      country: project.country,
    });
    const analysis = ScriptAnalysis.parse(result.analysis);
    const origin: Origin = provider.isAI ? "ai" : "parser";

    // Cross-check AI scene count against the deterministic parser.
    const parsed = parseScreenplay(version.sourceText);
    const warnings = [...analysis.warnings];
    if (provider.isAI && parsed.scenes.length > 0 && parsed.scenes.length !== analysis.scenes.length) {
      warnings.push(
        `The script has ${parsed.scenes.length} standard scene headings but the AI returned ${analysis.scenes.length} scenes. Review scene boundaries.`,
      );
    }

    const breakdownId = await db.transaction(async (tx) => {
      // Older unconfirmed drafts are superseded. Confirmed breakdowns are never touched.
      await tx
        .update(breakdowns)
        .set({ status: "superseded", updatedAt: new Date() })
        .where(and(eq(breakdowns.projectId, project.id), inArray(breakdowns.status, ["draft", "in_review"])));
      const [bd] = await tx
        .insert(breakdowns)
        .values({
          projectId: project.id,
          scriptVersionId: version.id,
          aiJobId: job.id,
          providerLabel: provider.label,
          logline: analysis.logline,
          genreGuess: analysis.genreGuess,
          warnings,
        })
        .returning();

      // Project-level entities: one character / location per normalised name (knowledge graph).
      const charIds = new Map<string, string>();
      const allCharNames = new Set([
        ...analysis.characters.map((c) => normalizeName(c.name)),
        ...analysis.scenes.flatMap((s) => s.characters.map(normalizeName)),
      ]);
      for (const name of allCharNames) {
        if (!name) continue;
        const info = analysis.characters.find((c) => normalizeName(c.name) === name);
        await tx
          .insert(characters)
          .values({
            projectId: project.id,
            name,
            normalizedName: name,
            description: info?.description ?? null,
            hasDialogue: info?.hasDialogue ?? false,
            origin,
            confidence: info?.confidence ?? "medium",
          })
          .onConflictDoNothing();
        const row = await tx.query.characters.findFirst({
          where: and(eq(characters.projectId, project.id), eq(characters.normalizedName, name)),
        });
        charIds.set(name, row!.id);
      }

      const locIds = new Map<string, string>();
      for (const s of analysis.scenes) {
        const key = normalizeName(s.location || "UNSPECIFIED");
        if (locIds.has(key)) continue;
        await tx.insert(locations).values({ projectId: project.id, name: s.location || "Unspecified", normalizedName: key, origin }).onConflictDoNothing();
        const row = await tx.query.locations.findFirst({ where: and(eq(locations.projectId, project.id), eq(locations.normalizedName, key)) });
        locIds.set(key, row!.id);
      }

      const lines = version.sourceText.split("\n");
      for (const [i, s] of analysis.scenes.entries()) {
        const ref = clampRef(s.source, version.lineCount)!;
        const [scene] = await tx
          .insert(scenes)
          .values({
            projectId: project.id,
            breakdownId: bd!.id,
            sortOrder: i,
            number: s.number,
            heading: s.heading,
            intExt: s.intExt,
            timeOfDay: s.timeOfDay,
            locationId: locIds.get(normalizeName(s.location || "UNSPECIFIED")) ?? null,
            synopsis: s.synopsis,
            excerpt: lines.slice(ref.startLine - 1, Math.min(ref.endLine, ref.startLine + 30)).join("\n").slice(0, 4000),
            sourceRef: ref,
            complexity: s.complexity,
            estSetupMinMin: s.estSetupMinutes?.min ?? null,
            estSetupMinMax: s.estSetupMinutes?.max ?? null,
            estShootMinMin: s.estShootMinutes?.min ?? null,
            estShootMinMax: s.estShootMinutes?.max ?? null,
            risks: s.risks,
            assumptions: s.assumptions,
            origin,
            confidence: s.confidence,
          })
          .returning();
        const ids = [...new Set(s.characters.map((c) => charIds.get(normalizeName(c))).filter((x): x is string => !!x))];
        if (ids.length) await tx.insert(sceneCharacters).values(ids.map((characterId) => ({ sceneId: scene!.id, characterId })));
        if (s.elements.length) {
          await tx.insert(breakdownElements).values(
            s.elements.map((e) => ({
              projectId: project.id,
              sceneId: scene!.id,
              category: e.category,
              name: e.name,
              quantity: e.quantity,
              notes: e.notes,
              sourceRef: clampRef(e.source, version.lineCount),
              origin,
              confidence: e.confidence,
            })),
          );
        }
      }
      if (analysis.questions.length) {
        await tx.insert(clarifyingQuestions).values(
          analysis.questions.slice(0, 5).map((q) => ({ projectId: project.id, breakdownId: bd!.id, question: q.question, why: q.why, priority: q.priority })),
        );
      }
      await tx
        .update(aiJobs)
        .set({
          status: "succeeded",
          output: analysis,
          model: result.model,
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
          finishedAt: new Date(),
        })
        .where(eq(aiJobs.id, job.id));
      await recordAudit(tx, {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: job.createdBy,
        action: "breakdown.created",
        entityType: "breakdown",
        entityId: bd!.id,
        data: { aiJobId: job.id, scenes: analysis.scenes.length, provider: provider.id },
      });
      return bd!.id;
    });
    return { ...job, status: "succeeded" as const, breakdownId };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "ZodError"
        ? "The analysis output failed validation and was discarded. No data was changed."
        : err instanceof Error
          ? err.message.slice(0, 1000)
          : "Unknown error";
    await db.update(aiJobs).set({ status: "failed", error: message, finishedAt: new Date() }).where(eq(aiJobs.id, jobId));
    return { ...job, status: "failed" as const, error: message };
  }
}

export async function getAiJob(ctx: ServiceContext, jobId: string) {
  const job = await ctx.db.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
  if (!job?.projectId) throw notFound("Job");
  await requireProject(ctx, job.projectId, "breakdown", "view");
  const bd = await ctx.db.query.breakdowns.findFirst({ where: eq(breakdowns.aiJobId, jobId) });
  return { id: job.id, status: job.status, error: job.error, provider: job.provider, breakdownId: bd?.id ?? null, createdAt: job.createdAt, finishedAt: job.finishedAt };
}
