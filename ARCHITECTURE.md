# Architecture

## Overview

```
 ┌───────────────┐     ┌──────────────────┐
 │  Web (Next.js)│     │ iOS (SwiftUI)    │
 │  RSC + server │     │ /api/v1 + bearer │
 │  actions      │     │ token (Keychain) │
 └──────┬────────┘     └────────┬─────────┘
        │  thin adapters         │
        ▼                        ▼
 ┌───────────────────────────────────────────┐
 │ @shotpilot/api — domain services           │
 │  auth · authz · workspaces · projects       │
 │  scripts · analysis · breakdown · budgets   │
 │  estimation (deterministic)  · audit        │
 └──────┬──────────────┬───────────────┬──────┘
        ▼              ▼               ▼
  @shotpilot/database  @shotpilot/ai   StorageDriver
  Drizzle + Postgres   providers,      (local disk → S3/
                       parser, extract  Supabase Storage)
```

**This is a modular monolith on purpose.** It has one deployable web app and one database, and the domain logic sits in packages with clear boundaries. Background work runs inside the app process (see *Jobs*). We split pieces out only when load or team size calls for it.

## Packages

| Package | Responsibility | Must not |
|---|---|---|
| `shared` | Domain enums, zod schemas, the permission matrix, i18n, error types | import DB or Node-only code |
| `database` | Schema, migrations, client, the sample rate card | contain business rules |
| `ai` | `ScriptAnalysisProvider` interface, Claude provider, rule-based provider, screenplay parser, PDF/DOCX/text extraction, upload validation | write to the DB |
| `api` | Every business rule and every authorization check | depend on Next.js |
| `apps/web` | UI, server actions, route handlers | query the DB directly for project data (go through `api`) |

## Security model

- **Authentication.** Email + password, hashed with scrypt (N=16384). Sessions are random 256-bit tokens. Only their SHA-256 is stored (`sessions.id`). The web uses an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Native clients send `Authorization: Bearer`. Sign-in and sign-up are rate-limited, and the error message is the same for an unknown email and a wrong password.
- **Authorization is server-side only.** Every project-scoped service calls `requireProject(ctx, projectId, section, level)`:
  - The caller must belong to the workspace and be either a workspace owner/admin or a project member. Otherwise they get **NOT_FOUND**, so another organisation's data is never revealed, not even its existence.
  - Section access (`overview`, `scripts`, `breakdown`, `budget`, …) comes from `ROLE_DEFAULTS[projectRole]`, with per-member `overrides`. Owners and admins get `edit` everywhere.
  - A missing level gives **FORBIDDEN**. Responses only include blocks the caller can see (for example, `getProjectOverview` omits `budgetCount` for crew).
- **Workspace isolation.** Every project-scoped row carries `project_id`, and lookups are always checked against the caller's membership. Tests cover cross-organisation access.
- **Uploads.** The server checks size (≤ 15 MB), the extension allowlist and the file signature (`%PDF-`, ZIP for DOCX, UTF-8 without NULs for text). Files go to private storage with random keys and are never served from a public URL.
- **Optimistic concurrency.** Scenes and budget lines carry `version`. A stale update gets CONFLICT and returns the current row, so nobody silently overwrites a colleague's edit.
- **Audit log.** `audit_events` records creates, edits (with before-values), confirmations, permission changes, AI-consent changes and member changes.
- **Headers.** `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a restrictive permissions policy. Server Actions get Next.js's built-in origin check against CSRF.
- **Secrets** live only in `.env` (gitignored). `.env.example` documents them.

## AI design

- **Provider-independent.** Every provider implements `ScriptAnalysisProvider.analyzeScript()` and returns the shared `ScriptAnalysis` contract. Each one declares `external` (data leaves our infrastructure) and `isAI`.
- **Claude provider** (`packages/ai/src/providers/anthropic.ts`):
  - Default model `claude-opus-5-5`, with streaming, adaptive thinking and structured outputs through `betaZodOutputFormat`.
  - Server-side refusal fallback (`fallbacks: "default"`).
  - Line-numbered input so the model can cite `startLine` and `endLine`.
- **Rule-based provider.** A deterministic screenplay parser (English and Arabic headings, dialogue cues, conservative keywords). It is used when there's no key, and it cross-checks AI scene counts.
- **Consent.** External providers are refused (`AI_DISABLED`) until the workspace owner turns on *external AI processing*. That change is audited.
- **Prompt-injection defence:**
  - Script text sits in `<script_source>`, and the system prompt tells the model it is untrusted data.
  - The model has no tools and cannot take actions.
  - Output must pass zod validation. Line references are clamped to the real document.
  - Nothing is written unless validation succeeds.
- **Traceability.**
  - `ai_jobs` stores the provider, model, token usage and the raw validated output.
  - Every persisted scene and element carries `origin` (`ai`/`parser`/`user`), `confidence`, `confirmation` and `source_ref`.
  - Editing an item makes it user-authored.
- **No invented money.** Estimates come from `estimation.ts`: explicit scenario rules × rate-card rates. Every line carries a human-readable `basis`, and missing rates are reported, not guessed.

## Data integrity rules

- Script versions are immutable. A revision creates a new version.
- Analysis always creates a **new** breakdown in a single transaction. Older *drafts* are superseded. **Confirmed** breakdowns are only superseded when someone explicitly confirms a newer one.
- Generating a budget always creates a **new** budget, so quoted, committed and actual figures on existing budgets are never touched.

## Jobs

Analysis creates an `ai_jobs` row, which is idempotent on `(workspace_id, idempotency_key)`, and runs it through Next.js `after()`, so the HTTP response returns immediately. The job page polls the job's status. The job claim is atomic (`queued → running`), so a duplicate run is a no-op.

**Limitation:** a job runs inside the app process, so if the process dies mid-job, it stays `running`. Before production, move it to a durable queue. `pg-boss` on the same Postgres is the planned choice (see NEXT_STEPS).

## Storage

There is a `StorageDriver` interface, and `LocalDiskStorage` is used in development. The production plan is S3-compatible private buckets (Supabase Storage or S3) with short-lived signed URLs, issued only after an authorization check.

## Hosting (proposed, not deployed)

- Web: Vercel or a container on Fly.io/Render.
- Postgres: Supabase or Neon, with PITR backups.
- Storage: Supabase Storage or S3.
- Errors: Sentry.
- No production deployment happens without owner approval.

## Localization

`dir` and `lang` come from the `sp_locale` cookie. Components use logical CSS properties (`ms-`, `ps-`, `text-start`, `end-`), and user text uses `dir="auto"`. Dictionaries live in `packages/shared/src/i18n.ts` (en/ar). Most UI strings are still English literals, and moving them into the dictionaries is tracked in NEXT_STEPS.
