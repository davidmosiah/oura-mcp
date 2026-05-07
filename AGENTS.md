# Agent Development Notes

## Scope

This repo is the unofficial Oura MCP connector for local agent workflows.

## Commands

- Install: `npm ci`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Fast smoke: `npm run smoke`
- HTTP smoke: `npm run smoke:http`
- Full gate: `npm test`

## Rules

- Never commit OAuth tokens, API credentials, personal Oura data, or local config.
- Keep read-only behavior and privacy-safe summaries as the default.
- Preserve agent-ready surfaces: manifest, connection status, privacy audit, CLI UX, Hermes agent manifest, and metadata checks.
- Keep wellness language clearly non-medical.
