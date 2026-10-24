"use client";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./ui";

export function SubmitButton({ children, pending, variant = "primary", className, name, value }: { children: React.ReactNode; pending?: string; variant?: ButtonVariant; className?: string; name?: string; value?: string }) {
  const status = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={status.pending} aria-busy={status.pending} className={buttonClass(variant, className)}>
      {status.pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          {pending ?? "Working…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
