import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AgentManifestInputSchema,
  AgentManifestOutputSchema,
  AuthUrlInputSchema,
  AuthUrlOutputSchema,
  CacheStatusOutputSchema,
  CapabilitiesOutputSchema,
  CollectionInputSchema,
  CollectionOutputSchema,
  ConnectionStatusInputSchema,
  ConnectionStatusOutputSchema,
  DailySummaryInputSchema,
  EndpointDataOutputSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeOutputSchema,
  PrivacyAuditOutputSchema,
  RevokeAccessOutputSchema,
  ResponseOnlyInputSchema,
  SimpleReadInputSchema,
  SummaryOutputSchema,
  WeeklySummaryInputSchema,
  WellnessContextInputSchema,
  WellnessContextOutputSchema
} from "../schemas/common.js";
import { buildAgentManifest, formatAgentManifestMarkdown } from "../services/agent-manifest.js";
import { buildPrivacyAudit } from "../services/audit.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import { getConfig } from "../services/config.js";
import { bulletList, formatCollection, makeError, makeResponse } from "../services/format.js";
import { applyPrivacy, resolvePrivacyMode } from "../services/privacy.js";
import { buildDailySummary, buildWeeklySummary, formatSummaryMarkdown } from "../services/summary.js";
import { buildWellnessContext, formatWellnessContextMarkdown } from "../services/context.js";
import { OuraClient } from "../services/oura-client.js";

function client(): OuraClient {
  return new OuraClient(getConfig());
}

function registerCollectionTool(server: McpServer, name: string, title: string, endpoint: string, description: string): void {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema: CollectionInputSchema.shape,
      outputSchema: CollectionOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params) => {
      try {
        const config = getConfig();
        const privacyMode = resolvePrivacyMode(config, params.privacy_mode);
        const result = await new OuraClient(config).list(endpoint, params);
        const records = applyPrivacy(endpoint, { records: result.records }, privacyMode) as { records: unknown[] };
        const output = {
          endpoint,
          privacy_mode: privacyMode,
          count: records.records.length,
          records: records.records,
          next_page: result.next_page,
          has_more: Boolean(result.next_page),
          pages_fetched: result.pages_fetched
        };
        return makeResponse(output, params.response_format, formatCollection(title, records.records, output));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );
}

