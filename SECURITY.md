# Security

## Risk levels

Every agent/tool action maps to one of three risk levels
(`packages/security/src/risk.ts`):

| Level | Examples | Behavior |
|---|---|---|
| `LOW_RISK` | read files, list dirs, run tests, web search, browse/read pages, memory reads | Executes immediately |
| `MEDIUM_RISK` | send email, publish content, modify settings, run a non-allow-listed shell command, open a local app, control the computer/browser | Blocked; creates a `PermissionRequest` |
| `HIGH_RISK` | delete files, destructive shell commands, financial transactions, irreversible data changes, deleting an account | Blocked; creates a `PermissionRequest` |

**Unclassified actions default to `HIGH_RISK`.** The catalog is a
deny-by-default allow-list — a new tool/agent that forgets to register its
action gets maximum scrutiny automatically, never a silent pass-through.

## The approval flow

`enforceAction()` (`packages/security/src/policy.ts`) is the single choke
point every agent goes through before touching the outside world:

1. `LOW_RISK` → returns `{ allowed: true }` immediately.
2. `MEDIUM_RISK`/`HIGH_RISK` → checks for an already-`APPROVED` request for
   the same `(taskId, action)` pair; if found, allows through (this is what
   makes re-running a task after approval actually work). Otherwise checks
   for an existing `PENDING` request (no duplicate prompts on retry), and
   failing that, creates a new `PermissionRequest` and returns
   `{ allowed: false, permissionRequest }`.
3. The Task Engine transitions the task to `WAITING_APPROVAL`, logs it, and
   creates a `warning`-severity notification. It **does not** proceed
   speculatively.
4. A human approves or denies from the dashboard
   (`POST /api/permissions/:id/approve|deny`). Approval moves the task back
   to `PENDING` so the worker (or a manual "Run") re-executes it — at which
   point step 2 finds the `APPROVED` record and lets it through. Denial
   fails the task with `"Permission denied by user."`, which the worker's
   auto-retry logic explicitly skips (a denial is a decision, not a
   transient failure).

This was exercised end-to-end during development: a Developer Agent
command outside the allow-list correctly blocked, appeared in
`GET /api/permissions?state=PENDING`, and — after approval — completed on
re-execution.

## Filesystem sandbox

`WorkspaceSandbox` (`packages/security/src/sandbox.ts`) resolves every
relative path against a single root and rejects anything that escapes it
(including `..` traversal), independent of the risk/approval layer above.
File Agent and Developer Agent are both constructed with a sandbox rooted
at `<repo>/workspace`.

## Shell execution

Always `execFile`, never a shell string — arguments are passed as an
array, so there's no shell-injection surface from concatenated input.
Timeout-bounded (30s) and output-capped (5MB).

## Memory never stores secrets

`saveMemory`/`updateMemory` (`packages/db/src/repositories/memories.ts`)
run content through `assertSafeMemoryContent()`, which rejects anything
that looks like it **contains** a credential value — `api_key: sk-...`,
`Bearer <token>`, `sk-...` (OpenAI-style), `gh[pousr]_...` (GitHub-style).
It's deliberately narrower than "mentions the word password" (that would
reject completely benign text like "no AI_API_KEY configured" — a real
false positive caught during development and fixed by requiring a
`key: value`-shaped match, not just the keyword).

## Computer Agent (v0.2 — real)

Full detail in AGENTS.md; the security-relevant summary:

- **Authentication:** every `/api/computer/device/*` route requires
  `Authorization: Bearer <COMPUTER_AGENT_TOKEN>` matching the server's env
  var exactly (`apps/web/lib/server/computer-auth.ts`). If the token isn't
  configured server-side, the entire daemon-facing surface refuses with
  `IntegrationNotConfiguredError` — there is no unauthenticated pairing
  path, ever.
- **Double policy check.** Risk is classified twice, independently, by the
  same shared code (`packages/security/src/computer-policy.ts`): once
  server-side before a command is queued (decides auto-run vs.
  approval-required vs. outright `BLOCKED`), and again daemon-side right
  before execution. The daemon never trusts "the server already checked".
  A daemon-side refusal is reported as `REJECTED`, distinct from `FAILED`
  (a genuine execution error).
- **Outright refusals bypass the approval flow entirely** — an unknown
  application, an unsafe URL scheme, a blocked shell pattern, or a
  sensitive file path is a hard "no", not a "please confirm". There's
  nothing to approve for an answer that's always no.
- **Application allowlist** — only 8 named apps can ever be opened
  (`DEFAULT_APP_ALLOWLIST`); nothing else, ever, regardless of approval.
- **Shell command classification** (`classifyShellCommand`) is
  pattern-based and fails closed: unrecognized commands are `HIGH_RISK`
  (approval required), and an explicit blocklist (`rm -rf /`, `sudo`,
  macOS Keychain access, `curl | sh`, fork bombs, `/etc/shadow`, SSH
  private keys, `shutdown`/`reboot`, `diskutil erase`, ...) is refused
  outright, at both the server and the daemon.
- **Sensitive paths are blocked even inside the sandbox** — `.env`,
  `.ssh/`, `.aws/`, `.gnupg/`, `*.pem`, `*.key`, `id_rsa*`,
  `credentials.json`, `.netrc`, `.git-credentials` all refuse
  read/write even when the path itself resolves inside
  `COMPUTER_AGENT_WORKSPACE`.
- **Stale-connection reaping:** a device with no heartbeat in 45 seconds
  (3× the default heartbeat interval) is treated as `OFFLINE` on every
  read, not trusted from a stale DB row — "não quero uma interface
  falsa" applies to disconnection too, not just connection.
- **No personal data collected.** `SYSTEM_INFO` sends a hashed hostname,
  never the raw one; screenshots are read into memory and their temp file
  deleted immediately after, never retained.
- **Device identity** is a random UUID persisted locally
  (`~/.jarvis/device.json`) — no hardware fingerprinting, no MAC address,
  no serial number.

## Error handling as a security property

API routes never leak stack traces or raw exceptions —
`withErrorHandling()` (`apps/web/lib/server/api.ts`) converts any thrown
error into `{ code, message, statusCode }`, logging the detail server-side
only. `JarvisError` subclasses (`ValidationError`, `NotFoundError`,
`PermissionDeniedError`, `IntegrationNotConfiguredError`, ...) carry a
stable `code` and correct HTTP status so the UI can branch on error type
without string-matching messages.

## Known limitations (honest, not hidden)

- No authentication/authorization layer yet — JARVIS currently assumes a
  single local owner (see `getOrCreateDefaultUser`). Every row is already
  scoped by `userId`, so adding real auth is additive, not a rewrite — but
  it isn't built.
- The approval UI trusts whoever can reach the dashboard. There's no
  distinct "admin" vs "viewer" role.
- Rate limiting isn't implemented on the API routes.
