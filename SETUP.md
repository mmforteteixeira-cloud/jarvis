# Setup

## Prerequisites

- Node.js 20+ (developed against Node 22)
- pnpm 10+ (`corepack enable` or `npm i -g pnpm`)
- A C toolchain (gcc/make/python3) — needed once, to build `better-sqlite3`'s
  native module on install.

Nothing else is required. No database server, no Docker, no paid API keys.

## Install

```bash
pnpm install
```

better-sqlite3's native addon is built automatically via pnpm's
`onlyBuiltDependencies` (configured in the root `package.json`).

## Configure

```bash
cp .env.example .env
```

Every variable is optional. Leave a section blank and that integration
reports `NOT_CONFIGURED` in the UI instead of failing — see
INTEGRATIONS.md for the full list and what each one unlocks.

At minimum, consider setting:

- `AI_API_KEY` (Anthropic) — without it, chat/planning run in heuristic
  DEMO mode (still functional, just not LLM-reasoned).
- `JARVIS_SECRET` — `openssl rand -hex 32`, used for future session/device
  token signing.

## Run

Two processes, in two terminals:

```bash
pnpm dev          # web app — http://localhost:3000
pnpm dev:worker   # background worker (task scheduler, retries, heartbeat)
```

Both commands run `pnpm build:packages` first automatically, so the first
run compiles all 9 workspace packages (a few seconds) before starting.

The web app alone is enough to use JARVIS interactively (chat, create
tasks, run agents manually from the dashboard). The worker is what makes
queued tasks execute **without** you clicking "Run" — required for the
24/7 / background-task story.

The SQLite database is created automatically on first run at
`./data/jarvis.db` (relative to the repo root, regardless of which app
opens it first).

## Build for production

```bash
pnpm build          # compiles all packages, then apps/web, then apps/worker
pnpm --filter @jarvis/web start     # serve the built web app
pnpm start:worker                   # run the built worker
```

## Test

```bash
pnpm test           # runs the full vitest suite once
pnpm test:watch     # watch mode
```

Tests run against an in-memory SQLite database (`DATABASE_URL=:memory:`,
set in `vitest.config.ts`) and never touch `./data/jarvis.db`.

## Typecheck

```bash
pnpm typecheck       # tsc --noEmit across every package and app
```

## Seed some starter data (optional)

```bash
pnpm db:seed
```

Creates a default user, a welcome project, one task, and one memory —
useful for poking at the dashboard before you've created anything yourself.

## Troubleshooting

- **`EADDRINUSE` on port 3000** — a previous `next start`/`next dev` is
  still running (backgrounded processes from a previous session survive
  shell restarts). Find it with `ps aux | grep next-server` and kill it.
- **A package change isn't showing up** — packages are compiled to `dist/`;
  re-run `pnpm build:packages` (the `dev`/`dev:worker` scripts do this
  automatically, but only at startup, not on every save).
- **"DATABASE_URL points at Postgres, but..."** — see ARCHITECTURE.md's
  Database section; the Postgres driver isn't wired in yet, use a `file:`
  URL.