export function registerOuraTools(server: McpServer): void {
  server.registerTool("oura_agent_manifest", {
    title: "Oura Agent Manifest",
    description: "Machine-readable install, runtime and client guidance for AI agents. Does not call Oura or expose secrets.",
    inputSchema: AgentManifestInputSchema.shape,
    outputSchema: AgentManifestOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ client: targetClient, response_format }) => {
    const manifest = buildAgentManifest(targetClient);
    return makeResponse(manifest, response_format, formatAgentManifestMarkdown(manifest));
  });

  server.registerTool("oura_capabilities", {
    title: "Oura MCP Capabilities",
    description: "Explain supported Oura data, privacy boundaries, recommended agent workflow and project links.",
    inputSchema: ResponseOnlyInputSchema.shape,
    outputSchema: CapabilitiesOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ response_format }) => {
    const capabilities = buildCapabilities();
    return makeResponse(capabilities, response_format, bulletList("Oura MCP Capabilities", {
      project: capabilities.project,
      unofficial: capabilities.unofficial,
      api_boundary: capabilities.api_boundary.source,
      recommended_first_tools: "oura_connection_status, oura_daily_summary, oura_weekly_summary",
      docs: capabilities.links.docs
    }));
  });

  server.registerTool("oura_get_auth_url", {
    title: "Get Oura OAuth URL",
    description: "Generate an Oura OAuth authorization URL. Use this first when no local token exists.",
    inputSchema: AuthUrlInputSchema.shape,
    outputSchema: AuthUrlOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params) => {
    try {
      const config = getConfig();
      const url = new OuraClient(config).authUrl(params.state, params.scopes);
      const output = { auth_url: url, redirect_uri: config.redirectUri, scopes: params.scopes?.length ? params.scopes : config.scopes, next_step: "Open auth_url, approve access, then pass the returned code or full redirect URL to oura_exchange_code." };
      return makeResponse(output, params.response_format, bulletList("Oura OAuth URL", output));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });

  server.registerTool("oura_exchange_code", {
    title: "Exchange Oura OAuth Code",
    description: "Exchange an Oura OAuth authorization code for local tokens. Tokens are stored locally with 0600 permissions and are never returned.",
    inputSchema: ExchangeCodeInputSchema.shape,
    outputSchema: ExchangeCodeOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, async (params) => {
    try {
      const result = await client().exchangeCode(params.code);
      const output = { ...result, note: "Token values were stored locally and intentionally omitted from this response." };
      return makeResponse(output, params.response_format, bulletList("Oura OAuth Exchange", output));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });

  server.registerTool("oura_get_personal_info", {
    title: "Get Oura Personal Info",
    description: "Get Oura personal profile fields available to the authorized app. Requires the personal scope.",
    inputSchema: SimpleReadInputSchema.shape,
    outputSchema: EndpointDataOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ response_format, privacy_mode }) => {
    try {
      const config = getConfig();
      const endpoint = "/usercollection/personal_info";
      const privacyMode = resolvePrivacyMode(config, privacy_mode);
      const data = applyPrivacy(endpoint, await new OuraClient(config).get(endpoint), privacyMode);
      return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Oura Personal Info", data as Record<string, unknown>));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });

  registerCollectionTool(server, "oura_list_daily_activity", "Oura Daily Activity", "/usercollection/daily_activity", "List daily Oura activity summaries. Supports start/end date filters through after/before and Oura cursor pagination.");
  registerCollectionTool(server, "oura_list_daily_sleep", "Oura Daily Sleep", "/usercollection/daily_sleep", "List daily Oura sleep score summaries. Requires daily or sleep data access granted by the user. Not medical advice.");
  registerCollectionTool(server, "oura_list_daily_readiness", "Oura Daily Readiness", "/usercollection/daily_readiness", "List Oura readiness summaries and contributors. Requires daily scope. Not medical advice.");
  registerCollectionTool(server, "oura_list_sleep", "Oura Sleep Periods", "/usercollection/sleep", "List detailed Oura sleep period records, including sleep stages and timing where available. Requires sleep scope. Not medical advice.");
  registerCollectionTool(server, "oura_list_workouts", "Oura Workouts", "/usercollection/workout", "List Oura workout summaries. Requires workout scope.");
  registerCollectionTool(server, "oura_list_heartrate", "Oura Heart Rate", "/usercollection/heartrate", "List Oura heart-rate time-series records where the user's ring and membership expose them. Requires heartrate scope. Not medical advice.");
  registerCollectionTool(server, "oura_list_daily_spo2", "Oura Daily SpO2", "/usercollection/daily_spo2", "List daily Oura SpO2 averages recorded during sleep when available. Requires spo2 scope. Not medical advice.");
  registerCollectionTool(server, "oura_list_sessions", "Oura Sessions", "/usercollection/session", "List guided and unguided Oura app sessions when the user granted session scope.");
  registerCollectionTool(server, "oura_list_tags", "Oura Tags", "/usercollection/tag", "List user-entered Oura tags when the user granted tag scope.");

  server.registerTool("oura_connection_status", {
    title: "Oura Connection Status",
    description: "Check local Oura config, token file, Node version, privacy mode, cache readiness and optional MCP client readiness without calling Oura or exposing secrets.",
    inputSchema: ConnectionStatusInputSchema.shape,
    outputSchema: ConnectionStatusOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ response_format, client: targetClient }) => {
    const status = await buildConnectionStatus({ client: targetClient });
    return makeResponse(status, response_format, bulletList("Oura Connection Status", {
      ok: status.ok,
      ready_for_oura_api: status.ready_for_oura_api,
      missing_env: status.missing_env.join(", ") || "none",
      scope_status: status.oauth.scope_status,
      token_path: status.token.path,
      token_exists: status.token.exists,
      privacy_mode: status.privacy_mode,
      next_steps: status.next_steps.join(" | ")
    }));
  });

  server.registerTool("oura_cache_status", {
    title: "Oura Cache Status",
    description: "Show optional local SQLite cache status. Enable with OURA_CACHE=sqlite or OURA_CACHE=true.",
    inputSchema: ResponseOnlyInputSchema.shape,
    outputSchema: CacheStatusOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ response_format }) => {
    try {
      const status = client().cacheStatus();
      return makeResponse(status, response_format, bulletList("Oura Cache Status", status));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });

  server.registerTool("oura_privacy_audit", {
    title: "Oura Privacy Audit",
    description: "Return local privacy, cache, token-path and env-presence posture without revealing secret values.",
    inputSchema: ResponseOnlyInputSchema.shape,
    outputSchema: PrivacyAuditOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ response_format }) => {
    const audit = buildPrivacyAudit();
    return makeResponse(audit, response_format, bulletList("Oura Privacy Audit", audit));
  });

  server.registerTool("oura_revoke_access", {
    title: "Revoke Oura OAuth Access",
    description: "Revoke the current Oura OAuth grant and delete the local token file. Use only when the user explicitly wants to disconnect Oura.",
    inputSchema: ResponseOnlyInputSchema.shape,
    outputSchema: RevokeAccessOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  }, async ({ response_format }) => {
    try {
      const result = await client().revokeAccess();
      const output = { ...result, note: "Oura access was revoked and local tokens were removed. Re-authorize before future API calls." };
      return makeResponse(output, response_format, bulletList("Oura Access Revoked", output));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });

  server.registerTool("oura_daily_summary", {
    title: "Oura Daily Recovery Summary",
    description: "Build a practical daily summary from Oura readiness, sleep, activity, heart-rate and SpO2 data when available. Read-only and non-medical.",
    inputSchema: DailySummaryInputSchema.shape,
    outputSchema: SummaryOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async (params) => {
    try {
      const summary = await buildDailySummary(client(), params);
      return makeResponse(summary, params.response_format, formatSummaryMarkdown(summary));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });

  server.registerTool("oura_weekly_summary", {
    title: "Oura Weekly Recovery Review",
    description: "Build a weekly Oura scorecard with readiness, sleep, activity, HRV availability, bottlenecks and actions. Read-only and non-medical.",
    inputSchema: WeeklySummaryInputSchema.shape,
    outputSchema: SummaryOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async (params) => {
    try {
      const summary = await buildWeeklySummary(client(), params);
      return makeResponse(summary, params.response_format, formatSummaryMarkdown(summary));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });

  server.registerTool("oura_wellness_context", {
    title: "Oura Wellness Context",
    description: "Normalize Oura readiness, sleep and activity load into the shared wellness_context shape for recommendation engines.",
    inputSchema: WellnessContextInputSchema.shape,
    outputSchema: WellnessContextOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async (params) => {
    try {
      const context = await buildWellnessContext(client(), params);
      return makeResponse(context, params.response_format, formatWellnessContextMarkdown(context));
    } catch (error) {
      return makeError((error as Error).message);
    }
  });
}
