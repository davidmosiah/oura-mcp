# Hermes Example

```bash
npx -y oura-mcp-unofficial setup --client hermes --no-auth
npx -y oura-mcp-unofficial auth
npx -y oura-mcp-unofficial doctor --client hermes
```

Useful direct tools:

- `mcp_oura_oura_connection_status`
- `mcp_oura_oura_daily_summary`
- `mcp_oura_oura_weekly_summary`
- `mcp_oura_oura_list_daily_readiness`
- `mcp_oura_oura_list_daily_sleep`
- `mcp_oura_oura_list_heartrate`

Keep `OURA_CLIENT_SECRET` and OAuth tokens out of prompts, logs and public repos.
