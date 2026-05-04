# Oura MCP Skill

Use this skill whenever a user asks Hermes to inspect Oura readiness, activity, sleep, heart-rate, HRV, SpO2, workouts, daily summaries or weekly summaries.

Rules:

- Start with `mcp_oura_oura_connection_status`.
- Prefer `mcp_oura_oura_daily_summary` and `mcp_oura_oura_weekly_summary` before low-level endpoint calls.
- Treat Oura data as sensitive. Do not request raw payloads unless the user explicitly asks.
- Do not diagnose or treat medical conditions.
- Reload MCP with `/reload-mcp` or `hermes mcp test oura`; do not restart the gateway for normal data access.
