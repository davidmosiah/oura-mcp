# Changelog

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
