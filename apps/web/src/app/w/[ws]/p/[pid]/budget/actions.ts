"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateBudget, updateBudgetLine } from "@shotpilot/api";
import { DomainError } from "@shotpilot/shared";
import { requireCtx } from "@/lib/server";
import { toActionError, type ActionState } from "@/lib/action-result";

export async function generateBudgetAction(_: ActionState, form: FormData): Promise<ActionState> {
  let dest: string;
  try {
    const ctx = await requireCtx();
    const projectId = String(form.get("projectId"));
    const { budget } = await generateBudget(ctx, projectId, { breakdownId: form.get("breakdownId"), scenario: form.get("scenario") });
    dest = `/w/${form.get("ws")}/p/${projectId}/budget/${budget.id}`;
  } catch (e) {
    return toActionError(e);
  }
  redirect(dest);
}

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

export async function updateLineAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await updateBudgetLine(ctx, String(form.get("lineId")), Number(form.get("version")), {
      quantity: num(form.get("quantity")) ?? undefined,
      units: num(form.get("units")) ?? undefined,
      rate: num(form.get("rate")) ?? undefined,
      quoted: num(form.get("quoted")),
      committed: num(form.get("committed")),
      actual: num(form.get("actual")),
    });
    revalidatePath(String(form.get("path")));
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError && e.code === "CONFLICT") return { error: e.message };
    return toActionError(e);
  }
}
