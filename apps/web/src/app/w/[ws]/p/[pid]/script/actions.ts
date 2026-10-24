"use server";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@shotpilot/database";
import { addScriptVersion, runScriptAnalysisJob, startScriptAnalysis } from "@shotpilot/api";
import { resolveProvider } from "@shotpilot/ai";
import { requireCtx } from "@/lib/server";
import { toActionError, type ActionState } from "@/lib/action-result";

export async function addScriptAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const projectId = String(form.get("projectId"));
    const file = form.get("file");
    const upload = file instanceof File && file.size > 0 ? { filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : undefined;
    const version = await addScriptVersion(ctx, projectId, {
      scriptId: form.get("scriptId") || undefined,
      title: form.get("title") || undefined,
      text: upload ? undefined : String(form.get("text") ?? ""),
    }, upload);
    revalidatePath(`/w/${form.get("ws")}/p/${projectId}`, "layout");
    return { ok: true, message: `Saved as version ${version.version}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function analyseAction(_: ActionState, form: FormData): Promise<ActionState> {
  let dest: string;
  try {
    const ctx = await requireCtx();
    const provider = resolveProvider();
    const { job, created } = await startScriptAnalysis(ctx, String(form.get("versionId")), {
      provider,
      idempotencyKey: String(form.get("idempotencyKey") || randomUUID()),
    });
    // Long-running analysis continues after the response is sent; the job page polls its status.
    if (created) after(() => runScriptAnalysisJob(getDb(), job.id, provider).then(() => undefined));
    dest = `/w/${form.get("ws")}/p/${form.get("projectId")}/jobs/${job.id}`;
  } catch (e) {
    return toActionError(e);
  }
  redirect(dest);
}
