# Implementation plan

Every phase ends functional, tested and documented.

| Phase | Scope | Status |
|---|---|---|
| 0 Foundation | PRD, architecture, schema, design system, repo, CI | ✅ done (CI written, not yet run on GitHub) |
| 1 Functional foundation | Auth, workspaces, projects, roles, dashboard, file upload, navigation, API | ✅ done |
| 2 AI production planning | Upload/parse, AI breakdown, editable review, estimation, budgets | ✅ vertical slice; Claude path unverified without a key |
| 3 Pre-production | Shot list + storyboard, locations, crew, equipment, scheduling (stripboard, conflicts), call sheets (PDF, links, acknowledgements), **export** | next |
| 4 Collaboration | Email invites, configurable role portals, real-time chat (channels/threads/mentions/links), tasks, notifications, approvals | |
| 5 Live production | Live mode, shot tracking, variance, Shoot Rescue (deterministic constraint solver + AI explanation), offline-first | |
| 6 Post-production | Assets, review versions, timecoded comments, client review links, delivery packages | |
| 7 Intelligence & commercial | Production memory, historical estimates, analytics, entitlements, billing, usage metering, enterprise controls | |
| iOS | Shared API; SwiftUI app: sign-in, today, call sheet (offline), notifications, camera uploads | scaffold |

## Phase 3 breakdown (next)
1. Durable job queue (`pg-boss`) and the stuck-job recovery path.
2. Export: printable breakdown + budget (print CSS → PDF), then server-rendered PDF.
3. Locations module (details, permits, contacts, photos) linked to scenes.
4. Shot list per scene (table + cards, drag ordering, version history).
5. Schedule model (`shooting_days`, `schedule_items`), a stripboard UI, and deterministic validation (location grouping, day/night vs daylight, cast availability, working hours, overtime).
6. Call sheets generated from confirmed data, with revisions, recipients, acknowledgement, and secure expiring links.
7. Change-impact engine v1 (`change_proposals`): scene removal or location change → affected schedule items, call sheets, budget lines and people → approve or apply.

## Risks
| Risk | Mitigation |
|---|---|
| LLM output quality varies by script format | The deterministic parser cross-checks scene counts, structured outputs are validated with zod, and the user confirms every item |
| Long scripts exceed a single response | Streaming with a 64k max output; next, chunk by scene ranges and merge |
| Confidentiality of scripts and budgets | Owner opt-in before external AI, server-side authz, audit log, private storage |
| Price hallucination | Prices never come from an LLM; rate cards are user-owned and sample cards are labelled |
| In-process jobs lost on restart | Move to pg-boss (Phase 3, task 1) |
| Arabic screenplay conventions vary | Arabic headings are supported in the parser; dialogue-cue detection still needs AI or manual input |
| Scope creep | Phase gates; MVP Part 33 list is the acceptance target |
