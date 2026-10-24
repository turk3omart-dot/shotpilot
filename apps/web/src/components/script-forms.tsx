"use client";
import { useActionState, useId, useState } from "react";
import { addScriptAction, analyseAction } from "@/app/w/[ws]/p/[pid]/script/actions";
import { Alert, Field, Icon, cx, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

export function AddScriptForm({ ws, projectId, scriptId, compact }: { ws: string; projectId: string; scriptId?: string; compact?: boolean }) {
  const [state, action] = useActionState(addScriptAction, null);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const id = useId();
  return (
    <form action={action} className="space-y-4" key={state?.message}>
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <input type="hidden" name="ws" value={ws} />
      <input type="hidden" name="projectId" value={projectId} />
      {scriptId ? <input type="hidden" name="scriptId" value={scriptId} /> : null}
      <div role="tablist" className="inline-flex rounded-[10px] border border-line bg-surface-2 p-0.5 text-sm">
        {(["upload", "paste"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cx("rounded-[8px] px-3 py-1.5", mode === m ? "bg-surface font-medium shadow-sm" : "text-ink-2")}>
            {m === "upload" ? "Upload file" : "Paste text"}
          </button>
        ))}
      </div>
      {!scriptId && !compact ? (
        <Field label="Title" htmlFor={`${id}-title`} hint="Optional — defaults to the file name.">
          <input id={`${id}-title`} name="title" className={inputClass} placeholder="Shooting script" />
        </Field>
      ) : null}
      {mode === "upload" ? (
        <label htmlFor={`${id}-file`} className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-strong bg-surface-2/40 px-6 py-10 text-center hover:border-accent hover:bg-accent-soft/40">
          <Icon name="upload" size={24} className="text-ink-3" />
          <span className="text-sm font-medium">{fileName ?? "Choose a script file"}</span>
          <span className="text-xs text-ink-3">PDF, DOCX, Fountain or TXT · up to 15 MB</span>
          <input id={`${id}-file`} name="file" type="file" accept=".pdf,.docx,.fountain,.txt,.spmd" className="sr-only" required onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
        </label>
      ) : (
        <Field label="Script, treatment or idea" htmlFor={`${id}-text`}>
          <textarea id={`${id}-text`} name="text" rows={12} required className={`${inputClass} h-auto py-2 font-mono text-[13px]`} placeholder={"INT. MAJLIS - NIGHT\n\nA warm room lit by lanterns…"} />
        </Field>
      )}
      <SubmitButton pending="Saving…">{scriptId ? "Save new version" : "Save script"}</SubmitButton>
    </form>
  );
}

export function AnalyseButton({ ws, projectId, versionId, label = "Analyse script", disabledReason }: { ws: string; projectId: string; versionId: string; label?: string; disabledReason?: string }) {
  const [state, action] = useActionState(analyseAction, null);
  const [key] = useState(() => crypto.randomUUID());
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ws" value={ws} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      {state?.error ? <Alert tone="warn">{state.error}</Alert> : null}
      {disabledReason ? <p className="text-xs text-ink-3">{disabledReason}</p> : <SubmitButton pending="Starting analysis…"><Icon name="sparkle" size={16} />{label}</SubmitButton>}
    </form>
  );
}
