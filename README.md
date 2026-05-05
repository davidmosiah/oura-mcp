# oura-mcp-server

[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-7C3AED?style=flat-square&logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Provider: Oura](https://img.shields.io/badge/data-Oura-00B0B9?style=flat-square)](https://oura.com)
[![npm version](https://img.shields.io/npm/v/oura-mcp-unofficial?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/oura-mcp-unofficial)
[![Delx Wellness](https://img.shields.io/badge/part%20of-Delx%20Wellness-0ea5a3?style=flat-square)](https://github.com/davidmosiah/delx-wellness)

**Local-first MCP server that connects AI agents to your Oura Ring readiness, sleep, activity and HRV data.**

> **Unofficial project.** Not affiliated with, endorsed by or supported by Ōura Health Oy. Oura is a trademark of its respective owner. Use this only with your own Oura account and in line with the Oura Cloud API terms.

Built by [David Mosiah](https://github.com/davidmosiah) for people who use Claude, Cursor, Hermes, OpenClaw or other MCP-compatible agents to think about readiness, sleep and recovery — without copy-pasting numbers from the Oura app.

Part of [Delx Wellness](https://github.com/davidmosiah/delx-wellness), a registry of local-first wellness MCP connectors.

## Why this exists

Oura Ring produces some of the most refined personal health signals — readiness scores, sleep stages, HRV, daily activity, SpO2, body temperature trends. But it lives behind an OAuth API with per-scope authorization, and the data is split across multiple endpoints (daily readiness vs. detailed sleep periods vs. heart-rate streams).

This package handles the OAuth dance locally, normalizes responses across endpoints, and exposes Oura through the Model Context Protocol. Tokens never leave your machine. Privacy-mode defaults keep raw payloads opt-in.

## Setup in 60 seconds

You'll need an Oura app ([create one here](https://cloud.ouraring.com/oauth/applications)) with redirect URI `http://127.0.0.1:3000/callback`.

```bash
npx -y oura-mcp-unofficial setup    # interactive: paste client id + secret
npx -y oura-mcp-unofficial auth     # opens browser, captures the OAuth code
npx -y oura-mcp-unofficial doctor   # verifies you're ready
```

Recommended scopes:

```text
daily heartrate personal sleep workout spo2
```

Then add this to your MCP client config:

```json
{
  "mcpServers": {
    "oura": {
      "command": "npx",
      "args": ["-y", "oura-mcp-unofficial"]
    }
  }
}
```

For Claude Desktop, run `setup --client claude` and the snippet is written for you.

## Try it with your agent

Three things to ask first:

```text
Use oura_connection_status to check setup, then run oura_daily_summary.
Give me a 5-line operating brief for today.
```

```text
Call oura_weekly_summary with response_format=json. Identify my biggest
readiness/sleep bottleneck and give me a next-week plan.
```

```text
Use the oura_daily_checkin prompt, focus=sleep.
Don't claim Oura can prove anything it can't.
```

## Data availability

This package uses the official Oura Cloud API v2. When this README says `raw`, it means the upstream Oura JSON for a supported endpoint — not raw device sensor streams.

| Data | Available | Notes |
|---|:---:|---|
| Daily readiness score + contributors | ✓ | Requires `daily` scope |
| Daily sleep score + sleep periods | ✓ | Requires `daily` and/or `sleep` scope |
| Sleep stages + timing | ✓ | When Oura returns scored sleep |
| Daily activity (steps, calories, MET) | ✓ | Requires `daily` scope |
| Heart-rate time series | ✓ | When ring/membership/scope expose it |
| HRV (overnight, via daily summaries) | ✓ | Surfaced through readiness contributors |
| SpO2 (daily averages during sleep) | ✓ | Requires `spo2` scope; supported devices |
| Workouts + sessions + tags | ✓ | Requires `workout`/`session`/`tag` scopes |
| Personal info (DOB, sex, height, weight) | ✓ | Requires `personal` scope |
| Continuous sensor telemetry | — | Not exposed by Oura Cloud API |

## Tools

**Start with these:**

- `oura_connection_status` — verify local setup before calling Oura
- `oura_daily_summary` — readiness, sleep, activity and SpO2 brief for today
- `oura_weekly_summary` — scorecard, comparison vs prior week, next-week plan

**Auth & diagnostics**

- `oura_capabilities`, `oura_agent_manifest`, `oura_privacy_audit`, `oura_cache_status`
- `oura_get_auth_url`, `oura_exchange_code`, `oura_revoke_access`

**Profile**

- `oura_get_personal_info`

**Daily collections** (paginated, with after/before filters and privacy-mode override)

- `oura_list_daily_readiness`, `oura_list_daily_sleep`, `oura_list_daily_activity`, `oura_list_daily_spo2`

**Detailed collections**

- `oura_list_sleep`, `oura_list_workouts`, `oura_list_heartrate`, `oura_list_sessions`, `oura_list_tags`

## Prompts

- `oura_daily_checkin` — practical daily health and readiness check-in
- `oura_weekly_review` — review trends across activity, sleep and heart context
- `oura_heart_context_investigation` — investigate heart-rate records (privacy-aware)

## Resources

- `oura://capabilities`, `oura://agent-manifest`
- `oura://personal-info`
- `oura://latest/readiness`
- `oura://summary/daily`, `oura://summary/weekly`

## Privacy & security

- OAuth tokens are stored in `~/.oura-mcp/tokens.json` with `0600` permissions and are never returned by tools.
- The server never prints access or refresh tokens.
- `OURA_PRIVACY_MODE` defaults to `structured`. Raw Oura JSON is opt-in via `raw` mode or per-call override.
- Personal info (DOB, sex, height, weight) is only accessible when the user grants the `personal` scope.
- The MCP client never sees access or refresh tokens.
- This is **not medical advice**. The server exposes user-authorized data for personal AI workflows, not diagnosis or treatment.

## Configuration

`setup` writes most of these into `~/.oura-mcp/config.json` (`0600`). Manual env override is supported:

```bash
OURA_CLIENT_ID=…
OURA_CLIENT_SECRET=…
OURA_REDIRECT_URI=http://127.0.0.1:3000/callback

# Optional
OURA_SCOPES="daily heartrate personal sleep workout spo2"
OURA_PRIVACY_MODE=structured        # summary | structured | raw
OURA_CACHE=sqlite                   # optional read-through cache
OURA_TOKEN_PATH=~/.oura-mcp/tokens.json
OURA_CACHE_PATH=~/.oura-mcp/cache.sqlite
```

## Hermes / remote setup

```bash
npx -y oura-mcp-unofficial setup --client hermes --no-auth
npx -y oura-mcp-unofficial auth                      # run locally if browser auth is needed
npx -y oura-mcp-unofficial doctor --client hermes
hermes mcp test oura
```

After Hermes config changes, use `/reload-mcp` or `hermes mcp test oura`. Don't restart the gateway for normal data access.

If browser OAuth has to happen on a different machine than Hermes, run `auth` locally and copy `~/.oura-mcp/tokens.json` to the server with `chmod 600`.

## Requirements

- Node.js 20+
- An Oura app at <https://cloud.ouraring.com/oauth/applications> with redirect URI `http://127.0.0.1:3000/callback`

## Development

```bash
git clone https://github.com/davidmosiah/ouramcp.git
cd ouramcp
npm install
npm test
npm run build
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Links

- npm: <https://www.npmjs.com/package/oura-mcp-unofficial>
- Docs site: <https://wellness.delx.ai/connectors/oura>
- Legacy docs: <https://ouramcp.vercel.app/>
- GitHub: <https://github.com/davidmosiah/ouramcp>
- Delx Wellness registry: <https://github.com/davidmosiah/delx-wellness>
- Connector quality standard: <https://github.com/davidmosiah/delx-wellness/blob/main/docs/connector-quality-standard.md>
- Oura Cloud API docs: <https://cloud.ouraring.com/docs/authentication>

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This software is provided as-is. It is not a medical device, does not provide medical advice, and should not be used for diagnosis or treatment. Always consult qualified professionals for medical concerns.
