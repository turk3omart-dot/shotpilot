# Decision log

Format: **ID — decision** · why · alternatives considered.

- **D1 — pnpm monorepo, modular monolith.** One deploy, clear package boundaries, cheap to run. *Alt:* microservices (premature), Nx/Turborepo (unneeded yet).
- **D2 — Next.js 16 App Router + server actions for the web; versioned JSON `/api/v1` for native.** The web gets server components and progressive forms; iOS gets a stable contract. Both call the same `@shotpilot/api` services. *Alt:* tRPC (couples clients to TS), GraphQL (overhead).
- **D3 — Plain PostgreSQL + Drizzle, not Supabase-specific APIs.** Runs locally with no account, stays portable, and Supabase or Neon can host it later. *Alt:* Supabase client and RLS as the primary authz (harder to test; we keep authz in code with tests and may add RLS as defence in depth).
- **D4 — Own session auth (scrypt + hashed DB sessions).** No paid dependency, works offline in dev, and tokens are revocable. *Alt:* Auth.js, Clerk, Supabase Auth. Revisit for SSO/SAML (Enterprise) and passkeys.
- **D5 — Authorization in the service layer, NOT_FOUND across tenants.** A single choke point (`requireProject`), fully unit-tested, with no existence leaks.
- **D6 — Provider-independent AI with an honest non-AI fallback.** Development and tests run without paid APIs, and the UI never passes off parser output as AI. Claude is the default (`claude-opus-5-5`, structured outputs, adaptive thinking, server-side refusal fallback).
- **D7 — External AI requires an explicit, audited workspace-owner opt-in.** Scripts are confidential (PRD 4.2).
- **D8 — Deterministic estimation engine.** Scenario rules plus rate cards; every line has a basis, and missing rates are surfaced. LLMs may explain estimates later but never price them.
- **D9 — Immutable script versions, analyses create new breakdowns.** A revision cannot overwrite confirmed work; the history is traceable.
- **D10 — Optimistic concurrency (`version` columns).** Simple, explicit conflicts; real-time co-editing (CRDT) only where it's truly needed later.
- **D11 — Background jobs via `after()` for now, pg-boss next.** Fastest path to a working slice; the job table is already queue-shaped.
- **D12 — Integration tests against real Postgres** (wiped `*_test` DB, with a safety check on the name) rather than mocks.
- **D13 — Repo hosting.** The cloud session couldn't create a GitHub repo (integration lacks permission), so the owner creates the private `shotpilot` repo and it is pushed from the session.
