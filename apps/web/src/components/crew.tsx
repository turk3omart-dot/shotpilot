"use client";
import { useActionState } from "react";
import { PROJECT_ROLES } from "@shotpilot/shared";
import { addMemberAction } from "@/app/w/[ws]/p/[pid]/crew/actions";
import { Alert, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

export const roleLabel = (r: string) => r.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function AddMemberForm({ projectId, path }: { projectId: string; path: string }) {
  const [state, action] = useActionState(addMemberAction, null);
  return (
    <form action={action} className="space-y-3" key={state?.message}>
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="path" value={path} />
      <input name="email" type="email" required placeholder="name@company.com" aria-label="Email" className={inputClass} dir="ltr" />
      <select name="role" aria-label="Role" defaultValue="camera_operator" className={inputClass}>
        {PROJECT_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
      </select>
      <input name="title" placeholder="Title (optional), e.g. 1st AC" aria-label="Title" className={inputClass} />
      <SubmitButton pending="Adding…">Add to project</SubmitButton>
      <p className="text-xs text-ink-3">The person needs a ShotPilot account. Email invitations for new people arrive in Phase 4. Their role decides what they can see — budgets stay hidden from crew and cast by default.</p>
    </form>
  );
}
