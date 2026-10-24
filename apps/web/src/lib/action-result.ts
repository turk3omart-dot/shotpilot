import { ZodError } from "zod";
import { DomainError } from "@shotpilot/shared";

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string; conflict?: boolean } | null;

/** Converts expected errors into a user-facing message. Unexpected errors are logged and hidden. */
export function toActionError(err: unknown): ActionState {
  if (err instanceof DomainError) return { error: err.message };
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  // Next.js uses thrown errors for redirect()/notFound(); let them propagate.
  if (err && typeof err === "object" && "digest" in err) throw err;
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export function isDomainError(err: unknown, code?: DomainError["code"]): err is DomainError {
  return err instanceof DomainError && (!code || err.code === code);
}
