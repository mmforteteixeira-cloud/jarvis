# Tools

`packages/tools` holds the raw I/O primitives agents call — no business
logic, no risk decisions (that's `packages/security`), just "do the thing."

## FsTools (`fs-tools.ts`)

Sandboxed filesystem access. Every path is resolved through
`WorkspaceSandbox.resolve()`, which throws if the resolved absolute path
escapes the sandbox root — including via `..` traversal. Used by File
Agent and Developer Agent.

- `readFile(path)`, `writeFile(path, content)` (creates parent dirs),
  `listDir(path)`, `exists(path)`, `searchFiles(query, path)` (filename
  substring search, skips `node_modules`/`.git`).

## ShellTools (`shell-tools.ts`)

Runs a command via `execFile` (never a shell string — no shell injection
surface) with `cwd` resolved through the same sandbox, a 30s timeout, and a
5MB output cap. Used by Developer Agent, which decides per-command whether
it's LOW_RISK (allow-listed) or MEDIUM_RISK.

## Web search (`web-search-tool.ts`)

Brave Search's REST API (`SEARCH_API_KEY`). Throws
`IntegrationNotConfiguredError` when no key is set — callers convert that
into an honest `NOT_CONFIGURED` result rather than returning fabricated
results.

## Calculator (`calculator-tool.ts`)

`evaluateExpression(input)` — a hand-written recursive-descent parser for
`+ - * / % ^ ()` and decimals. Deliberately never `eval()`/`Function()`,
since this parses untrusted chat input directly. Wired into chat via
`packages/core/src/utility-intent.ts`, which only routes to it when the
message actually contains an operator (so "what is 2024" isn't misread as
arithmetic) — answers instantly, no AI call, works identically in DEMO mode.

## Date/time (`datetime-tool.ts`)

`getCurrentDateTime(locale?, timeZone?)` — wraps `Intl.DateTimeFormat`,
no external call. Same `utility-intent.ts` routing as the calculator.

## Weather (`weather-tool.ts`)

OpenWeatherMap's REST API (`WEATHER_API_KEY`). Same
`IntegrationNotConfiguredError` pattern as web search — no key means an
honest "not configured" chat reply, never a guessed forecast. Routed via
`packages/core/src/information-intent.ts`.

## News (`news-tool.ts`)

NewsAPI.org's REST API (`NEWS_API_KEY`). Same pattern as weather — real
headlines or an honest "not configured", never fabricated. Also routed via
`information-intent.ts`.

## BrowserTools (`browser-tools.ts`)

Real Playwright + Chromium. `navigateAndRead(url)` returns the final URL,
page title, and up to 20k characters of visible text; `screenshot(url)`
returns a PNG buffer. Each call launches a fresh headless browser and
closes it — simple and safe; a persistent-context pool for multi-step
sessions is natural follow-up work once the Browser Agent needs to click
through a flow rather than just read a page.

Launch is pinned to the pre-installed Chromium build
(`/opt/pw-browsers/chromium`) rather than the `playwright` npm package's
own expected revision, because the two can drift apart (observed directly
during development: `playwright@1.62` expected a Chromium build the
pre-installed browser didn't have). If a proxy is configured via
`HTTPS_PROXY`, it's passed to Chromium explicitly — browsers don't read
that env var themselves the way Node's `fetch` does.

## Risk classification lives elsewhere, on purpose

Tools never decide whether an action is allowed — see
`packages/security/src/risk.ts` and SECURITY.md. This keeps "can I do
this" and "how do I do this" independently testable and means a new tool
is safe-by-default: an unclassified action is HIGH_RISK until someone
explicitly adds it to the catalog.
