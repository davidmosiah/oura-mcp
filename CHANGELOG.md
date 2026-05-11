# Changelog

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
