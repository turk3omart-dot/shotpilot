# Changelog

## 0.1.0 — 2026-10-24 (unreleased)
### Added
- Monorepo scaffolding, CI workflow, environment template.
- Database schema and initial migration: identity, workspaces, projects, membership, files, scripts and versions, AI jobs, breakdowns, scenes, characters, locations, elements, questions, rate cards, budgets, audit log.
- Auth (scrypt, hashed sessions, rate limits) and server-side role/section authorization with overrides.
- Script upload and extraction (PDF, DOCX, Fountain, TXT) with signature validation.
- Script analysis: Claude provider (structured outputs) and a rule-based parser; workspace AI-consent gate; idempotent jobs; atomic persistence.
- Breakdown review UI: provenance, confirm/reject, edit with conflict detection, questions, cast and location views.
- Deterministic estimation (Lean/Standard/Premium) and editable budgets with a labelled sample SAR rate card.
- Crew list and adding existing users with project roles.
- JSON API v1 with bearer tokens; SwiftUI scaffold.
- Demo seed (`pnpm db:seed`).
- Tests: 31 unit/integration (Vitest + Postgres), 10 e2e (Playwright, desktop + mobile).
