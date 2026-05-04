import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { buildAgentManifest, formatAgentManifestMarkdown } from "../services/agent-manifest.js";
import { buildCapabilities } from "../services/capabilities.js";
import { getConfig } from "../services/config.js";
import { applyPrivacy, resolvePrivacyMode } from "../services/privacy.js";
import { buildDailySummary, buildWeeklySummary, formatSummaryMarkdown } from "../services/summary.js";
import { OuraClient } from "../services/oura-client.js";

function textResource(uri: URL, text: string, mimeType = "text/markdown"): ReadResourceResult {
  return { contents: [{ uri: uri.toString(), mimeType, text }] };
}

async function profileResource(uri: URL) {
  const config = getConfig();
  const endpoint = "/usercollection/personal_info";
  const data = applyPrivacy(endpoint, await new OuraClient(config).get(endpoint), resolvePrivacyMode(config));
  return textResource(uri, JSON.stringify({ endpoint, data }, null, 2), "application/json");
}

async function latestActivityResource(uri: URL) {
  const config = getConfig();
  const endpoint = "/usercollection/daily_readiness";
  const result = await new OuraClient(config).list(endpoint, { limit: 1 });
  const data = applyPrivacy(endpoint, { records: result.records }, resolvePrivacyMode(config));
  return textResource(uri, JSON.stringify(data, null, 2), "application/json");
}

async function dailySummaryResource(uri: URL) {
  const summary = await buildDailySummary(new OuraClient(getConfig()), { days: 7, timezone: "UTC" });
  return textResource(uri, formatSummaryMarkdown(summary));
}

async function weeklySummaryResource(uri: URL) {
  const summary = await buildWeeklySummary(new OuraClient(getConfig()), { days: 7, compare_days: 7, timezone: "UTC" });
  return textResource(uri, formatSummaryMarkdown(summary));
}

export function registerOuraResources(server: McpServer): void {
  server.registerResource("oura_capabilities", "oura://capabilities", { title: "Oura MCP Capabilities", description: "Static capabilities, API boundary, privacy modes and recommended agent workflow.", mimeType: "application/json" }, async (uri) => textResource(uri, JSON.stringify(buildCapabilities(), null, 2), "application/json"));
  server.registerResource("oura_agent_manifest", "oura://agent-manifest", { title: "Oura Agent Manifest", description: "Machine-readable install and operating instructions for AI agents.", mimeType: "text/markdown" }, async (uri) => textResource(uri, formatAgentManifestMarkdown(buildAgentManifest("generic"))));
  server.registerResource("oura_personal_info", "oura://personal-info", { title: "Oura Personal Info", description: "Authenticated Oura personal info using the configured privacy mode.", mimeType: "application/json" }, profileResource);
  server.registerResource("oura_latest_readiness", "oura://latest/readiness", { title: "Latest Oura Readiness", description: "Most recent Oura readiness record in the configured privacy mode.", mimeType: "application/json" }, latestActivityResource);
  server.registerResource("oura_daily_summary", "oura://summary/daily", { title: "Oura Daily Summary", description: "Daily Oura health summary built from API data.", mimeType: "text/markdown" }, dailySummaryResource);
  server.registerResource("oura_weekly_summary", "oura://summary/weekly", { title: "Oura Weekly Summary", description: "Weekly Oura health review built from API data.", mimeType: "text/markdown" }, weeklySummaryResource);
}
