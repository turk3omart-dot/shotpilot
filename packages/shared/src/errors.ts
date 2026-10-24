/** Domain errors. The web layer maps these to HTTP status codes / UI messages. */
export class DomainError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID" | "AI_DISABLED" | "RATE_LIMITED",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const unauthenticated = () => new DomainError("UNAUTHENTICATED", "Sign in required");
// NOT_FOUND is deliberately used for resources in workspaces the caller cannot see,
// so that existence of other organizations' data is never revealed.
export const notFound = (what = "Resource") => new DomainError("NOT_FOUND", `${what} not found`);
export const forbidden = (message = "You do not have access to this") => new DomainError("FORBIDDEN", message);
export const conflict = (message: string, details?: unknown) => new DomainError("CONFLICT", message, details);
export const invalid = (message: string, details?: unknown) => new DomainError("INVALID", message, details);
