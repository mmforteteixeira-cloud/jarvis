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

Two processes, in two terminals, is enough for the full assistant minus
computer control:

```bash
pnpm dev          # web app — http://localhost:3000
pnpm dev:worker   # background worker (task scheduler, retries, heartbeat)
```

Both commands run `pnpm build:packages` first automatically, so the first
run compiles all workspace packages (a few seconds) before starting.

The web app alone is enough to use JARVIS interactively (chat, create
tasks, run agents manually from the dashboard). The worker is what makes
queued tasks execute **without** you clicking "Run" — required for the
24/7 / background-task story.

The SQLite database is created automatically on first run at
`./data/jarvis.db` (relative to the repo root, regardless of which app
opens it first).

### Computer Agent daemon (optional — controls this machine)

A third, separate process, on whichever machine you want JARVIS to
actually control:

```bash
cd apps/computer-agent
cp .env.example .env
```

Edit `apps/computer-agent/.env`:
- `COMPUTER_AGENT_TOKEN` — generate with `openssl rand -hex 32`, and put
  the **same value** in the root `.env`'s `COMPUTER_AGENT_TOKEN`. This is
  the shared secret that authenticates the daemon to the server; without
  it matching on both sides, every request is refused.
- `JARVIS_SERVER_URL` — defaults to `http://localhost:3000`; change it if
  the web app runs elsewhere.
- `COMPUTER_AGENT_ENABLED=true` — the daemon refuses to start otherwise
  (an accidental `pnpm dev` in this directory shouldn't silently start a
  system-control process).

Before starting it for the first time (especially on macOS), run the
diagnostic:

```bash
pnpm computer:doctor
```

This is read-only — it checks your OS/Node/pnpm versions, the daemon's
config, workspace writability, macOS permissions (see PERMISSIONS below),
and reachability to the JARVIS server, and tells you exactly what to fix.
It never installs anything, never changes a permission, and never runs a
destructive command. See "macOS permissions" below for what it checks and
why.

Then:

```bash
pnpm dev          # from apps/computer-agent — runs via tsx, restarts on save
```

The dashboard's **Computer** page (`/computer`) flips to `● ONLINE` within
one heartbeat interval (~15s, usually faster) once it's running, and you
can open apps, take screenshots, and run sandboxed commands from there or
by asking JARVIS in chat ("abre o Safari"). Stop it with Ctrl+C — it
announces itself offline to the server before exiting, so the dashboard
updates immediately instead of waiting for the staleness timeout.

To install it permanently (start on login), see the "Autostart" section
of AGENTS.md — JARVIS does not install any startup service on its own.

### macOS permissions

The daemon needs **one** macOS permission for its current functionality:

- **Screen Recording** — required by the `screencapture` command line tool
  since macOS 10.15 for the `SCREENSHOT` command. Grant it to whichever
  app you actually run the daemon from (Terminal, iTerm2, VS Code's
  integrated terminal, ...) via **System Settings → Privacy & Security →
  Screen Recording**, then restart that app. `pnpm computer:doctor` checks
  this for you by taking one real, throwaway screenshot (deleted
  immediately) — that's the only reliable way to ask macOS whether the
  permission is already granted; there's no side-effect-free API for it.
  If it's not granted, `screencapture` fails and macOS itself will show
  the permission prompt the first time you actually try a `SCREENSHOT`
  command from JARVIS, at which point you can grant it and retry.

Two permissions are explicitly **not** needed today:

- **Accessibility / Automation** — `OPEN_APPLICATION` uses `open -a`
  (LaunchServices, the same mechanism as double-clicking an app in
  Finder), which needs no special permission. This would only become
  relevant for a future click/type UI-scripting feature, which doesn't
  exist yet.
- **Full Disk Access** — only relevant if you set `COMPUTER_AGENT_WORKSPACE`
  to somewhere under Desktop/Documents/Downloads/Pictures/Movies/Music.
  The default (`~/JARVIS/workspace`) avoids this entirely. If you do point
  it at a protected folder, macOS will show its own folder-access prompt
  the first time a file operation touches it — `pnpm computer:doctor`
  warns you about this in advance so it isn't a surprise.

Nothing here is granted automatically — every permission is something
*you* approve through macOS's own System Settings or its own prompt.
JARVIS never modifies TCC/permission settings itself.

## Build for production

```bash
pnpm build          # compiles all packages, then web, worker, computer-agent
pnpm --filter @jarvis/web start     # serve the built web app
pnpm start:worker                   # run the built worker
pnpm start:computer-agent           # run the built daemon
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
