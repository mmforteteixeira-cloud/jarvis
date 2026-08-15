# Integrations

`GET /api/integrations` (backed by `packages/core/src/integrations.ts`)
recomputes every integration's status **live from environment variables**
on each request — there's no stale "connected" flag that can lie to you.
Each entry reports `status` (`CONNECTED` / `NOT_CONNECTED` /
`CONFIGURATION_REQUIRED` / `ERROR`) and `mode` (`REAL` / `DEMO` /
`NOT_CONFIGURED`).

| Integration | Category | Env vars | Zero-cost fallback |
|---|---|---|---|
| Anthropic (Claude) | AI | `AI_API_KEY`, `AI_MODEL` | Heuristic DEMO mode (no reasoning, but functional) |
| OpenAI | AI | `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional fallback provider |
| ElevenLabs | Voice | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Browser Web Speech API (STT + TTS, free) |
| Browser Speech | Voice | *(none — always available)* | — |
| Gmail | Email | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` | none — Email Agent reports NOT_CONFIGURED |
| TikTok | Content | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` | Content Agent still drafts scripts/hashtags without it |
| GitHub | Developer | `GITHUB_TOKEN` | Developer Agent still works locally via the `git` CLI |
| Headless Chromium | Browser | *(none — pre-installed)* | — |
| Computer Agent | Computer | `COMPUTER_AGENT_TOKEN` | Architecture-only regardless — see AGENTS.md |
| SQLite | Database | `DATABASE_URL` (optional — defaults to a local file) | — |
| Brave Search | Search | `SEARCH_API_KEY`, `SEARCH_PROVIDER` | none — Research Agent reports NOT_CONFIGURED |
| OpenWeatherMap | Weather | `WEATHER_API_KEY` | none — weather questions in chat get an honest "not configured" reply |
| NewsAPI | News | `NEWS_API_KEY` | none — news questions in chat get an honest "not configured" reply |

## Setting up weather and news (chat questions)

Both have free tiers and need nothing beyond the key:

- Weather: [openweathermap.org/api](https://openweathermap.org/api) → `WEATHER_API_KEY`.
- News: [newsapi.org](https://newsapi.org) → `NEWS_API_KEY`.

Once set, "que tempo faz em Lisboa" / "what's the weather in Lisbon" and
"notícias sobre X" / "news about X" answer directly in chat
(`packages/core/src/information-intent.ts` +
`packages/tools/src/{weather,news}-tool.ts`) — no agent/task dispatch
involved, just a direct API call and a formatted reply.

## Setting up Gmail (Email Agent)

1. Create OAuth credentials in Google Cloud Console (OAuth client ID, type
   "Web application").
2. Add `http://localhost:3000/api/email/oauth/callback` as an authorized
   redirect URI (or whatever `GMAIL_REDIRECT_URI` you set).
3. Put the client ID/secret in `.env`.
4. From the Agents page, run the Email Agent's "Get Auth URL" quick action,
   open the URL, grant consent — Google redirects to
   `/api/email/oauth/callback`, which exchanges the code and stores tokens
   (via `@jarvis/db`'s `settings` table — see SECURITY.md for why this
   isn't the same path as regular memory).
5. `listUnread`/`draft` work immediately after; `send` still requires a
   per-message approval every time (see SECURITY.md) — this is permanent
   policy, not a missing feature.

## Setting up Brave Search (Research Agent)

Brave Search's API has a free tier. Get a key from
[api.search.brave.com](https://api.search.brave.com), set
`SEARCH_API_KEY`. No further setup.

## Setting up ElevenLabs (Voice)

Optional — the browser's own Web Speech API already provides free STT/TTS.
If you want higher-quality voice, get a key from elevenlabs.io, set
`ELEVENLABS_API_KEY` and (optionally) `ELEVENLABS_VOICE_ID`.

## Setting up TikTok (Content Agent)

Register an app at TikTok's developer portal to get
`TIKTOK_CLIENT_KEY`/`SECRET`. Note from AGENTS.md: even with credentials
configured, the publish flow currently reports a clear "not implemented"
failure rather than actually posting — the Content Posting API client
itself is the next piece of work here, intentionally not built
speculatively without a real account to test against.

## Setting up the Computer Agent

There is nothing to configure yet that makes this "connected" — see
AGENTS.md. `COMPUTER_AGENT_TOKEN` exists so a *future* local daemon has a
pre-shared secret to pair with; no such daemon exists in this repository.
