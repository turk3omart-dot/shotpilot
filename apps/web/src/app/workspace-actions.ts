"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createProject, createWorkspace, getWorkspace, setExternalAiProcessing } from "@shotpilot/api";
import { requireCtx } from "@/lib/server";
import { toActionError, type ActionState } from "@/lib/action-result";

export async function createWorkspaceAction(_: ActionState, form: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const ctx = await requireCtx();
    const ws = await createWorkspace(ctx, { name: form.get("name"), slug: form.get("slug") });
    slug = ws.slug;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/w/${slug}`);
}

export async function createProjectAction(_: ActionState, form: FormData): Promise<ActionState> {
  let dest: string;
  try {
    const ctx = await requireCtx();
    const { workspace } = await getWorkspace(ctx, String(form.get("workspace")));
    const project = await createProject(ctx, workspace.id, {
      name: form.get("name"),
      type: form.get("type"),
      description: form.get("description") || null,
      country: form.get("country") || workspace.defaultCountry,
      currency: form.get("currency") || workspace.defaultCurrency,
    });
    dest = `/w/${workspace.slug}/p/${project.id}/script`;
  } catch (e) {
    return toActionError(e);
  }
  redirect(dest);
}

export async function setAiProcessingAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const { workspace } = await getWorkspace(ctx, String(form.get("workspace")));
    const enable = form.get("enabled") === "on";
    if (enable && form.get("acknowledge") !== "on") return { error: "Please confirm you understand how script data is processed." };
    await setExternalAiProcessing(ctx, workspace.id, enable);
    revalidatePath(`/w/${workspace.slug}`, "layout");
    return { ok: true, message: enable ? "External AI processing enabled." : "External AI processing disabled." };
  } catch (e) {
    return toActionError(e);
  }
}
