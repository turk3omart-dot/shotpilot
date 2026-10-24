"use client";
import { useActionState } from "react";
import { setAiProcessingAction } from "@/app/workspace-actions";
import { Alert } from "./ui";
import { SubmitButton } from "./submit-button";

export function AiConsentForm({ workspace, enabled, isOwner, providerLabel, providerExternal }: { workspace: string; enabled: boolean; isOwner: boolean; providerLabel: string; providerExternal: boolean }) {
  const [state, action] = useActionState(setAiProcessingAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <input type="hidden" name="workspace" value={workspace} />
      <div className="text-sm text-ink-2">
        Analysis provider on this server: <span className="font-medium text-ink">{providerLabel}</span>
        {providerExternal ? " — sends script text to Anthropic for processing." : " — runs entirely on ShotPilot's server; nothing leaves it."}
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="enabled" defaultChecked={enabled} disabled={!isOwner} className="mt-1 h-4 w-4 accent-[var(--sp-accent)]" />
        <span className="text-sm"><span className="font-medium">Allow external AI processing</span><br />
          <span className="text-ink-2">Scripts and project text from this workspace may be sent to the configured AI provider (Anthropic Claude) to generate breakdowns. Results are labelled as AI suggestions and must be reviewed.</span></span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="acknowledge" disabled={!isOwner} className="mt-1 h-4 w-4 accent-[var(--sp-accent)]" />
        <span className="text-sm text-ink-2">I am authorised to share this workspace&apos;s scripts with the AI provider under our confidentiality obligations.</span>
      </label>
      {isOwner ? <SubmitButton variant="secondary" pending="Saving…">Save</SubmitButton> : <p className="text-xs text-ink-3">Only the workspace owner can change this.</p>}
    </form>
  );
}
