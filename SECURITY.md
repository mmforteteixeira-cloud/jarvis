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

## Computer Agent

No device has ever connected — see AGENTS.md. When one does, the protocol
(`packages/agents/src/computer-protocol.ts`) requires a pre-shared secret
(`COMPUTER_AGENT_TOKEN`) for pairing, and every command the daemon is asked
to run still carries a risk level and goes through the same approval flow
— the local daemon is a remote *executor*, not a bypass of JARVIS's
security model. It also gets to refuse: the daemon is expected to enforce
its own local allow-lists (which apps, which directories) rather than
blindly trusting whatever JARVIS Core sends.

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
