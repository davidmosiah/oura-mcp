# Privacy

Oura health data is sensitive. This MCP stores OAuth tokens locally under `~/.oura-mcp/` and never prints token values.

## Modes

- `summary`: minimal fields for safe agent use.
- `structured`: normalized Oura Cloud API v2 data.
- `raw`: upstream Oura JSON, only when explicitly requested.

## Boundary

The MCP uses the official Oura Cloud API v2. It does not expose raw accelerometer telemetry, private Google endpoints, or medical diagnosis.
