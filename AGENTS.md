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

## Computer Agent — **architecture only, not connected**

This is deliberately **not** implemented as "fake local control." No
device has ever paired with JARVIS. What exists:

- A typed WebSocket protocol (`packages/agents/src/computer-protocol.ts`):
  pairing handshake with a pre-shared secret (`COMPUTER_AGENT_TOKEN`),
  command envelopes (`open_app`, `run_shell`, `read_file`, `write_file`,
  `screenshot`, `browser_control`), each carrying its own risk level.
  The daemon evaluates and executes; JARVIS Core never gets local OS
  credentials.
- A `devices` table and pairing flow (`registerDevice` in `packages/db`).
- `ComputerAgent.execute()` always returns `mode: "NOT_CONNECTED"` — even
  if a device row exists — because the actual daemon (the piece that would
  run on your Mac and speak this protocol) doesn't exist yet. Building
  that daemon is the next real step for this capability.

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
