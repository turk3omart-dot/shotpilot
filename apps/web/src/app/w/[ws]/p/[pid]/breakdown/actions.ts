"use server";
import { revalidatePath } from "next/cache";
import { addElement, answerQuestion, confirmBreakdown, setElementConfirmation, updateScene } from "@shotpilot/api";
import { DomainError } from "@shotpilot/shared";
import { requireCtx } from "@/lib/server";
import { toActionError, type ActionState } from "@/lib/action-result";

const refresh = (form: FormData) => revalidatePath(String(form.get("path") ?? "/"));

export async function updateSceneAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const patch: Record<string, unknown> = {};
    for (const k of ["synopsis", "notes"]) if (form.has(k)) patch[k] = String(form.get(k)).trim() || null;
    for (const k of ["intExt", "timeOfDay", "confirmation"]) if (form.get(k)) patch[k] = form.get(k);
    if (form.has("complexity")) patch.complexity = form.get("complexity") || null;
    await updateScene(ctx, String(form.get("sceneId")), Number(form.get("version")), patch);
    refresh(form);
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError && e.code === "CONFLICT") return { error: e.message, conflict: true };
    return toActionError(e);
  }
}

export async function addElementAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const qty = form.get("quantity");
    await addElement(ctx, String(form.get("sceneId")), {
      category: form.get("category"),
      name: form.get("name"),
      quantity: qty ? Number(qty) : null,
    });
    refresh(form);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function elementDecisionAction(form: FormData) {
  const ctx = await requireCtx();
  await setElementConfirmation(ctx, String(form.get("elementId")), form.get("decision"));
  refresh(form);
}

export async function confirmBreakdownAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await confirmBreakdown(ctx, String(form.get("breakdownId")));
    refresh(form);
    return { ok: true, message: "Breakdown confirmed. It is now the production reference for budgets and scheduling." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function answerQuestionAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await answerQuestion(ctx, String(form.get("questionId")), String(form.get("answer") ?? ""));
    refresh(form);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
