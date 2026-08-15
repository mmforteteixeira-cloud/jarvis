# Agents

All agents implement one interface (`packages/agents/src/base.ts`):

```ts
interface Agent {
  type: AgentType;
  descriptor(): AgentDescriptor;         // name, status, capabilities — shown in the UI
  execute(ctx: AgentContext): Promise<AgentExecutionResult>;
}
```

`AgentExecutionResult.mode` is always one of `REAL`, `NOT_CONFIGURED`, or
`NOT_CONNECTED` — the Task Engine and the UI trust this field completely;
no agent is allowed to report `success: true` for something it didn't
actually do.

The registry (`packages/agents/src/registry.ts`) instantiates all seven and
persists their descriptors to the `agents` table so the dashboard can show
status without re-instantiating agents on every request.

## File Agent — **real**

Sandboxed to a single workspace directory (`WorkspaceSandbox` in
`packages/security`). Ops: `read`, `list`, `write`, `search`, `delete`.
`read`/`write` inside the sandbox are LOW_RISK (auto-allowed); `delete` is
HIGH_RISK and always requires approval.

## Developer Agent — **real**

Same sandbox, plus shell execution (`ShellTools`). Commands from an
allow-list (`npm`, `pnpm`, `node`, `git`, `python3`, `vitest`) are
LOW_RISK; anything else is MEDIUM_RISK and requires approval. 30-second
timeout, 5MB output cap.

**Planned:** stack-trace-aware debugging, multi-file refactors, opening a
PR from a diff.

## Research Agent — **real, needs a key**

Web search via Brave Search's API (`SEARCH_API_KEY`). Without a key it
reports `NOT_CONFIGURED` and returns no results — it never fabricates
search hits.

**Planned:** multi-source synthesis, citation tracking, structured research
reports.

## Browser Agent — **real**

Headless Chromium via Playwright, using the browser already installed in
this environment (`/opt/pw-browsers/chromium`, pinned explicitly rather
than relying on the `playwright` package's own version-matched download,
since the two can drift). Ops: `navigate` (read page title + text),
`screenshot`. Both are LOW_RISK.

In network-restricted environments (like this dev sandbox), outbound HTTPS
goes through a policy-enforcing proxy — `BrowserTools` reads
`HTTPS_PROXY`/`https_proxy` and passes it to Chromium's launch options,
plus `--ignore-certificate-errors` for the proxy's re-terminated TLS. In an
unrestricted deployment this proxy configuration is simply unused.

**Planned:** click/type/form interaction (each step gated at MEDIUM_RISK),
multi-step authenticated sessions, PDF export.

## Computer Agent — **real, v0.2**

A real local daemon (`apps/computer-agent`, binary name `jarvis-computer`)
now exists and actually executes commands on the machine it runs on. It is
honest about connectivity: with no daemon running (or one that's gone
stale — no heartbeat in 45s), `ComputerAgent.execute()` reports
`NOT_CONNECTED`, full stop, exactly like v0.1's placeholder did.

**Transport:** HTTP polling, not WebSocket. The daemon polls
`GET /api/computer/device/commands/next` every `COMPUTER_AGENT_POLL_INTERVAL_MS`
(default 2s), executes what it finds, and posts the result back — this is
the "COMMAND QUEUE" from the architecture diagram, implemented directly as
a REST-polled table (`computer_commands`) rather than a bidirectional
socket. Simpler, and trivial to `curl` by hand while debugging.
`packages/agents/src/computer-protocol.ts` documents the full DTO shapes
and keeps a WebSocket-shaped envelope type in reserve for a future
push-based transport.

