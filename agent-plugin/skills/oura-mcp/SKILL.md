---
name: oura-mcp
description: >-
  Read the user's Oura Ring readiness, sleep, HRV and activity through the local oura MCP server. Use when the user asks about Oura data, readiness score, sleep quality, HRV or resting heart rate trends, or a daily or weekly Oura brief. Starts with connection status, uses synthetic demo data before OAuth, and never asks for secrets in chat.
---

# Oura

MCP server `oura` from the `oura-mcp-unofficial@0.8.0` npm package, run locally through `npx`. It reads readiness, sleep stages and score, HRV, resting heart rate, activity, workouts and tags. Data source: the official Oura Cloud API v2.

## Workflow

1. Start with `oura_connection_status`. Then pick what fits the question: `oura_daily_summary`, `oura_weekly_summary`.
2. If `oura_connection_status` reports the connector is not ready, call `oura_demo` for clearly labelled synthetic data so the user sees the shape of the answer, then give them the setup commands below to run in their own terminal.
3. Lead with the answer to the user's question, then the two or three numbers that support it, with dates. Say when data is missing or stale instead of filling gaps.

## Setup (the user runs this in a terminal, not in chat)

```bash
npx -y oura-mcp-unofficial@0.8.0 setup --client generic
npx -y oura-mcp-unofficial@0.8.0 auth
npx -y oura-mcp-unofficial@0.8.0 doctor
```

`setup` asks for the Oura developer app client ID and secret and saves them locally (`--client generic` because this plugin already registers the server with Hermes); `auth` opens the Oura consent page in the browser and stores the OAuth tokens under `~/.oura-mcp/` with 0600 permissions; `doctor` confirms readiness.

## Safety

- Never ask the user to paste client secrets, passwords, tokens or MFA codes into the chat; setup happens in their terminal.
- Tools that change local state: oura_profile_update (local profile only), oura_exchange_code (stores OAuth tokens locally). Use them only when the user asks.
- Destructive: oura_revoke_access (revokes the Oura grant and deletes local tokens). Confirm with the user first.
- Not medical advice: the data supports personal reflection and planning, not diagnosis or treatment. Point the user to a clinician for symptoms, medication or anything urgent.
