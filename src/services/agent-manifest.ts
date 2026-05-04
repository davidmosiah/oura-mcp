import { NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE, SERVER_VERSION, DEFAULT_SCOPES } from "../constants.js";

export const AGENT_CLIENTS = ["generic", "claude", "cursor", "windsurf", "hermes", "openclaw"] as const;
export type AgentClientName = typeof AGENT_CLIENTS[number];

export const HERMES_DIRECT_TOOLS = [
  "mcp_oura_oura_agent_manifest",
  "mcp_oura_oura_connection_status",
  "mcp_oura_oura_daily_summary",
  "mcp_oura_oura_weekly_summary",
  "mcp_oura_oura_wellness_context",
  "mcp_oura_oura_list_daily_readiness",
  "mcp_oura_oura_list_daily_sleep",
  "mcp_oura_oura_list_heartrate"
];

const STANDARD_TOOLS = [
  "oura_agent_manifest",
  "oura_capabilities",
  "oura_connection_status",
  "oura_get_auth_url",
  "oura_exchange_code",
  "oura_get_personal_info",
  "oura_list_daily_activity",
  "oura_list_daily_sleep",
  "oura_list_daily_readiness",
  "oura_list_sleep",
  "oura_list_workouts",
  "oura_list_heartrate",
  "oura_list_daily_spo2",
  "oura_list_sessions",
  "oura_list_tags",
  "oura_daily_summary",
  "oura_weekly_summary",
  "oura_wellness_context",
  "oura_privacy_audit",
  "oura_cache_status",
  "oura_revoke_access"
];

const RESOURCES = ["oura://agent-manifest", "oura://capabilities", "oura://personal-info", "oura://latest/readiness", "oura://summary/daily", "oura://summary/weekly"];

export function parseAgentClientName(value: string): AgentClientName {
  return AGENT_CLIENTS.includes(value as AgentClientName) ? value as AgentClientName : "generic";
}

export function buildAgentManifest(client: AgentClientName = "generic") {
  return {
    project: "oura-mcp-unofficial",
    mcp_name: "io.github.davidmosiah/ouramcp",
    client,
    unofficial: true,
    package: {
      name: NPM_PACKAGE_NAME,
      version: SERVER_VERSION,
      install_command: `npx -y ${NPM_PACKAGE_NAME}`,
      pinned_install_command: `npx -y ${PINNED_NPM_PACKAGE}`,
      binary: "oura-mcp-server"
    },
    oauth: {
      provider: "Oura Cloud API v2",
      redirect_uri: "http://127.0.0.1:3000/callback",
      scopes: DEFAULT_SCOPES,
      token_storage: "~/.oura-mcp/tokens.json with 0600 permissions",
      secret_storage: "~/.oura-mcp/config.json or OURA_* environment variables; never print secrets"
    },
    recommended_first_calls: ["oura_connection_status", "oura_wellness_context", "oura_daily_summary", "oura_weekly_summary"],
    standard_tools: STANDARD_TOOLS,
    resources: RESOURCES,
    hermes: {
      config_path: "~/.hermes/config.yaml",
      skill_path: "~/.hermes/skills/oura-mcp/SKILL.md",
      tool_name_prefix: "mcp_oura_",
      common_tool_names: HERMES_DIRECT_TOOLS,
      recommended_config: hermesConfigSnippet(),
      use_direct_tools: true,
      avoid_terminal_workarounds: true,
      no_gateway_restart_for_data_access: true,
      reload_after_config_change: "/reload-mcp or hermes mcp test oura",
      doctor_command: "npx -y oura-mcp-unofficial doctor --client hermes --json"
    },
    agent_rules: [
      "Call oura_connection_status before Oura data tools.",
      "If setup is incomplete, guide the user through setup, auth and doctor instead of guessing token state.",
      "Treat Oura health data as sensitive. Do not expose raw payloads unless the user asks for raw mode.",
      "Heart-rate, SpO2 and personal fields depend on ring generation, membership, app scopes and the user's consent; explain permission errors clearly.",
      "For Hermes, do not restart the gateway for normal Oura data access; reload MCP instead.",
      "Do not provide medical diagnosis or treatment instructions. Frame outputs as health/training context."
    ],
    troubleshooting: [
      { symptom: "missing OURA_CLIENT_ID / OURA_CLIENT_SECRET / OURA_REDIRECT_URI", action: "Run `oura-mcp-server setup` or set OURA_* env vars." },
      { symptom: "401 or expired token", action: "Run `oura-mcp-server auth` again; tokens refresh automatically when refresh_token is present." },
      { symptom: "heart-rate or SpO2 endpoint forbidden", action: "Confirm Oura membership, ring support and granted scopes; re-authorize if needed." },
      { symptom: "Hermes configured but tools unavailable", action: "Run `/reload-mcp` or `hermes mcp test oura`; do not restart gateway for normal reload." }
    ],
    links: {
      github: "https://github.com/davidmosiah/ouramcp",
      docs: "https://ouramcp.vercel.app/",
      npm: "https://www.npmjs.com/package/oura-mcp-unofficial",
      oura_apps: "https://cloud.ouraring.com/oauth/applications",
      oura_api_docs: "https://cloud.ouraring.com/v2/docs"
    }
  };
}

export function formatAgentManifestMarkdown(manifest: ReturnType<typeof buildAgentManifest>): string {
  return `# Oura MCP Agent Manifest

Unofficial: ${manifest.unofficial}
Package: \`${manifest.package.name}\` v${manifest.package.version}
Install: \`${manifest.package.install_command}\`
Pinned install: \`${manifest.package.pinned_install_command}\`

## OAuth
Provider: ${manifest.oauth.provider}
Redirect URI: \`${manifest.oauth.redirect_uri}\`
Scopes: \`${manifest.oauth.scopes.join(" ")}\`
Tokens: ${manifest.oauth.token_storage}

## First Calls
${manifest.recommended_first_calls.map((tool) => `- \`${tool}\``).join("\n")}

## Hermes
Config: \`${manifest.hermes.config_path}\`
Skill: \`${manifest.hermes.skill_path}\`
Reload: \`${manifest.hermes.reload_after_config_change}\`
Direct tools:
${manifest.hermes.common_tool_names.map((tool) => `- \`${tool}\``).join("\n")}

## Agent Rules
${manifest.agent_rules.map((rule) => `- ${rule}`).join("\n")}
`;
}

export function hermesConfigSnippet(): string {
  return `mcp_servers:\n  oura:\n    command: npx\n    args:\n      - -y\n      - ${PINNED_NPM_PACKAGE}\n    timeout: 120\n    connect_timeout: 60\n    sampling:\n      enabled: false`;
}

export function hermesSkillMarkdown(): string {
  return `# Oura MCP Skill

Use this skill whenever a user asks Hermes to inspect Oura readiness, activity, sleep, heart-rate, HRV, SpO2, workouts, daily summaries or weekly summaries through the Oura MCP.

## Rules
- Start with \`mcp_oura_oura_connection_status\`.
- Prefer \`mcp_oura_oura_daily_summary\` and \`mcp_oura_oura_weekly_summary\` before low-level endpoint calls.
- Treat Oura data as sensitive. Do not request raw payloads unless the user explicitly asks.
- Do not diagnose or treat medical conditions.
- Reload MCP with \`/reload-mcp\` or \`hermes mcp test oura\`; do not restart the gateway for normal data access.
`;
}
