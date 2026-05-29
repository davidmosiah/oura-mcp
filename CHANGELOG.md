# Changelog

## 0.4.6 - 2026-05-29

### Docs

- **README Quickstart** — new "see the data before you connect" section documenting `oura_demo`, with the real captured JSON payload for the readiness/sleep/daily-summary tools so agents learn the data contract before OAuth. Added `oura_demo` and `oura_quickstart` to the Tools list.

## 0.4.3 - 2026-05-20

### Added

- **HTTP response cache middleware** (`src/services/http-cache.ts`) — in-memory cache layered OUTSIDE retry (`fetchWithCache → fetchWithRetry → fetch`), so cached responses skip both network and retry. Default 60s TTL for GET only; POST/PUT/DELETE and 4xx/5xx responses are never cached.
- **`OURA_NO_CACHE=true` env var** — global per-process cache bypass; advertised in `server.json`.
- **Per-call `cache_ttl: 0`** request option — opts a single call out of cache without disabling globally.
- **Query-param-order-insensitive cache keys** — `?start_date=…&end_date=…` and `?end_date=…&start_date=…` share one cache entry.
- **`oura_cache_status` now reports `http_cache` stats** alongside SQLite stats: `size`, `hit_count`, `miss_count`, `hit_rate`, `default_ttl_seconds`, `bypass_env_var`.
- `scripts/http-cache-test.mjs` — eight-case unit suite covering cache hit, POST never cached, TTL expiration, query-param normalization, 4xx not cached, env-var bypass, per-call `cache_ttl: 0`, and `getCacheStats()` math.

## 0.4.2 - 2026-05-19

### Added

- **Dedicated HTTP retry middleware** (`src/services/http-retry.ts`) — extracted from `OuraClient.fetchWithRetry` into a reusable, testable function with exponential backoff (500ms / 1s / 2s), ±20% jitter, and `Retry-After` header parsing (supports both seconds and HTTP-date formats).
- **`OURA_NO_RETRY=true` env flag** — disables retries entirely for tests or callers that want raw error propagation.
- **HTTP 408 added to retryable status set** alongside 429, 500, 502, 503, 504 — request-timeout responses are now transparently retried.
- **Network-error retries** — fetch failures (ECONNRESET, ENOTFOUND, timeouts) are now retried with the same backoff schedule as HTTP errors instead of bubbling up on the first failure.
- **Structured stderr logs** — each retry now writes `[oura-mcp] retry N/3 after Xms (status=Y or error=Z)` so agents can correlate spike-and-recovery patterns in their logs.
- `scripts/http-retry-test.mjs` — six-case unit suite covering happy path, Retry-After header, env disable flag, 401 non-retry, exhaustion, and network-error retry.

### Changed

- `OuraClient.fetchWithRetry` now delegates to the shared middleware so the auth-failure 401 re-auth flow benefits from the same backoff guarantees.
- Backoff defers to `Retry-After` first (HTTP standard) and only computes jittered exponential when the header is absent or unparseable.

## 0.4.1 - 2026-05-11

### Fixed

- **Profile-store regex no longer false-positives on common wellness words.** Split `SECRET_PATTERNS` into `SECRET_KEY_PATTERNS` (broad, for field names like `oauth_token`) and `SECRET_VALUE_PATTERNS` (high-specificity, only credential shapes: JWTs, `Bearer <token>`, `sk_live_`, `sk-proj-`, `xoxb-`, `github_pat_`, raw `Authorization:` headers). Previously legitimate text like "5 training sessions per week", "limit cookies", "I need to refresh my approach", or "secret sauce: more sleep" was rejected.
- **Partial-profile reads no longer crash downstream.** `readProfileFile` now structurally merges with `DEFAULT_PROFILE` when legacy Hermes/OpenClaw files lacked sub-objects (goals, devices, training, nutrition, preferences, safety). Previously `buildProfileSummary` and `missingCriticalFields` would throw.
- **Onboarding `privacy_note` no longer hard-codes a single connector path.** Lists multiple example paths so the message reads correctly from every connector.

## 0.4.0 - 2026-05-11

- Add shared Delx wellness profile support, vendored from `delx-wellness/lib/profile-store.ts` into `src/services/profile-store.ts` (no new npm deps; Node built-ins only).
- Add `oura_profile_get` tool — read the shared profile (`~/.delx-wellness/profile.json`), returns summary, missing_critical fields and storage_path. Read-only.
- Add `oura_profile_update` tool — patch the shared profile; requires `explicit_user_intent=true`. Rejects any field that looks like a secret (oauth/token/secret/password/cookie/refresh/api_key/session).
- Add `oura_onboarding` tool — return the 11-question onboarding flow (`en` or `pt-BR`) plus current profile state and missing critical fields. Read-only.
- Add `oura-mcp-server onboarding` CLI command — print the onboarding flow JSON (and a TTY-friendly Markdown summary when stderr is a TTY).
- `recommended_first_calls` now leads with `oura_profile_get` so agents check the shared profile state before walking quickstart.
- Auto-migration from Hermes (`~/.hermes/profiles/delx-wellness/wellness-profile.json`) and OpenClaw (`~/.openclaw-delx-wellness/workspace/wellness-profile.json`) legacy paths to the canonical `~/.delx-wellness/profile.json`.
- Tool count: 24 → 27.

## 0.3.0 - 2026-05-11

- Add `oura_quickstart` tool — personalized 3-step setup walkthrough adapted to current state (env vars set? OAuth token present? what's next?). Returns cross-connector hints to pair with wellness-nourish, wellness-cycle-coach, and wellness-cgm-mcp.
- Add `oura_demo` tool — realistic example payloads of `oura_daily_summary`, `oura_wellness_context`, and `oura_list_daily_readiness` so agents see the contract before any real Oura API call.
- `recommended_first_calls` on the agent manifest now leads with `oura_quickstart` and `oura_demo`.
- Tool count: 22 → 24.

## 0.1.1

- Updated `zod` to `4.4.3` after the initial public repository dependency check.
- Kept package, runtime and MCP registry manifest versions aligned for the first public release line.

## 0.1.0

- Initial Oura MCP implementation.
- Added OAuth setup/auth/doctor CLI with local config and token storage under `~/.oura-mcp/`.
- Added 20 MCP tools, 6 resources and 3 prompts.
- Added Oura Cloud API v2 tools for personal info, readiness, sleep, activity, heart-rate, SpO2, sessions, tags and workouts.
- Added daily and weekly summaries, privacy modes, SQLite cache support, privacy audit, connection status and Hermes agent manifest checks.