**Command types** (`packages/shared`'s `COMPUTER_COMMAND_TYPES`):
`SYSTEM_INFO`, `OPEN_APPLICATION`, `OPEN_URL`, `SCREENSHOT`,
`LIST_DIRECTORY`, `READ_FILE`, `WRITE_FILE`, `CREATE_DIRECTORY`,
`RUN_COMMAND`.

**Two independent policy checks, not one.** `packages/security/src/computer-policy.ts`
(`classifyAppOpen`, `classifyShellCommand`, `isSafeUrl`, `isSensitivePath`)
is imported by *both* sides:
1. Server-side, in `ComputerAgent.execute()`, before a command is even
   queued — decides LOW/MEDIUM/HIGH (→ auto-run or ask for approval) or an
   outright `BLOCKED` refusal (unknown app, unsafe URL scheme, blocked
   shell pattern, sensitive file path) that never reaches the approval
   flow at all, because there's nothing to approve for "no".
2. Daemon-side, in each executor, right before it actually runs — the
   daemon never trusts "the server already checked". A daemon-side refusal
   comes back as command state `REJECTED` (distinct from `FAILED`, which
   means a genuine execution error like "command not found" or "no
   display attached").

**Risk defaults:** opening an allow-listed app, opening an http(s) URL,
screenshots, and file ops inside the sandboxed workspace are all
`LOW_RISK` (auto-execute — see `risk.ts`). `RUN_COMMAND`'s risk is computed
per-command from `classifyShellCommand` (`pwd`/`git status`/`npm test` →
LOW; `npm install`/`git pull`/`npm run dev` → MEDIUM; anything
unrecognized → HIGH, fail-closed; `rm -rf /`, `sudo`, keychain access,
`curl | sh`, etc. → BLOCKED, refused outright).

**Application allowlist** (`DEFAULT_APP_ALLOWLIST` in computer-policy.ts):
Safari, Terminal, Visual Studio Code, Finder, Notes, Calculator, Google
Chrome, Firefox — matched by name/alias, case-insensitively. Anything not
on this list is refused, never launched.

**Sandbox:** file commands are confined to `COMPUTER_AGENT_WORKSPACE`
(default `~/JARVIS/workspace`) via the same `WorkspaceSandbox` the File/
Developer Agents use, *plus* an extra `isSensitivePath` check that refuses
`.env`, `.ssh/`, `.aws/`, `*.pem`, `*.key`, `id_rsa*`, `credentials.json`,
etc. even when they're technically inside the sandbox.

**Screenshots** are captured to a temp file and the file is deleted
immediately after being read into memory and base64-encoded into the
result — zero on-disk retention, not "for a while."

**System info** never sends the raw hostname (often personally
identifying, e.g. "Johns-MacBook-Pro.local") — only a truncated SHA-256
hash of it.

**Device identity:** the daemon generates a random UUID once and persists
it at `~/.jarvis/device.json`, so restarting it re-registers as the *same*
device instead of creating a new row every time.

**Natural language:** `packages/core/src/tool-intent.ts` maps free text to
`{agentType, tool, input}` generically (regex-based when no AI key is
configured, LLM-based JSON extraction when one is) — see "Natural language
→ tool calls" below. It is deliberately scoped to the safe, unambiguous
intents (open app, open URL, screenshot, list/create directory).
`RUN_COMMAND` is never inferred from natural language — turning "roda o
projeto" into an actual shell command requires knowing what "the project"
even is, which JARVIS doesn't have reliable context for yet. That's a
documented gap, not a hidden one: ask more specifically (Computer page →
Run Command) or give the exact command in your message once an AI
provider is configured.

**How to run it:** see SETUP.md. Short version: `cd apps/computer-agent`,
`cp .env.example .env`, fill in `COMPUTER_AGENT_TOKEN` (same value as the
server's), `pnpm computer:doctor` to check readiness, `pnpm dev`.

**Platform support:** macOS is the primary target (`open -a`,
`open <url>`, `screencapture`). Linux equivalents (`xdg-open`, `scrot`/
`import`/`gnome-screenshot`, `code`/`firefox`/etc. binaries) exist too —
mainly so this daemon is actually testable in a Linux dev environment —
and are real, not stubs, but weren't verified against a real display
(this project was built in a headless container). Windows is not
implemented; every executor throws a clear "not implemented for this
platform" error rather than silently no-op'ing.

**`pnpm computer:doctor`** — read-only diagnostic (`apps/computer-agent/src/doctor.ts`),
checks macOS/Node/pnpm versions, daemon config, workspace writability,
macOS permissions (see SETUP.md), and JARVIS server reachability. Named
`computer:doctor` rather than `doctor` specifically because pnpm 10 ships
its own built-in `pnpm doctor` command that would otherwise silently
shadow a same-named package script — discovered by actually running it
and getting empty output instead of the expected diagnostics. Deliberately
has zero imports from any `@jarvis/*` package, so it stays useful even if
something else in the build is broken.

**Dependency note:** the daemon's `package.json` lists only
`@jarvis/security` and `@jarvis/shared` — not `@jarvis/db` — so it never
needs `better-sqlite3`'s native module just to start. This required a
real fix during macOS-readiness review: `@jarvis/security`'s barrel
export included `policy.ts`, which imported `@jarvis/db` at module
top-level, so merely importing `WorkspaceSandbox` from the daemon
transitively loaded `better-sqlite3` anyway. `policy.ts` now lazy-loads
`@jarvis/db` via dynamic `import()` inside `enforceAction`/`approveAction`/
`denyAction` (the only functions that need it) instead of at the top of
the file. Verified directly: the daemon's imports succeed even with the
`better-sqlite3` native binding deliberately deleted.

### Autostart (manual only — nothing is installed automatically)

JARVIS never installs a persistent/startup service on its own — per the
explicit "não instalar serviços persistentes de forma silenciosa"
requirement, this is opt-in and manual. If you want `jarvis-computer`
running automatically when you log into your Mac, use a `launchd` user
agent:

1. Build the daemon: `pnpm --filter @jarvis/computer-agent build`.
2. Create `~/Library/LaunchAgents/com.jarvis.computer-agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.jarvis.computer-agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/absolute/path/to/jarvis/apps/computer-agent/dist/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>/absolute/path/to/jarvis/apps/computer-agent</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/jarvis-computer-agent.log</string>
  <key>StandardErrorPath</key><string>/tmp/jarvis-computer-agent.log</string>
</dict>
</plist>
```

3. Make sure `apps/computer-agent/.env` is filled in (launchd doesn't load
   your shell profile — the daemon reads `.env` from its own directory).
4. Load it: `launchctl load ~/Library/LaunchAgents/com.jarvis.computer-agent.plist`.
5. Unload/remove it the same way you'd remove any launch agent
   (`launchctl unload ...` then delete the plist) — nothing here hides
   itself from Activity Monitor, `launchctl list`, or the Login Items
   settings pane.

### Natural language → tool calls

`packages/core/src/tool-intent.ts` is intentionally generic — there is no
`if (message.includes("safari"))` anywhere in this codebase. The parser
produces a `{agentType, tool, input}` shape from a fixed small set of
intent patterns, and the *only* thing that decides whether the resulting
action is allowed to run is the normal security layer (`enforceAction` +
computer-policy) — exactly the same path a command typed into the
Computer page's "Run Command" box goes through. Adding a new spoken intent
means adding one more pattern (or extending the LLM prompt's tool list),
never a new bespoke code path.

### Natural language → instant answers and reminders (no agent dispatch)

Two more intent parsers sit alongside `tool-intent.ts` in `JarvisCore.chat`'s
routing chain, for requests that don't need an agent or a task at all:

- **`packages/core/src/utility-intent.ts`** — calculator (`packages/tools/src/calculator-tool.ts`,
  a hand-written recursive-descent evaluator, never `eval()`) and
  date/time (`packages/tools/src/datetime-tool.ts`). Both resolve
  synchronously and work identically in DEMO mode — they don't need an AI
  provider. Deliberately conservative matching (an expression must contain
  an actual operator) so "what is 2024" isn't misread as arithmetic.
- **`packages/core/src/reminder-intent.ts`** — "JARVIS, lembra-me amanhã às
  10 de ligar ao médico" persists a row in the `reminders` table
  (`packages/db/src/repositories/reminders.ts`). Tries AI-assisted
  date/time extraction first when a real provider is configured (handles
  arbitrary phrasing), falls back to a heuristic PT/EN parser (relative
  "daqui a N minutos/horas" / "in N minutes/hours", "amanhã"/"tomorrow",
  bare clock times) otherwise. `apps/worker/src/reminders.ts` is the other
  half — it polls for due reminders on every tick and fires them as
  notifications; this only happens while the worker process is running,
  same as task retries.

Routing order in `JarvisCore.chat`/`prepareChatStream`: computer tool
intent → reminder intent → utility intent → goal/project intent → plain
chat (streamed via `AIProvider.completeStream`). Each tier is checked in
order and the first match wins.

## Email Agent — **real, needs OAuth**

Full Gmail OAuth scaffold using `googleapis`: `getAuthUrl`, `exchangeCode`
(stores tokens via `@jarvis/db`'s `settings` table), `listUnread`, `draft`,
`send`. Without `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` it reports
`NOT_CONFIGURED`. `draft` is LOW_RISK; **`send` is always MEDIUM_RISK** —
JARVIS never sends an email without an explicit approval, no matter how
confident it is, per the "nunca enviar emails automaticamente" requirement.

**Planned:** reply threading, classification, Outlook support.

## Content Agent — **real generation, publishing not wired**

Idea/script/hashtag generation goes through the same AI provider
abstraction as chat (real when `AI_API_KEY`/`OPENAI_API_KEY` is set, DEMO
otherwise — and the response says which). Generated scripts are persisted
to the `content` table. `publishTikTok` requires
`TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` (`NOT_CONFIGURED` without them)
and, even once configured, currently marks the content `FAILED` with a
clear message rather than pretending to publish — the TikTok Content
Posting API client itself isn't built yet.

## Adding a new agent

1. Add the type to `AGENT_TYPES` in `packages/shared/src/types.ts`.
2. Implement `Agent` in `packages/agents/src/<name>-agent.ts`.
3. Register it in `packages/agents/src/registry.ts`.
4. Add any new tool primitives to `packages/tools`, and any new risk
   classifications to `ACTION_RISK_CATALOG` in `packages/security/src/risk.ts`
   (unknown actions default to HIGH_RISK, so this is required, not optional).
