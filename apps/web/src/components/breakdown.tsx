"use client";
import { useActionState, useEffect, useState } from "react";
import { ELEMENT_CATEGORIES, INT_EXT, TIME_OF_DAY } from "@shotpilot/shared";
import {
  addElementAction,
  answerQuestionAction,
  confirmBreakdownAction,
  elementDecisionAction,
  updateSceneAction,
} from "@/app/w/[ws]/p/[pid]/breakdown/actions";
import { Alert, Badge, Button, Icon, cx, inputClass, type BadgeTone } from "./ui";
import { SubmitButton } from "./submit-button";

export interface SceneVM {
  id: string;
  number: string;
  heading: string;
  intExt: string;
  timeOfDay: string;
  synopsis: string | null;
  notes: string | null;
  excerpt: string | null;
  complexity: string | null;
  sourceRef: { startLine: number; endLine: number } | null;
  estSetup: [number, number] | null;
  estShoot: [number, number] | null;
  risks: string[];
  assumptions: string[];
  origin: string;
  confidence: string | null;
  confirmation: string;
  version: number;
  location: string | null;
  characters: string[];
  elements: { id: string; category: string; name: string; quantity: number | null; notes: string | null; origin: string; confidence: string | null; confirmation: string; sourceLine: number | null }[];
}

const ORIGIN: Record<string, { label: string; tone: BadgeTone }> = {
  ai: { label: "AI suggestion", tone: "ai" },
  parser: { label: "Found in script", tone: "info" },
  user: { label: "Added by team", tone: "neutral" },
};
export function OriginBadge({ origin, confidence }: { origin: string; confidence?: string | null }) {
  const o = ORIGIN[origin] ?? ORIGIN.user!;
  return (
    <Badge tone={o.tone} title={confidence ? `Confidence: ${confidence}` : undefined}>
      {origin === "ai" ? <Icon name="sparkle" size={11} /> : null}
      {o.label}
      {confidence && origin !== "user" ? <span className="opacity-70">· {confidence}</span> : null}
    </Badge>
  );
}

export function ConfirmationBadge({ value }: { value: string }) {
  if (value === "confirmed") return <Badge tone="ok"><Icon name="check" size={11} />Confirmed</Badge>;
  if (value === "rejected") return <Badge tone="danger">Rejected</Badge>;
  return <Badge tone="warn">Needs review</Badge>;
}

const CATEGORY_LABEL: Record<string, string> = {
  prop: "Props", wardrobe: "Wardrobe", makeup: "Hair & makeup", vehicle: "Vehicles", animal: "Animals", extras: "Extras", sfx: "Special effects",
  vfx: "VFX", drone: "Drone / aerial", equipment: "Equipment", sound: "Sound", production_design: "Production design", safety: "Safety", other: "Other",
};

