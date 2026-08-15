# JARVIS

A modular, self-hosted personal AI assistant. Real code, not a demo: a
persistent task queue, a security/approval layer, working agents (file,
developer, browser, research, content), a memory system, and a dashboard —
all running locally for zero cost, with clear seams to plug in real
providers (Anthropic, ElevenLabs, Gmail, TikTok, GitHub) as you get API keys.

JARVIS is honest about its own state. Every agent and integration reports
one of `REAL`, `DEMO`, or `NOT_CONFIGURED` — the UI never presents a
simulated result as a real one. If something isn't wired up yet, it says so.

## What's actually here

- **JARVIS Core** — chat entry point with memory-aware context and persona.
  Streams responses token-by-token over SSE (`POST /api/chat/stream`), with
  Markdown rendering, conversation history (rename/delete), and quick
  commands in the UI.
- **Orchestrator + Planner** — turns a goal ("Cria uma aplicação de
  currículos") into a project and a real, persisted task breakdown. Uses an
  LLM when `AI_API_KEY`/`OPENAI_API_KEY` is set; falls back to a
  deterministic heuristic plan otherwise (clearly labeled).
- **Task Engine** — a real state machine (`PENDING → PLANNING → RUNNING →
  WAITING_APPROVAL → COMPLETED/FAILED/CANCELLED`) backed by SQLite, with
  start/pause/cancel/retry.
- **7 agents** — File, Developer and Browser agents are fully working
  (sandboxed filesystem, shell, and a real headless-Chromium browser).
  Research works once you add a search API key. Email (Gmail OAuth) and
  Content (LLM-generated scripts/hashtags) are real but gated behind
  credentials/keys. **Computer Agent (v0.2) is real**: a local daemon
  (`apps/computer-agent`) opens allow-listed apps, opens URLs, takes
  screenshots, and does sandboxed file/command operations on whichever
  machine you run it on — with no device connected it honestly reports
  offline instead of pretending.
- **Natural language → tool calls** — "abre o Safari" / "cria uma pasta
  chamada Teste" resolve through one generic intent parser
  (`packages/core/src/tool-intent.ts`), not per-phrase special cases, and
  go through the exact same risk/approval flow as everything else.
  "quanto é 15% de 200" and "que horas são" answer instantly with no AI
  call needed (`packages/core/src/utility-intent.ts`); "lembra-me amanhã
  às 10 de..." creates a real reminder the background worker fires as a
  notification when due (`packages/core/src/reminder-intent.ts`); "que
  tempo faz em Lisboa" / "news about X" give real answers when
  `WEATHER_API_KEY`/`NEWS_API_KEY` are set, or an honest "not configured"
  otherwise (`packages/core/src/information-intent.ts`).
- **Security layer** — every non-trivial action is risk-classified
  (LOW/MEDIUM/HIGH) and MEDIUM/HIGH actions block on an explicit approval
  you grant from the dashboard.
- **Memory** — SHORT_TERM / PROJECT / TASK / USER_PREFERENCE / LONG_TERM,
  with a hard rejection of anything that looks like a credential.
- **Voice** — browser-native STT/TTS (Web Speech API, zero cost) with an
  ElevenLabs adapter ready behind an API key.
- **Background worker** — a separate long-running process that polls the
  task queue, retries failures with backoff, fires due reminders as
  notifications, and beats a heartbeat.
- **Dashboard** — dark, futuristic, own visual identity (not an Iron Man
  skin), with an animated central orb reflecting JARVIS's live state
  (idle/listening/thinking/executing/speaking/success/error). Chat, voice,
  projects, tasks, reminders, agents, activity log, integrations.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture,
[SETUP.md](./SETUP.md) to run it, [AGENTS.md](./AGENTS.md) /
[TOOLS.md](./TOOLS.md) for what each agent can do today,
[SECURITY.md](./SECURITY.md) for the risk/approval model, and
[INTEGRATIONS.md](./INTEGRATIONS.md) for what's connected vs. what needs a
key.

## Quick start

```bash
pnpm install
cp .env.example .env        # fill in whatever keys you have — all optional
pnpm dev                    # web app on http://localhost:3000
pnpm dev:worker             # background worker, in a second terminal
```

To also control this machine (open apps, take screenshots, run commands),
in a third terminal:

```bash
cd apps/computer-agent
cp .env.example .env        # set COMPUTER_AGENT_TOKEN — same value in both .env files
pnpm dev
```

The dashboard's Computer page flips to `● ONLINE` once it connects.

No API keys are required to run JARVIS. Without `AI_API_KEY`, chat and
planning run in a clearly-labeled DEMO mode instead of pretending to reason.

## Zero-cost by default

- Database: local SQLite file (no server to run). Swap to Postgres/Supabase
  later — see ARCHITECTURE.md.
- Voice: browser Web Speech API, free and local.
- Browser automation: the Chromium already on your machine via Playwright.
- AI: works without a key (heuristic mode); add `AI_API_KEY` for real
  reasoning via Anthropic's API.

## Monorepo layout

```
packages/
  shared/    types, logger, error classes shared everywhere
  db/        SQLite (Drizzle ORM) schema + repositories
  security/  risk classification, approval policy, filesystem sandbox
  memory/    saveMemory / searchMemory / updateMemory / deleteMemory
  ai/        AI provider abstraction (Anthropic / OpenAI / heuristic)
  tools/     fs, shell, web search, browser primitives
  agents/    the 7 agents + registry
  core/      JARVIS Core, Orchestrator, Planner, Task Engine, Project System
  voice/     STT/TTS interfaces + browser + ElevenLabs implementations
apps/
  web/             Next.js dashboard + API routes
  worker/          background worker (scheduler, retry, heartbeat)
  computer-agent/  local daemon (jarvis-computer) — real OS control
```

## Status

Built and self-audited across two sessions: all packages typecheck, the
web app builds and serves every route, the automated test suite passes,
and the full chat → plan → task → agent → approval loop — plus the
Computer Agent's daemon → queue → execute → policy → dashboard loop — was
exercised end-to-end against a real running server and a real daemon
process. See the final summary in the project handoff notes for what's
real, what needs a key, and what's next.
