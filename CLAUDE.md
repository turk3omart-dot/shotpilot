# ShotPilot — notes for Claude Code

Start every session by reading `PROJECT_STATUS.md` and `NEXT_STEPS.md`, then `DECISIONS.md`.

- Monorepo: pnpm workspaces. `apps/web` (Next.js 16), `packages/{shared,database,ai,api,design-tokens}`, `apps/ios` (SwiftUI scaffold).
- All business rules and authorization live in `packages/api`. Web pages/actions and `/api/v1` routes are thin.
  Every project-scoped service must call `requireProject(ctx, projectId, section, level)` first.
- Never let an LLM produce prices. Estimates come from `packages/api/src/estimation.ts` + rate cards.
- AI output is validated with zod (`ScriptAnalysis`) before anything is written, and written in one transaction.
- Schema change: edit `packages/database/src/schema/index.ts`, then `pnpm db:generate` and commit the migration.
- Checks before committing: `pnpm typecheck && pnpm test` (needs Postgres; see SETUP_LOCAL.md), and `pnpm build && pnpm test:e2e` for UI changes.
- Keep PROJECT_STATUS.md, NEXT_STEPS.md and CHANGELOG.md current.
