"use client";
import { useActionState, useState } from "react";
import { generateBudgetAction, updateLineAction } from "@/app/w/[ws]/p/[pid]/budget/actions";
import { Alert, Icon, cx } from "./ui";
import { SubmitButton } from "./submit-button";

export function GenerateBudgetForm({ ws, projectId, breakdownId, scenarios, fmt }: {
  ws: string; projectId: string; breakdownId: string;
  scenarios: { scenario: string; shootDays: number; headcount: number; total: number; label: string; totalLabel: string }[];
  fmt?: never;
}) {
  const [state, action] = useActionState(generateBudgetAction, null);
  const [picked, setPicked] = useState("standard");
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="breakdownId" value={breakdownId} />
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Scenario">
        {scenarios.map((s) => (
          <label key={s.scenario} className={cx("cursor-pointer rounded-[14px] border bg-surface p-4 transition", picked === s.scenario ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-line-strong")}>
            <input type="radio" name="scenario" value={s.scenario} checked={picked === s.scenario} onChange={() => setPicked(s.scenario)} className="sr-only" />
            <div className="flex items-center justify-between"><span className="font-semibold">{s.label}</span>{picked === s.scenario ? <Icon name="check" className="text-accent" /> : null}</div>
            <div className="mt-3 text-xl font-semibold tabular-nums">{s.totalLabel}</div>
            <div className="mt-1 text-xs text-ink-3">{s.shootDays} shoot day{s.shootDays === 1 ? "" : "s"} · {s.headcount} people on set</div>
          </label>
        ))}
      </div>
      <SubmitButton pending="Building budget…">Create {picked} budget</SubmitButton>
    </form>
  );
}

export interface LineVM { id: string; label: string; category: string; basis: string | null; quantity: number; units: number; unit: string; rate: number; estimated: number; quoted: number | null; committed: number | null; actual: number | null; version: number; origin: string }

export function BudgetLineRow({ line, canEdit, path, fmt }: { line: LineVM; canEdit: boolean; path: string; fmt: Record<string, string> }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (p: Parameters<typeof updateLineAction>[0], f: FormData) => {
    const r = await updateLineAction(p, f);
    if (r?.ok) setEditing(false);
    return r;
  }, null);
  const cell = "px-3 py-2 text-end tabular-nums whitespace-nowrap";
  const inp = "h-8 w-24 rounded-md border border-line bg-surface px-2 text-end text-sm tabular-nums";
  if (editing) {
    return (
      <tr className="bg-accent-soft/30">
        <td className="px-3 py-2" colSpan={7}>
          <form action={action} className="flex flex-wrap items-end gap-2 text-xs">
            <input type="hidden" name="lineId" value={line.id} /><input type="hidden" name="version" value={line.version} /><input type="hidden" name="path" value={path} />
            <span className="w-full text-sm font-medium">{line.label}</span>
            <label>Qty<input name="quantity" type="number" step="any" min={0} defaultValue={line.quantity} className={inp} /></label>
            <label>× {line.unit}s<input name="units" type="number" step="any" min={0} defaultValue={line.units} className={inp} /></label>
            <label>Rate<input name="rate" type="number" step="any" min={0} defaultValue={line.rate} className={inp} /></label>
            <label>Quoted<input name="quoted" type="number" step="any" min={0} defaultValue={line.quoted ?? ""} className={inp} /></label>
            <label>Committed<input name="committed" type="number" step="any" min={0} defaultValue={line.committed ?? ""} className={inp} /></label>
            <label>Actual<input name="actual" type="number" step="any" min={0} defaultValue={line.actual ?? ""} className={inp} /></label>
            <SubmitButton pending="…" className="h-8">Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="h-8 px-2 text-ink-2">Cancel</button>
            {state?.error ? <p className="w-full text-danger">{state.error}</p> : null}
          </form>
        </td>
      </tr>
    );
  }
  return (
    <tr className="group hover:bg-surface-2/50">
      <td className="px-3 py-2">
        <div className="font-medium">{line.label}{line.origin === "user" ? <span className="ms-1 text-[10px] text-ink-3">(edited)</span> : null}</div>
        {line.basis ? <div className="text-xs text-ink-3">{line.basis}</div> : null}
      </td>
      <td className={cell}>{line.quantity} × {line.units} {line.unit}</td>
      <td className={cell}>{fmt.rate}</td>
      <td className={cx(cell, "font-medium")}>{fmt.estimated}</td>
      <td className={cell}>{fmt.quoted}</td>
      <td className={cell}>{fmt.committed}</td>
      <td className={cell}>
        {fmt.actual}
        {canEdit ? <button onClick={() => setEditing(true)} className="ms-2 rounded px-1.5 text-xs text-accent-strong opacity-100 hover:bg-accent-soft sm:opacity-0 sm:group-hover:opacity-100">Edit</button> : null}
      </td>
    </tr>
  );
}