export function SceneCard({ scene, canEdit, path }: { scene: SceneVM; canEdit: boolean; path: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateSceneAction, null);
  const [elState, elAction] = useActionState(addElementAction, null);
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);
  const grouped = Object.entries(
    scene.elements.reduce<Record<string, SceneVM["elements"]>>((acc, e) => ((acc[e.category] ??= []).push(e), acc), {}),
  );
  const dn = scene.timeOfDay === "NIGHT" ? "bg-[#283353] text-white" : scene.timeOfDay === "UNKNOWN" ? "bg-surface-2 text-ink-2" : "bg-[#fde9b8] text-[#5c3b00]";

  return (
    <article className={cx("rounded-[14px] border bg-surface transition", scene.confirmation === "rejected" ? "border-line opacity-60" : "border-line", open && "shadow-[var(--sp-shadow)]")}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-start">
        <span className="grid h-9 min-w-9 place-items-center rounded-[8px] bg-rail px-2 font-mono text-sm font-semibold text-rail-ink">{scene.number}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" dir="auto">{scene.heading}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
            <span className="rounded bg-surface-2 px-1.5 py-px font-medium text-ink-2">{scene.intExt}</span>
            <span className={cx("rounded px-1.5 py-px font-medium", dn)}>{scene.timeOfDay}</span>
            {scene.characters.length ? <span>{scene.characters.length} cast</span> : null}
            {scene.elements.length ? (() => { const n = scene.elements.filter((e) => e.confirmation !== "rejected").length; return <span>· {n} element{n === 1 ? "" : "s"}</span>; })() : null}
          </span>
        </span>
        <span className="hidden sm:block"><ConfirmationBadge value={scene.confirmation} /></span>
        <Icon name="chevron" size={16} className={cx("text-ink-3 transition-transform rtl:rotate-180", open && "rotate-90 rtl:rotate-90")} />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-line px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge origin={scene.origin} confidence={scene.confidence} />
            <ConfirmationBadge value={scene.confirmation} />
            {scene.sourceRef ? <span className="text-xs text-ink-3">Script lines {scene.sourceRef.startLine}–{scene.sourceRef.endLine}</span> : null}
            {scene.location ? <span className="inline-flex items-center gap-1 text-xs text-ink-3"><Icon name="map" size={12} />{scene.location}</span> : null}
          </div>

          {state?.error ? <Alert tone={state.conflict ? "warn" : "danger"} title={state.conflict ? "Edit conflict" : undefined}>{state.error}</Alert> : null}

          {editing ? (
            <form action={action} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="sceneId" value={scene.id} />
              <input type="hidden" name="version" value={scene.version} />
              <input type="hidden" name="path" value={path} />
              <label className="text-xs font-medium text-ink-2">INT / EXT
                <select name="intExt" defaultValue={scene.intExt} className={`${inputClass} mt-1`}>{INT_EXT.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
              <label className="text-xs font-medium text-ink-2">Time of day
                <select name="timeOfDay" defaultValue={scene.timeOfDay} className={`${inputClass} mt-1`}>{TIME_OF_DAY.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
              <label className="text-xs font-medium text-ink-2 sm:col-span-2">Synopsis
                <textarea name="synopsis" defaultValue={scene.synopsis ?? ""} rows={2} className={`${inputClass} mt-1 h-auto py-2`} dir="auto" />
              </label>
              <label className="text-xs font-medium text-ink-2 sm:col-span-2">Production notes
                <textarea name="notes" defaultValue={scene.notes ?? ""} rows={2} className={`${inputClass} mt-1 h-auto py-2`} dir="auto" />
              </label>
              <label className="text-xs font-medium text-ink-2">Complexity
                <select name="complexity" defaultValue={scene.complexity ?? ""} className={`${inputClass} mt-1`}><option value="">Not set</option><option>low</option><option>medium</option><option>high</option></select>
              </label>
              <div className="flex items-end gap-2">
                <SubmitButton pending="Saving…">Save scene</SubmitButton>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_280px]">
              <div className="space-y-3 text-sm">
                <div><div className="text-xs font-medium text-ink-3">Synopsis</div><p dir="auto" className={scene.synopsis ? "" : "text-ink-3"}>{scene.synopsis ?? "No synopsis yet."}</p></div>
                {scene.notes ? <div><div className="text-xs font-medium text-ink-3">Production notes</div><p dir="auto">{scene.notes}</p></div> : null}
                {scene.estSetup || scene.estShoot ? (
                  <div className="flex gap-6 text-xs text-ink-2">
                    {scene.estSetup ? <span><Icon name="clock" size={12} className="inline" /> Setup {scene.estSetup[0]}–{scene.estSetup[1]} min</span> : null}
                    {scene.estShoot ? <span>Shoot {scene.estShoot[0]}–{scene.estShoot[1]} min</span> : null}
                    {scene.complexity ? <span>Complexity: {scene.complexity}</span> : null}
                  </div>
                ) : null}
                {scene.risks.length ? <div><div className="text-xs font-medium text-ink-3">Risks</div><ul className="list-disc ps-5 text-ink-2">{scene.risks.map((r) => <li key={r}>{r}</li>)}</ul></div> : null}
                {scene.assumptions.length ? <div><div className="text-xs font-medium text-ink-3">Assumptions</div><ul className="list-disc ps-5 text-ink-2">{scene.assumptions.map((r) => <li key={r}>{r}</li>)}</ul></div> : null}
                {scene.characters.length ? (
                  <div><div className="mb-1 text-xs font-medium text-ink-3">Cast</div><div className="flex flex-wrap gap-1.5">{scene.characters.map((c) => <Badge key={c}>{c}</Badge>)}</div></div>
                ) : null}
              </div>
              {scene.excerpt ? (
                <details className="h-fit rounded-[10px] border border-line bg-surface-2/60">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-2">Original script excerpt</summary>
                  <pre dir="auto" className="max-h-72 overflow-auto whitespace-pre-wrap px-3 pb-3 font-mono text-[12px] leading-5 text-ink-2">{scene.excerpt}</pre>
                </details>
              ) : null}
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Production elements</div>
            {grouped.length === 0 ? <p className="text-sm text-ink-3">None identified yet.</p> : (
              <div className="space-y-3">
                {grouped.map(([cat, els]) => (
                  <div key={cat}>
                    <div className="mb-1 text-xs font-medium text-ink-2">{CATEGORY_LABEL[cat] ?? cat}</div>
                    <ul className="divide-y divide-line rounded-[10px] border border-line">
                      {els.map((e) => (
                        <li key={e.id} className={cx("flex flex-wrap items-center gap-2 px-3 py-2 text-sm", e.confirmation === "rejected" && "text-ink-3 line-through")}>
                          <span className="min-w-0 flex-1" dir="auto">{e.name}{e.quantity ? <span className="text-ink-3"> × {e.quantity}</span> : null}
                            {e.notes ? <span className="block text-xs text-ink-3 no-underline">{e.notes}{e.sourceLine ? ` · line ${e.sourceLine}` : ""}</span> : null}
                          </span>
                          <OriginBadge origin={e.origin} confidence={e.confidence} />
                          {canEdit ? (
                            <form action={elementDecisionAction} className="flex gap-1">
                              <input type="hidden" name="elementId" value={e.id} />
                              <input type="hidden" name="path" value={path} />
                              {e.confirmation !== "confirmed" ? <button name="decision" value="confirmed" className="rounded-md p-1 text-ok hover:bg-ok-soft" aria-label={`Confirm ${e.name}`} title="Confirm"><Icon name="check" size={16} /></button> : null}
                              {e.confirmation !== "rejected" ? <button name="decision" value="rejected" className="rounded-md p-1 text-danger hover:bg-danger-soft" aria-label={`Reject ${e.name}`} title="Reject"><Icon name="x" size={16} /></button> : null}
                              {e.confirmation !== "unconfirmed" ? <button name="decision" value="unconfirmed" className="rounded-md px-1.5 text-xs text-ink-3 hover:bg-surface-2" title="Undo">Undo</button> : null}
                            </form>
                          ) : <ConfirmationBadge value={e.confirmation} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {canEdit ? (
              <form action={elAction} className="mt-3 flex flex-wrap gap-2" key={scene.elements.length}>
                <input type="hidden" name="sceneId" value={scene.id} />
                <input type="hidden" name="path" value={path} />
                <select name="category" aria-label="Category" className={`${inputClass} w-full! sm:w-44!`} defaultValue="prop">
                  {ELEMENT_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                </select>
                <input name="name" required placeholder="Add element, e.g. vintage camera" aria-label="Element name" className={`${inputClass} w-auto! min-w-48 flex-1`} dir="auto" />
                <input name="quantity" type="number" min={1} placeholder="Qty" aria-label="Quantity" className={`${inputClass} w-20!`} />
                <SubmitButton variant="secondary" pending="Adding…"><Icon name="plus" size={14} />Add</SubmitButton>
                {elState?.error ? <p className="w-full text-xs text-danger">{elState.error}</p> : null}
              </form>
            ) : null}
          </div>

          {canEdit && !editing ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>Edit scene</Button>
              {scene.confirmation !== "confirmed" ? (
                <form action={action}>
                  <input type="hidden" name="sceneId" value={scene.id} /><input type="hidden" name="version" value={scene.version} /><input type="hidden" name="path" value={path} />
                  <SubmitButton variant="secondary" name="confirmation" value="confirmed" pending="Saving…"><Icon name="check" size={14} />Confirm scene</SubmitButton>
                </form>
              ) : null}
              {scene.confirmation !== "rejected" ? (
                <form action={action}>
                  <input type="hidden" name="sceneId" value={scene.id} /><input type="hidden" name="version" value={scene.version} /><input type="hidden" name="path" value={path} />
                  <SubmitButton variant="ghost" name="confirmation" value="rejected" pending="Saving…">Not a scene / exclude</SubmitButton>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ConfirmBreakdown({ breakdownId, path, unconfirmed }: { breakdownId: string; path: string; unconfirmed: number }) {
  const [state, action] = useActionState(confirmBreakdownAction, null);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="breakdownId" value={breakdownId} />
      <input type="hidden" name="path" value={path} />
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      <SubmitButton pending="Confirming…"><Icon name="check" size={16} />Confirm breakdown{unconfirmed ? ` (${unconfirmed} unreviewed)` : ""}</SubmitButton>
    </form>
  );
}

export function QuestionItem({ q, path, canEdit }: { q: { id: string; question: string; why: string | null; priority: string; answer: string | null }; path: string; canEdit: boolean }) {
  const [state, action] = useActionState(answerQuestionAction, null);
  return (
    <li className="py-3">
      <div className="flex items-start gap-2">
        <Badge tone={q.priority === "high" ? "accent" : "neutral"}>{q.priority}</Badge>
        <div className="flex-1">
          <p className="text-sm font-medium" dir="auto">{q.question}</p>
          {q.why ? <p className="text-xs text-ink-3" dir="auto">{q.why}</p> : null}
          {q.answer ? <p className="mt-1 text-sm text-ok" dir="auto">↳ {q.answer}</p> : canEdit ? (
            <form action={action} className="mt-2 flex gap-2">
              <input type="hidden" name="questionId" value={q.id} /><input type="hidden" name="path" value={path} />
              <input name="answer" required placeholder="Your answer" aria-label="Answer" className={`${inputClass} h-9`} dir="auto" />
              <SubmitButton variant="secondary" pending="…">Answer</SubmitButton>
            </form>
          ) : null}
          {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
        </div>
      </div>
    </li>
  );
}
