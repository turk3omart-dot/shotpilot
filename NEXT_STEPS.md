# Next steps

## 0. Repository
Hosted at https://github.com/turk3omart-dot/shotpilot (private). Check the first CI run and fix anything it reports before starting new work.

## 1. Immediate engineering tasks (in order)
1. **Durable jobs:** add `pg-boss` (same Postgres), a worker entry point, retry with backoff, and recovery of stale `running` jobs. Keep `ai_jobs` as the user-facing record.
2. **Verify the Claude path with a real key:** set `ANTHROPIC_API_KEY`, enable workspace consent, analyse `tests/fixtures/the-last-light.fountain`, and inspect `ai_jobs.output`. Add a recorded-response contract test for the provider's output parsing. For long scripts, chunk by scene ranges.
3. **PDF/DOCX fixtures:** add small generated files under `tests/fixtures/` and extraction tests.
4. **Export production plan (MVP #14):** printable breakdown + budget pages (`/p/[pid]/export`) with print CSS.
5. **Locations module:** details, address, permit status, contacts, photos (private storage), linked to scenes.
6. **Schedule v1:** `shooting_days` + `schedule_items`, an auto-draft from the confirmed breakdown (group by location, day/night blocks), a stripboard UI with drag and drop, and deterministic conflict checks.
7. **Call sheets v1:** generated from the schedule and crew; revisions; secure expiring share links; acknowledgement tracking.
8. **Email invitations:** tokenised, expiring, single-use invites; guest accounts.
9. **i18n pass:** move UI literals into `packages/shared/src/i18n.ts`; review the Arabic layout screen by screen.
10. **Change-impact engine v1:** `change_proposals` for scene removal and location change (see DATABASE_SCHEMA.md).

## 2. Before any public deployment (needs owner approval)
Pick hosting (Vercel/Fly + Supabase/Neon), S3-compatible private storage, Sentry, a shared rate limiter, password reset and email verification, backups and a restore drill, a security review, and a privacy policy covering AI processing.

## Resume prompt
> Open the ShotPilot repository, read PROJECT_STATUS.md and NEXT_STEPS.md, verify the environment, and continue development from the latest validated commit.
