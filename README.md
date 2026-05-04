# Oura MCP Unofficial

[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-7C3AED?style=flat-square&logo=anthropic&logoColor=white)](https://modelcontextprotocol.io) [![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Provider: Oura](https://img.shields.io/badge/data-Oura-00B0B9?style=flat-square&logo=oura&logoColor=white)](https://oura.com) [![npm version](https://img.shields.io/npm/v/oura-mcp-unofficial?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/oura-mcp-unofficial)


Unofficial, local-first Model Context Protocol server for connecting AI agents to user-authorized Oura data through the official Oura Cloud API v2.

It is designed for Claude, Cursor, Windsurf, Hermes, OpenClaw and other MCP clients that need safe access to readiness, sleep, activity, heart-rate, HRV, SpO2 and workout context.

> Not affiliated with, endorsed by, or sponsored by Oura. Not medical advice.

## What It Supports

- OAuth 2.0 authorization code flow with local token storage.
- Daily readiness, sleep and activity summaries.
- Sleep periods and sleep-stage summaries when Oura provides them.
- Heart-rate time series when the account, ring and scopes permit it.
- HRV, SpO2 and workout summaries when available for the account/device.
- Personal info fields only when the user grants the `personal` scope.
- Daily and weekly agent-ready summaries.
- Privacy modes: `summary`, `structured`, `raw`.
- Hermes-focused agent manifest and setup diagnostics.

## Quick Start

Create an Oura app at [cloud.ouraring.com/oauth/applications](https://cloud.ouraring.com/oauth/applications) and set the callback URL to:

```text
http://127.0.0.1:3000/callback
```

Recommended read scopes:

```text
daily heartrate personal sleep workout spo2
```

Then run:

```bash
npx -y oura-mcp-unofficial setup
npx -y oura-mcp-unofficial auth
npx -y oura-mcp-unofficial doctor
```

Start the MCP server:

```bash
npx -y oura-mcp-unofficial
```

## Claude / Cursor / Generic MCP Config

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

## Hermes

```bash
npx -y oura-mcp-unofficial setup --client hermes --no-auth
npx -y oura-mcp-unofficial doctor --client hermes
```

After config changes, reload MCP with `/reload-mcp` or `hermes mcp test oura`. A normal Oura data-access issue should not require restarting the Hermes gateway.

## Tools

Core setup and safety:

- `oura_agent_manifest`
- `oura_capabilities`
- `oura_connection_status`
- `oura_get_auth_url`
- `oura_exchange_code`
- `oura_privacy_audit`
- `oura_cache_status`
- `oura_revoke_access`

Data tools:

- `oura_get_personal_info`
- `oura_list_daily_activity`
- `oura_list_daily_sleep`
- `oura_list_daily_readiness`
- `oura_list_sleep`
- `oura_list_workouts`
- `oura_list_heartrate`
- `oura_list_daily_spo2`
- `oura_list_sessions`
- `oura_list_tags`

Workflow tools:

- `oura_daily_summary`
- `oura_weekly_summary`

## Privacy Model

Tokens are stored locally under `~/.oura-mcp/` with user-only permissions. The server never prints access tokens or refresh tokens.

Privacy modes:

- `summary`: minimal fields for safe agent use.
- `structured`: normalized Oura data for analysis.
- `raw`: upstream Oura JSON, only when explicitly requested.

Health data is sensitive. Do not paste raw payloads publicly. This MCP is for personal context and training/wellness reflection, not diagnosis or treatment.

## Development

```bash
npm install
npm test
```

## Links

- Website: https://ouramcp.vercel.app/
- GitHub: https://github.com/davidmosiah/ouramcp
- npm: https://www.npmjs.com/package/oura-mcp-unofficial
- Delx Wellness registry: https://github.com/davidmosiah/delx-wellness
- Connector quality standard: https://github.com/davidmosiah/delx-wellness/blob/main/docs/connector-quality-standard.md
- Oura Cloud API docs: https://cloud.ouraring.com/docs/authentication
