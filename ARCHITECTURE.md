# Architecture

## Request flow

```
USER
  │
  ▼
JARVIS CORE           (packages/core/src/jarvis-core.ts)
  │  conversation state, memory context, persona, routing
  ▼
ORCHESTRATOR           (packages/core/src/orchestrator.ts)
  │  goal → project + plan (never executes anything itself)
  ▼
PLANNER                (packages/core/src/planner.ts)
  │  goal → ordered steps (AI-generated or heuristic template)
  ▼
TASK ENGINE             (packages/core/src/task-engine.ts)
  │  persists tasks, runs the state machine, dispatches to agents
  ▼
AGENT                   (packages/agents/src/*)
  │  one of FILE / DEVELOPER / RESEARCH / BROWSER / COMPUTER / EMAIL / CONTENT
  ▼
TOOL                    (packages/tools/src/*)
  │  fs, shell, web search, browser — the actual I/O
  ▼
RESULT
  ▼
VERIFICATION            (Task Engine: success/failure, WAITING_APPROVAL)
  ▼
MEMORY                  (packages/memory — only on the chat path)
  ▼
USER
```

Every arrow from Agent → Tool passes through the **security layer**
(`packages/security`) first: LOW_RISK actions execute immediately;
MEDIUM/HIGH_RISK actions stop and create a `PermissionRequest` instead of
running. See SECURITY.md.

## Why this package layout

Each package is a separable concern with a narrow public surface
(`src/index.ts`). No package imports across a layer it shouldn't:

- `shared` has zero dependencies — types, logger, error classes everyone uses.
- `db` depends only on `shared`. It's the only package that talks SQL.
- `security` and `memory` depend on `db` + `shared`. They're small,
  focused services on top of storage.
- `ai` depends only on `shared` — swappable LLM provider.
- `tools` depends on `security` (for the filesystem sandbox) — raw I/O
  primitives, no business logic.
- `agents` depends on `tools`, `security`, `db`, `ai` — this is where
  "what should happen" is decided per agent.
- `core` depends on everything above — JARVIS Core, Orchestrator, Planner,
  Task Engine, Project System. This is the only package that knows about
  "JARVIS" as a whole.
- `voice` is intentionally standalone (only depends on `shared`) because
  half of it (`browser-voice.ts`) runs in the browser, not Node.

`apps/web` and `apps/worker` are the only two things that get deployed.
Both are thin: they wire the packages together and expose them (via HTTP
routes, or via a poll loop) — no business logic lives in either app.

## Database

**Today:** SQLite via `better-sqlite3` + Drizzle ORM
(`packages/db/src/schema.ts`), a single file at `DATABASE_URL` (default
`file:./data/jarvis.db`, resolved relative to the monorepo root regardless
of which process opens it — see `findMonorepoRoot` in `client.ts`). Zero
setup, zero cost, works offline.

**Tables:** `users, projects, tasks, agents, agent_runs, conversations,
messages, memories, integrations, permissions, activity_logs, devices,
notifications, content, settings` — exactly the set the product spec asked
for, all defined in `packages/db/src/schema.ts` with a hand-written
idempotent bootstrap in `packages/db/src/migrations/0000_init.ts` (kept as
a TS module, not a loose `.sql` file, so it survives the `tsc` build step).

**Repository layer:** every table has a `packages/db/src/repositories/*.ts`
file exposing plain async functions (`createTask`, `searchMemory`, ...).
Callers never touch the Drizzle query builder directly — that's the
abstraction boundary that makes swapping databases possible without
rewriting the rest of the app.

**Moving to Postgres/Supabase:** point `DATABASE_URL` at a `postgres://`
connection string. This isn't fully wired today — `client.ts` currently
throws a clear error telling you where to look — because doing it *for
real* means a mirrored `schema.postgres.ts` using `drizzle-orm/pg-core`
column builders (SQLite and Postgres dialects use different column types in
Drizzle; they can't share one schema file) and swapping the driver in
`client.ts` to `drizzle-orm/node-postgres`. The repository layer above it
doesn't change. This is intentionally not built speculatively — build it
when you actually have a Postgres/Supabase instance to target.

## Why SQLite over "a local Postgres"

This machine actually has a local PostgreSQL 16 install available, but a
zero-cost personal assistant that a user runs on their own laptop shouldn't
require them to manage a database *service*. SQLite-as-a-file matches the
"armazenamento local durante desenvolvimento" requirement literally: `git
clone`, `pnpm install`, `pnpm dev` — no `pg_ctl start` step.

## Compiled packages, not a monolith

Every package in `packages/*` compiles to `dist/` via `tsc` (`pnpm run
build` in each, or `pnpm build:packages` from the root) before the Next.js
app or the worker can import them. This is not incidental — Next's bundlers
(both webpack and Turbopack) do not resolve the `.js`-suffixed relative
imports that Node's own ESM loader requires in TypeScript source
(`import "./foo.js"` referring to `./foo.ts`), so consuming raw `.ts`
workspace packages directly failed under `next build`. Compiling first
matches how `tsx`/Node also run these packages (via `dist/*.js`) and is the
standard pattern for a Next.js + internal-packages monorepo. `pnpm dev` and
`pnpm dev:worker` both run `build:packages` first automatically; if you
edit a package while `next dev` is running, re-run `pnpm build:packages`
(or `pnpm --filter @jarvis/<pkg> build`) to pick up the change. Vitest is
configured to alias `@jarvis/*` straight to each package's `src/`, so tests
never need a prior build.

## The AI provider abstraction

`packages/ai` defines one interface (`AIProvider.complete()`) with three
implementations: Anthropic, OpenAI, and a `HeuristicProvider` that runs with
zero external calls when no key is configured. `getAIProvider()` picks
whichever is configured; the Planner, JARVIS Core's chat path, and the
Content Agent all go through it, so adding a fourth provider (or changing
which one is default) is a one-file change.

## The Task Engine's execution rule

A task is only auto-executable if it has both an `agentType` **and**
structured `input` (e.g. `{ op: "read", path: "x" }`). The Orchestrator
deliberately creates **plan-level** tasks — mostly `agentType: null` for
software-project templates — so that asking JARVIS to build something
never silently starts running shell commands. Turning a plan step into a
real action is a separate, explicit act (via the Agents quick-actions in
the dashboard, or a direct `POST /api/tasks` with `agentType` + `input`).
