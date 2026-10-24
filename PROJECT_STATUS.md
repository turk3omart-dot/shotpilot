# Project status

_Last updated: 2026-10-24 · version 0.1.0 · see "Latest validated commit" below._

## Summary
Phases 0–1 are done, and Phase 2 has a working vertical slice: **create workspace → create project → upload script → analyse → review and edit breakdown → confirm → generate an estimate → edit the budget.** It all runs on real persistent Postgres data.

## Working (verified by automated tests in this session)
- Sign up, sign in, sign out; sessions; rate limits.
- Workspaces, projects, membership; role-based section access; overrides; removal revokes access at once.
- Script upload (Fountain/TXT verified end-to-end; PDF/DOCX extraction code is present but has no automated fixture yet) and pasted text; immutable versions.
- Rule-based analysis → breakdown with provenance; one character/location entity across scenes.
- Confirm/reject/edit; optimistic-concurrency conflicts; questions.
- Confirmed breakdowns are untouched by script revisions.
- Failing or invalid AI output leaves no partial data; external AI blocked until owner consent; idempotent job creation.
- Estimation engine (scenarios ordered, basis on every line, rejected elements excluded, missing rates surfaced); budgets; regeneration never touches committed or actual figures.
- JSON API v1 auth (401/422/404 behaviour, bearer token).
- Responsive UI (desktop + iPhone-sized viewport) in light and dark.

## Partially implemented
- **Claude provider.** Implemented against the installed SDK (`@anthropic-ai/sdk` 1.3.0) and type-checked, but **never run against the live API**: there was no API key in this environment.
- **Crew invitations.** You can only add *existing* accounts; there are no email invites yet.
- **Arabic.** RTL layout, Arabic heading parsing and the dictionary exist, but most UI strings are still English literals. The language toggle switches direction and locale.
- **iOS.** SwiftUI source scaffold only; **not compiled** (no Xcode in the cloud environment).
- **CI workflow.** Written, but not yet run on GitHub.

## Not started
Scheduling, call sheets, shot lists, locations module, equipment, chat, notifications, approvals, live production, post-production, delivery, analytics, billing (see IMPLEMENTATION_PLAN.md).

## Known issues / limitations
1. Analysis jobs run in-process (`after()`); a server restart mid-job leaves the job `running`. → pg-boss.
2. The rate limiter is in-memory (single instance only).
3. No password reset or email verification yet.
4. E2E tests use the database in `DATABASE_URL` (the dev DB) and create throwaway `example.test` users there.
5. The mobile top bar has no workspace switcher (the desktop rail does).
6. There is no automated PDF/DOCX fixture test yet.

## Test results (this session)
- `pnpm typecheck`: all 6 packages pass.
- `pnpm test`: **31/31 passed** (4 files: parser and upload validation, vertical slice, authorization, estimation and budgets).
- `pnpm build`: production build succeeds (Next.js 16.4.3).
- `pnpm test:e2e`: **10/10 passed** (vertical slice + auth redirect + API, on desktop and mobile Chromium).

## Repository
- Local git repository with commits on `main`.
- Remote: **not yet pushed.** The cloud session's GitHub integration couldn't create repositories (403). The owner must create an empty private repo `shotpilot`; then it is pushed. See NEXT_STEPS.md §0.

## Latest validated commit
See `git log -1` on `main`: the commit titled "Docs, demo seed, JSON API, CI, iOS scaffold", which ran all the checks above.
