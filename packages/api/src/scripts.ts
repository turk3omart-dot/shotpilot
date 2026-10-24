import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { files, scriptVersions, scripts } from "@shotpilot/database";
import { KIND_MIME, UploadRejectedError, detectScriptKind, extractText, normalizeText, splitLines, type ScriptSourceKind } from "@shotpilot/ai";
import { invalid, notFound } from "@shotpilot/shared";
import { z } from "zod";
import type { ServiceContext } from "./context";
import { requireProject } from "./authz";
import { recordAudit } from "./audit";
import { getStorage, newStorageKey } from "./storage";

export const AddScriptInput = z.object({
  /** Existing script to add a revision to; omit to create a new script. */
  scriptId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  text: z.string().max(1_500_000).optional(),
});

export interface UploadedFile {
  filename: string;
  bytes: Uint8Array;
}

/**
 * Stores a new immutable script version (pasted text or uploaded document).
 * The original file is kept in private storage; extracted text is stored on the version.
 */
export async function addScriptVersion(ctx: ServiceContext, projectId: string, raw: unknown, file?: UploadedFile) {
  const pa = await requireProject(ctx, projectId, "scripts", "edit");
  const input = AddScriptInput.parse(raw);

  let kind: ScriptSourceKind;
  let text: string;
  try {
    if (file && file.bytes.byteLength > 0) {
      kind = detectScriptKind(file.filename, file.bytes);
      text = await extractText(kind, file.bytes);
    } else if (input.text?.trim()) {
      kind = "pasted";
      text = normalizeText(input.text);
    } else {
      throw invalid("Paste script text or choose a file.");
    }
  } catch (e) {
    if (e instanceof UploadRejectedError) throw invalid(e.message);
    throw e;
  }

  const sha = createHash("sha256").update(text).digest("hex");
  let storedFile: { key: string; sha: string } | null = null;
  if (file && kind !== "pasted") {
    const key = newStorageKey(pa.project.workspaceId, projectId, file.filename.split(".").pop() ?? "bin");
    await getStorage().put(key, file.bytes, KIND_MIME[kind]);
    storedFile = { key, sha: createHash("sha256").update(file.bytes).digest("hex") };
  }

  return ctx.db.transaction(async (tx) => {
    let scriptId = input.scriptId;
    if (scriptId) {
      const s = await tx.query.scripts.findFirst({ where: and(eq(scripts.id, scriptId), eq(scripts.projectId, projectId)) });
      if (!s) throw notFound("Script");
    } else {
      const title = input.title ?? file?.filename.replace(/\.[^.]+$/, "") ?? "Untitled script";
      const [s] = await tx.insert(scripts).values({ projectId, title, createdBy: pa.userId }).returning();
      scriptId = s!.id;
    }
    // Serialise version numbering per script.
    await tx.execute(sql`select id from ${scripts} where ${scripts.id} = ${scriptId} for update`);
    const [last] = await tx
      .select({ v: scriptVersions.version })
      .from(scriptVersions)
      .where(eq(scriptVersions.scriptId, scriptId))
      .orderBy(desc(scriptVersions.version))
      .limit(1);

    let fileId: string | null = null;
    if (storedFile && file) {
      const [f] = await tx
        .insert(files)
        .values({
          workspaceId: pa.project.workspaceId,
          projectId,
          storageKey: storedFile.key,
          filename: file.filename.slice(0, 255),
          mimeType: KIND_MIME[kind],
          sizeBytes: file.bytes.byteLength,
          sha256: storedFile.sha,
          uploadedBy: pa.userId,
        })
        .returning();
      fileId = f!.id;
    }
    const [version] = await tx
      .insert(scriptVersions)
      .values({
        scriptId,
        projectId,
        version: (last?.v ?? 0) + 1,
        sourceKind: kind,
        fileId,
        sourceText: text,
        sourceSha256: sha,
        lineCount: splitLines(text).length,
        createdBy: pa.userId,
      })
      .returning();
    await recordAudit(tx, {
      workspaceId: pa.project.workspaceId,
      projectId,
      actorId: pa.userId,
      action: "script.version.created",
      entityType: "script_version",
      entityId: version!.id,
      data: { version: version!.version, kind },
    });
    return version!;
  });
}

export async function listScripts(ctx: ServiceContext, projectId: string) {
  await requireProject(ctx, projectId, "scripts", "view");
  const rows = await ctx.db
    .select({
      scriptId: scripts.id,
      title: scripts.title,
      versionId: scriptVersions.id,
      version: scriptVersions.version,
      sourceKind: scriptVersions.sourceKind,
      lineCount: scriptVersions.lineCount,
      createdAt: scriptVersions.createdAt,
    })
    .from(scripts)
    .innerJoin(scriptVersions, eq(scriptVersions.scriptId, scripts.id))
    .where(eq(scripts.projectId, projectId))
    .orderBy(desc(scriptVersions.createdAt));
  const byScript = new Map<string, { id: string; title: string; versions: typeof rows }>();
  for (const r of rows) {
    const s = byScript.get(r.scriptId) ?? { id: r.scriptId, title: r.title, versions: [] };
    s.versions.push(r);
    byScript.set(r.scriptId, s);
  }
  return [...byScript.values()];
}

export async function getScriptVersion(ctx: ServiceContext, scriptVersionId: string) {
  const v = await ctx.db.query.scriptVersions.findFirst({ where: eq(scriptVersions.id, scriptVersionId) });
  if (!v) throw notFound("Script version");
  await requireProject(ctx, v.projectId, "scripts", "view");
  return v;
}
