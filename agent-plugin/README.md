# Oura — Agent Plugins package

Portable [Agent Plugins](https://agent-plugins.org/) v1 package for
[Hermes Agent](https://github.com/NousResearch/hermes-agent) and other Agent Plugins clients:
the `oura` MCP server (`oura-mcp-unofficial@0.8.0` over stdio) plus the `oura-mcp` workflow skill.

## Install (Hermes Agent)

```bash
hermes plugins install davidmosiah/oura-mcp/agent-plugin --no-enable
hermes plugins enable oura-mcp
```

Requires Node.js 20+ (`npx` on PATH). The skill loads as `oura-mcp:oura-mcp`.

## Connector setup

```bash
npx -y oura-mcp-unofficial@0.8.0 setup --client generic
npx -y oura-mcp-unofficial@0.8.0 auth
npx -y oura-mcp-unofficial@0.8.0 doctor
```

`setup` asks for the Oura developer app client ID and secret and saves them locally (`--client generic` because this plugin already registers the server with Hermes); `auth` opens the Oura consent page in the browser and stores the OAuth tokens under `~/.oura-mcp/` with 0600 permissions; `doctor` confirms readiness.

## Disclosure

Runs the `oura-mcp-unofficial@0.8.0` npm package locally over stdio through `npx` (Node.js 20+ required); the package is downloaded from npm on first start. Data source: the official Oura Cloud API v2. Credentials and OAuth tokens are created by the connector's own `setup`/`auth` commands in the user's terminal and stay on the machine (`~/.oura-mcp/`); the plugin declares no environment variables and reads no Hermes credentials. Tools that change state: oura_profile_update (local profile only); oura_exchange_code (stores OAuth tokens locally); oura_revoke_access (revokes the Oura grant and deletes local tokens). The tool set comes from the pinned npm version, not from this repository's source tree.
