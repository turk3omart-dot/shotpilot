"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction } from "@/app/auth-actions";
import { Alert, Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

export function AuthForm({ mode, next }: { mode: "signin" | "signup"; next?: string }) {
  const [state, action] = useActionState(mode === "signin" ? signInAction : signUpAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {mode === "signup" ? (
        <Field label="Full name" htmlFor="name" error={fe.name}>
          <input id="name" name="name" autoComplete="name" required className={inputClass} />
        </Field>
      ) : null}
      <Field label="Email" htmlFor="email" error={fe.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password} hint={mode === "signup" ? "At least 10 characters." : undefined}>
        <input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 10 : 1} className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pending={mode === "signin" ? "Signing in…" : "Creating account…"}>
        {mode === "signin" ? "Sign in" : "Create account"}
      </SubmitButton>
      <p className="text-center text-sm text-ink-2">
        {mode === "signin" ? (
          <>New to ShotPilot? <Link className="font-medium text-accent-strong hover:underline" href="/signup">Create an account</Link></>
        ) : (
          <>Already have an account? <Link className="font-medium text-accent-strong hover:underline" href="/login">Sign in</Link></>
        )}
      </p>
    </form>
  );
}
