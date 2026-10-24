"use client";
import { useActionState } from "react";
import { PROJECT_TYPES } from "@shotpilot/shared";
import { createProjectAction } from "@/app/workspace-actions";
import { Alert, Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import { projectTypeLabel } from "./project-card";

export function ProjectForm({ workspace, country, currency }: { workspace: string; country: string; currency: string }) {
  const [state, action] = useActionState(createProjectAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="workspace" value={workspace} />
      <Field label="Project name" htmlFor="name" error={fe.name}>
        <input id="name" name="name" required autoFocus className={inputClass} placeholder="The Last Light" />
      </Field>
      <Field label="What are you making?" htmlFor="type" error={fe.type}>
        <select id="type" name="type" className={inputClass} defaultValue="short_film">
          {PROJECT_TYPES.map((t) => <option key={t} value={t}>{projectTypeLabel(t)}</option>)}
        </select>
      </Field>
      <Field label="Short description" htmlFor="description" hint="Optional. Who it's for, tone, anything the team should know.">
        <textarea id="description" name="description" rows={3} className={`${inputClass} h-auto py-2`} />
      </Field>
      <details className="rounded-[10px] border border-line bg-surface-2/50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-2">Production country and currency ({country} · {currency})</summary>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Country (ISO code)" htmlFor="country" error={fe.country}>
            <input id="country" name="country" defaultValue={country} maxLength={2} className={`${inputClass} uppercase`} dir="ltr" />
          </Field>
          <Field label="Currency" htmlFor="currency" error={fe.currency}>
            <input id="currency" name="currency" defaultValue={currency} maxLength={3} className={`${inputClass} uppercase`} dir="ltr" />
          </Field>
        </div>
      </details>
      <SubmitButton pending="Creating project…">Create project</SubmitButton>
    </form>
  );
}
