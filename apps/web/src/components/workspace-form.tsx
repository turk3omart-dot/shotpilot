"use client";
import { useActionState, useState } from "react";
import { slugify } from "@shotpilot/shared";
import { createWorkspaceAction } from "@/app/workspace-actions";
import { Alert, Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

export function WorkspaceForm() {
  const [state, action] = useActionState(createWorkspaceAction, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Company or team name" htmlFor="name" error={state?.fieldErrors?.name}>
        <input id="name" name="name" required className={inputClass} value={name} placeholder="Desert Light Productions"
          onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
      </Field>
      <Field label="Workspace URL" htmlFor="slug" error={state?.fieldErrors?.slug} hint="Lowercase letters, numbers and dashes.">
        <div className="flex items-center rounded-[10px] border border-line bg-surface-2 ps-3 text-sm text-ink-3 focus-within:border-accent">
          <span dir="ltr">shotpilot.app/w/</span>
          <input id="slug" name="slug" required dir="ltr" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value); }}
            className="h-10 min-w-0 flex-1 rounded-e-[10px] bg-surface px-2 text-ink focus:outline-none" />
        </div>
      </Field>
      <SubmitButton className="w-full" pending="Creating…">Create workspace</SubmitButton>
    </form>
  );
}
