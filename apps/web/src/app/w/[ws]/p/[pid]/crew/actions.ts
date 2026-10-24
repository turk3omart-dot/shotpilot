"use server";
import { revalidatePath } from "next/cache";
import { addProjectMember, removeProjectMember } from "@shotpilot/api";
import { requireCtx } from "@/lib/server";
import { toActionError, type ActionState } from "@/lib/action-result";

export async function addMemberAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const user = await addProjectMember(ctx, String(form.get("projectId")), { email: form.get("email"), role: form.get("role"), title: form.get("title") || undefined });
    revalidatePath(String(form.get("path")));
    return { ok: true, message: `${user.name} added.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeMemberAction(form: FormData) {
  const ctx = await requireCtx();
  await removeProjectMember(ctx, String(form.get("projectId")), String(form.get("userId")));
  revalidatePath(String(form.get("path")));
}
