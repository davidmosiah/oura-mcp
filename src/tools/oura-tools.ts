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
  DataInventoryOutputSchema,
  EndpointDataOutputSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeOutputSchema,
  PrivacyAuditOutputSchema,
  ResponseOnlyInputSchema,
  RevokeAccessOutputSchema,
  SimpleReadInputSchema,
  SummaryOutputSchema,
  WeeklySummaryInputSchema,
  WellnessContextInputSchema,
  WellnessContextOutputSchema
} from "../schemas/common.js";
import { buildAgentManifest, formatAgentManifestMarkdown } from "../services/agent-manifest.js";
import { buildPrivacyAudit } from "../services/audit.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildDataInventory, formatInventoryMarkdown } from "../services/inventory.js";
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
  server.registerTool("oura_data_inventory", {
    title: "Oura Data Inventory",
    description: "Inventory supported Oura data domains, auth scope requirements, privacy boundary and recommended first calls. Does not call Oura APIs or expose user data.",
    inputSchema: ResponseOnlyInputSchema.shape,
    outputSchema: DataInventoryOutputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }, async ({ response_format }) => {
    const inventory = buildDataInventory();
    return makeResponse(inventory, response_format, formatInventoryMarkdown(inventory));
  });
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

  server.registerTool(
    "oura_quickstart",
    {
      title: "Oura Quickstart",
      description:
        "Personalized 3-step setup walkthrough for the human user. Adapts to current state (env vars set? token present? what's next?). Call this first when the user asks 'how do I connect Oura?'",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ response_format }) => {
      const status = await buildConnectionStatus();
      const hasEnv = status.missing_env.length === 0;
      const hasToken = status.ready_for_oura_api;
      const steps = [
        {
          step: 1,
          title: hasEnv ? "(done) Oura Developer credentials configured" : "Sign up at https://cloud.ouraring.com/oauth/applications",
          action: hasEnv
            ? "OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_REDIRECT_URI are all set."
            : `Create an Oura Cloud OAuth app, register a redirect URI (use ${status.redirect_uri ?? "http://127.0.0.1:3000/callback"}), then set: ${status.missing_env.join(", ")}.`,
          done: hasEnv,
        },
        {
          step: 2,
          title: hasToken ? "(done) Local token present — ready to read Oura data" : "Run the OAuth dance",
          action: hasToken
            ? "Tokens stored under ~/.oura-mcp/tokens.json. The connector will refresh automatically when needed."
            : "Run `oura-mcp-server auth` (or call oura_get_auth_url + oura_exchange_code from the agent). Open the URL, grant access, paste the code. Recommended scopes: daily heartrate personal sleep workout spo2.",
          done: hasToken,
        },
        {
          step: 3,
          title: "Verify with the agent",
          action: "Call oura_connection_status, then oura_daily_summary or oura_wellness_context. Pair with wellness-nourish for recovery-aware meals.",
          example: hasToken
            ? "oura_wellness_context() → readiness + sleep stages + HRV handoff for nourish/cycle-coach."
            : "Until step 2 is done, the data tools will surface a clear 'auth required' message.",
          done: false,
        },
      ];
      const payload = {
        ok: true,
        ready: hasEnv && hasToken,
        steps,
        next: steps.find((s) => !s.done) ?? steps[steps.length - 1],
        cross_connector_hints: [
          "Pair Oura readiness/sleep with wellness-nourish for recovery-aware meal coaching.",
          "Pair Oura readiness with wellness-cycle-coach for late-luteal load adjustments.",
          "Pair Oura HRV + wellness-cgm-mcp glucose for metabolic-stress signals.",
        ],
      };
      const markdown = bulletList("Oura Quickstart", {
        ready: payload.ready,
        next: payload.next.title,
      });
      return makeResponse(payload, response_format, markdown);
    }
  );

  server.registerTool(
    "oura_demo",
    {
      title: "Oura Demo",
      description:
        "Returns realistic example payloads of oura_daily_summary, oura_wellness_context, and oura_list_daily_readiness so agents see the contract before calling real Oura APIs.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ response_format }) => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const dayBefore = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
      const payload = {
        ok: true,
        is_demo: true,
        sample: {
          oura_daily_summary: {
            date: today,
            readiness: { score: 78, temperature_deviation: -0.1, hrv_balance: 84 },
            sleep: { score: 82, efficiency: 89, duration_min: 451, deep_min: 92, rem_min: 108 },
            activity: { score: 86, steps: 9420, active_calories: 412, target_calories: 500 },
            spo2: { average: 96.8 },
          },
          oura_wellness_context: {
            window: "last_24h",
            readiness_score: 78,
            readiness_band: "good",
            sleep_score: 82,
            sleep_efficiency: 89,
            hrv_balance: 84,
            recommendation: "Solid readiness and efficient sleep — green light for moderate-to-high intensity. A protein-forward breakfast keeps HRV trending up.",
          },
          oura_list_daily_readiness: {
            count: 3,
            records: [
              { day: today, score: 78, contributors: { hrv_balance: 84, resting_heart_rate: 71, sleep_balance: 76 } },
              { day: yesterday, score: 74, contributors: { hrv_balance: 79, resting_heart_rate: 73, sleep_balance: 72 } },
              { day: dayBefore, score: 69, contributors: { hrv_balance: 68, resting_heart_rate: 80, sleep_balance: 65 } },
            ],
          },
        },
        notes: [
          "All sample data is synthetic; tagged with is_demo=true.",
          "Real calls return live data from the Oura Cloud v2 API after OAuth setup.",
        ],
      };
      const markdown = bulletList("Oura Demo", {
        is_demo: true,
        readiness_score: 78,
        sleep_efficiency: 89,
        recommendation: payload.sample.oura_wellness_context.recommendation,
      });
      return makeResponse(payload, response_format, markdown);
    }
  );

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
