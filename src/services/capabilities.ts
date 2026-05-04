import { DEFAULT_SCOPES } from "../constants.js";

export function buildCapabilities() {
  return {
    project: "oura-mcp-unofficial",
    mcp_name: "io.github.davidmosiah/ouramcp",
    creator: { name: "David Mosiah", github: "https://github.com/davidmosiah" },
    unofficial: true,
    api_boundary: {
      source: "Official Oura Cloud API v2 with OAuth 2.0",
      raw_definition: "Raw means the full JSON response returned by supported Oura Cloud API v2 endpoints. Heart-rate and SpO2 availability depends on ring generation, membership, and scopes granted by the user.",
      does_not_include: [
        "raw accelerometer/device telemetry",
        "continuous unrestricted sensor streams",
        "private Oura mobile app endpoints",
        "write/upload actions by default",
        "medical diagnosis or treatment guidance"
      ]
    },
    auth_model: {
      type: "OAuth 2.0 authorization code with refresh tokens",
      token_storage: "Local token file with user-only permissions",
      recommended_redirect_uri: "http://127.0.0.1:3000/callback",
      default_scopes: DEFAULT_SCOPES
    },
    privacy_modes: [
      { mode: "summary", use_when: "Default-safe interpretation with identifiers and profile details minimized." },
      { mode: "structured", use_when: "Normalized readiness, sleep, activity, heart and workout metrics for agents." },
      { mode: "raw", use_when: "The user explicitly needs upstream Oura payloads for debugging or deep analysis." }
    ],
    supported_data: [
      { name: "Personal info", examples: ["age", "height", "weight", "biological sex", "email when granted"], tools: ["oura_get_personal_info"] },
      { name: "Daily recovery context", examples: ["readiness score", "sleep score", "activity score", "contributors"], tools: ["oura_list_daily_readiness", "oura_list_daily_sleep", "oura_list_daily_activity"] },
      { name: "Sleep", examples: ["sleep periods", "duration", "stages", "efficiency", "average HRV"], tools: ["oura_list_sleep", "oura_daily_summary", "oura_weekly_summary", "oura_wellness_context"] },
      { name: "Heart and oxygen", examples: ["heart-rate time series", "lowest heart rate", "average HRV", "daily SpO2"], tools: ["oura_list_heartrate", "oura_list_daily_spo2"] },
      { name: "Workouts and context", examples: ["workout summaries", "sessions", "tags"], tools: ["oura_list_workouts", "oura_list_sessions", "oura_list_tags"] }
    ],
    recommended_agent_flow: [
      "Call oura_agent_manifest when installing or operating inside a server agent such as Hermes.",
      "Call oura_connection_status before calling Oura data tools.",
      "If setup is incomplete, guide the user through setup, auth and doctor.",
      "Use oura_daily_summary or oura_weekly_summary before low-level endpoint tools.",
      "Use oura_wellness_context when handing readiness/sleep/load context to Exercise Catalog.",
      "Treat health data as sensitive; avoid raw payloads unless explicitly requested.",
      "Use Oura as trend context, not medical diagnosis. Escalate symptoms or abnormal vitals to clinicians."
    ],
    client_aliases: {
      hermes: {
        tool_prefix: "mcp_oura_",
        direct_tools: ["mcp_oura_oura_agent_manifest", "mcp_oura_oura_connection_status", "mcp_oura_oura_daily_summary", "mcp_oura_oura_weekly_summary"],
        reload_command: "/reload-mcp",
        gateway_restart_required_for_data_access: false
      }
    },
    contribution_paths: [
      "Improve non-technical setup UX.",
      "Add more MCP client examples and screenshots.",
      "Add richer Oura endpoint coverage as v2 data types expand.",
      "Add evaluations for realistic health and training questions.",
      "Consider optional write tools only behind explicit opt-in and safety gates."
    ],
    links: {
      github: "https://github.com/davidmosiah/ouramcp",
      docs: "https://ouramcp.vercel.app/",
      npm: "https://www.npmjs.com/package/oura-mcp-unofficial",
      oura_api_docs: "https://cloud.ouraring.com/v2/docs",
      oura_auth_docs: "https://cloud.ouraring.com/docs/authentication",
      oura_apps: "https://cloud.ouraring.com/oauth/applications"
    }
  };
}
