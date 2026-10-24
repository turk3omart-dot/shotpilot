# Local setup (macOS)

## 1. Prerequisites

```bash
# Homebrew: https://brew.sh
brew install node@22 postgresql@16 git
brew services start postgresql@16
corepack enable            # provides pnpm (version pinned in package.json)
```

Requirements: Node ≥ 22, PostgreSQL ≥ 15, and pnpm 10 (via corepack).

## 2. Get the code

```bash
git clone <PRIVATE_REPOSITORY_URL>
cd shotpilot
pnpm install
cp .env.example .env
```

## 3. Database

`pnpm db:setup` creates a `shotpilot` role and two databases (`shotpilot_dev` and `shotpilot_test`), then applies the migrations.

With Homebrew Postgres, your macOS user is the superuser, so run:

```bash
PGSUPERUSER=$(whoami) PSQL="psql -d postgres" pnpm db:setup
```

If you prefer to do it by hand:

```bash
psql -d postgres -c "CREATE ROLE shotpilot LOGIN PASSWORD 'shotpilot' CREATEDB"
psql -d postgres -c "CREATE DATABASE shotpilot_dev OWNER shotpilot"
psql -d postgres -c "CREATE DATABASE shotpilot_test OWNER shotpilot"
pnpm db:migrate
```

Docker alternative:

```bash
docker run -d --name shotpilot-pg -p 5432:5432 -e POSTGRES_USER=shotpilot -e POSTGRES_PASSWORD=shotpilot -e POSTGRES_DB=shotpilot_dev postgres:16
docker exec shotpilot-pg psql -U shotpilot -c "CREATE DATABASE shotpilot_test"
pnpm db:migrate
```

## 4. Run

```bash
pnpm db:seed     # optional: demo users (password: shotpilot-demo-2026)
pnpm dev         # http://localhost:3000
```

Demo accounts (the seed marks them with `is_demo`):

| Email | Role |
|---|---|
| producer@demo.example.test | Workspace owner / producer |
| camera@demo.example.test | Camera operator (no budget access) |
| client@demo.example.test | Client (no script/breakdown access) |

## 5. Enable Claude (optional)

1. Put your key in `.env` as `ANTHROPIC_API_KEY=...`. Never commit it.
2. Restart `pnpm dev`.
3. Open **Workspace settings → AI data processing** as the workspace owner. Enable it and confirm that you're authorised.

Until both steps are done, analysis uses the rule-based parser, and the UI labels it "no AI".

## 6. Checks

```bash
pnpm typecheck
pnpm test                 # wipes and re-migrates shotpilot_test
pnpm build && pnpm test:e2e
```

The e2e tests start `next start` on port 3100 against the database in `DATABASE_URL`. Set `PLAYWRIGHT_BROWSERS_PATH` or run `pnpm --filter @shotpilot/web exec playwright install chromium` once.

## 7. iOS

See [apps/ios/README.md](apps/ios/README.md). It needs Xcode 16+ and the web app running locally.

## Resuming with Claude Code

> Open the ShotPilot repository, read PROJECT_STATUS.md and NEXT_STEPS.md, verify the environment, and continue development from the latest validated commit.
