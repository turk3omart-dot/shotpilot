# Product requirements

## Promise
"From the first idea to the final frame. One intelligent production workspace."

## Differentiator
The differentiator isn't the feature count. It's **continuity**: one production data model, where script → scenes → shots → cast → locations → equipment → crew → schedule → budget → deliverables are linked by stable IDs. When something changes, ShotPilot proposes the consequences (for example: "removing Scene 5 frees the night lighting package, one SFX day and the safety officer, saving about SAR 6,200 — the gaffer's booking is committed and won't be cancelled automatically") and waits for approval.

## Users

| Persona | Primary surface | Needs in seconds |
|---|---|---|
| Producer / EP | Desktop | Project health, budget vs actual, approvals, change impact |
| Production manager / AD | Desktop + phone | Schedule, call sheets, who's confirmed, live variance |
| Director / DOP | Tablet + desktop | Script, shot list, references, notes |
| Crew | Phone | Call time, location, what to bring, updates |
| Cast | Phone | Call time, wardrobe, scenes, instructions; never budgets |
| Client | Browser link | Progress, review files, approve; never internal chatter |
| Freelancer (solo) | Phone + laptop | The whole thing, without setup overhead |

## Core concepts
**Workspace** (the company or team) → **Project** (a production) → **Production Intelligence** (AI plus deterministic rules over the connected data).

## Principles (non-negotiable)

1. AI output is a *suggestion*: labelled, traceable to the source, editable and confirmable.
2. An LLM never produces prices, availability, bookings or approvals.
3. Every high-impact change is proposed first and applied only after approval.
4. Authorization is server-side. Hiding UI is never the protection.
5. Progressive disclosure: a producer creates a project in under 2 minutes.
6. Mobile-first for crew, desktop-first for planning.
7. English and Arabic (RTL) are first-class. SAR is the default currency; international currencies are supported.

## Key journeys

1. **Script to plan (MVP, built):** create workspace → project → upload script → analyse → review breakdown (confirm/reject/edit) → confirm → generate a Lean/Standard/Premium estimate → edit budget lines.
2. **Plan to shoot (Phase 3):** shot list → schedule (stripboard, conflicts) → crew and equipment → call sheet → distribution and acknowledgement.
3. **Collaborate (Phase 4):** invite by email → role portals → channels, threads, mentions → convert a message into a task linked to a location or scene.
4. **Shoot day (Phase 5):** live mode → mark shots → variance → Shoot Rescue options → approve the re-plan → notify the affected people.
5. **Finish (Phases 6–7):** review versions → timecoded comments → approvals → delivery package → closure report → production memory.

## MVP acceptance (PRD Part 33)

| # | Capability | Status |
|---|---|---|
| 1 | Create a workspace | ✅ |
| 2 | Create a project | ✅ |
| 3 | Upload a script | ✅ PDF/DOCX/Fountain/TXT/paste |
| 4 | Analyse with AI | ✅ Claude provider implemented, not yet run with a real key; ✅ rule-based fallback |
| 5 | Review/edit breakdown | ✅ |
| 6 | Initial estimate | ✅ deterministic, three scenarios |
| 7 | Editable budget | ✅ line edits, quoted/committed/actual |
| 8 | Shooting schedule | ⏳ Phase 3 |
| 9 | Invite crew | 🟡 add existing users by email; email invites in Phase 4 |
| 10 | Role-based portal | 🟡 role-based visibility done; configurable portals in Phase 4 |
| 11 | Call sheets | ⏳ Phase 3 |
| 12 | Project chat | ⏳ Phase 4 |
| 13 | Track shooting progress | ⏳ Phase 5 |
| 14 | Export production plan | ⏳ next (print/PDF of breakdown + budget) |

## Business model (not hard-coded)
Free / Creator Pro / Team / Studio-Enterprise. `workspaces.plan_key` is reserved, and an entitlement table maps features to plans (Phase 7). AI tokens are already recorded per job (`ai_jobs.input_tokens` and `output_tokens`) so usage can be metered.

## Out of scope for now
Image generation, Android, macOS app, payments, external weather/maps APIs (they'll be integrated only with verified sources and labelled as such).
