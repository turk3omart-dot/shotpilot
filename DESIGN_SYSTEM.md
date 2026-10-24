# Design system

## Direction: "tungsten on slate"
A warm practical-light amber against cool graphite, like a lamp on a dark stage. The content surfaces are light (or deep graphite in dark mode), and the navigation rail is always dark. The look is cinematic and quiet: colour is used only where it carries meaning.

Tokens live in `packages/design-tokens/src/tokens.css` and are mapped to Tailwind in `apps/web/src/app/globals.css`. SwiftUI mirrors them in `apps/ios/.../DesignTokens.swift`.

## Colour roles

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | #F6F5F2 | #111317 | App background (warm paper) |
| `surface` | #FFFFFF | #181B20 | Cards, inputs |
| `rail` | #16181D | #0B0C0F | Navigation rail, scene-number chips |
| `accent` | #D9822B | #F0A04B | Primary actions, active state, focus ring |
| `ai` | #7C4DDE | #A688F0 | **Reserved for AI-generated content.** Nothing else is violet |
| `info` | #2F6FDE | | Deterministic parser output ("Found in script") |
| `ok` / `warn` / `danger` | green / amber / red | | Confirmed / needs review / rejected or destructive |

Day and night chips use daylight yellow (#FDE9B8) and night blue (#283353), so a stripboard reads at a glance.

## Provenance language (always visible)
- **AI suggestion** (violet, sparkle icon) plus confidence: the model inferred it.
- **Found in script** (blue) plus confidence: the deterministic parser found it, or it's a keyword match.
- **Added by team** (neutral): a person wrote or edited it.
- **Needs review / Confirmed / Rejected**: the human decision.

## Type and spacing
- System UI stack (SF Pro on Apple, Inter or Segoe elsewhere), with Noto Sans Arabic / Geeza Pro for Arabic.
- Sizes: 11 (badges), 12, 14 (body), 16, 20, 24 (page titles).
- `tracking-tight` on headings and `tabular-nums` on money and stats.
- Radius: 6 / 10 / 14. Shadows are subtle; borders do most of the work.
- Spacing: 4-pt grid; page gutters of 16 on mobile and 32 on desktop.

## Components (`apps/web/src/components/ui.tsx`)
Button (primary/secondary/ghost/danger), LinkButton, Field, inputClass, Card, Badge (tones), PageHeader, EmptyState, Alert, Stat, Icon (20-px stroke set), SubmitButton (pending state), and the `sp-skeleton` loader.

## Layout
- **Desktop:** a dark left rail (workspace switcher, Home / Inbox / Calendar / Assistant, project list, settings), then project tabs filtered by permission. An optional right-hand context column holds questions and next steps.
- **Mobile:** a sticky top bar and a bottom navigation with 5 items. Tabs scroll horizontally and cards stack.
- **Live production mode (Phase 5):** high-contrast, large touch targets, readable outdoors.

## Interaction
- Pending states on every submit.
- Optimistic concurrency conflicts are explained in plain language.
- Empty states always offer the next action.
- `prefers-reduced-motion` disables animation; transitions stay at 160 ms or less.
- Keyboard focus ring uses the accent colour. Command palette and shortcuts come in Phase 4.

## RTL and Arabic
- `dir` follows the locale.
- Use logical properties only: `ms/me/ps/pe/start/end`, `text-start`.
- User content gets `dir="auto"`. Emails, URLs and codes are forced to `dir="ltr"`.
- Chevrons flip in RTL.
- Numbers and currency use `Intl` with `ar-SA` (see `formatMoney`).
- Not everything should be mirrored. Timelines and timecode playback keep left-to-right time.
