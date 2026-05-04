# Oura MCP Quickstart

1. Create an Oura app at https://cloud.ouraring.com/oauth/applications
2. Set callback URL: `http://127.0.0.1:3000/callback`
3. Use scopes: `daily heartrate personal sleep workout spo2`
4. Run:

```bash
npx -y oura-mcp-unofficial setup
npx -y oura-mcp-unofficial auth
npx -y oura-mcp-unofficial doctor
```

Add to your MCP client:

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
