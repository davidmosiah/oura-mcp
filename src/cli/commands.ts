import { buildConnectionStatus } from "../services/connection-status.js";
import { SERVER_VERSION } from "../constants.js";
import { parseAgentClientName } from "../services/agent-manifest.js";
import { getOnboardingFlow, getProfilePath } from "../services/profile-store.js";
import { runAuthCommand } from "./auth.js";
import { runSetupCommand } from "./setup.js";

export async function runCliCommand(args: string[]): Promise<number | undefined> {
  const [command, ...rest] = args;
  if (!command || command === "--http") return undefined;
  if (command === "setup") return runSetupCommand(rest);
  if (command === "doctor" || command === "status") return runDoctor(rest);
  if (command === "auth") return runAuthCommand(rest);
  if (command === "onboarding") return runOnboarding(rest);
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(SERVER_VERSION);
    return 0;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }
  if (!command.startsWith("--")) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }
  return undefined;
}

function runOnboarding(args: string[]): number {
  let locale: "en" | "pt-BR" = "en";
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--locale") {
      const value = args[index + 1];
      if (value === "pt-BR" || value === "en") locale = value;
      index += 1;
    } else if (args[index] === "--pt-BR" || args[index] === "--pt") {
      locale = "pt-BR";
    }
  }
  const flow = getOnboardingFlow(locale);
  console.log(JSON.stringify(flow, null, 2));
  if (process.stderr.isTTY) {
    const lines = [
      "",
      "# Delx Wellness Onboarding (shared profile)",
      "",
      `The agent will ask these ${flow.questions.length} questions next — non-secret data only,`,
      `stored at ~/.delx-wellness/profile.json (locale: ${flow.locale}).`,
      "",
      "Privacy contract:",
      "- Profile NEVER stores OAuth tokens, API keys, refresh tokens, cookies, or any provider secret.",
      "- Tokens stay in this connector's own ~/.oura-mcp/tokens.json (0600 permissions).",
      "- The shared profile is read/written by every Delx Wellness connector — answer once, reuse everywhere.",
      "",
      `Storage path: ${getProfilePath()}`,
      ""
    ];
    process.stderr.write(lines.join("\n"));
  }
  return 0;
}

async function runDoctor(args: string[]): Promise<number> {
  const options = parseDoctorOptions(args);
  const status = await buildConnectionStatus({ client: options.client });
  if (options.json) {
    console.log(JSON.stringify(safeDoctorStatus(status), null, 2));
  } else {
    printDoctor(status);
  }
  return options.strict && !status.ok ? 1 : 0;
}

function parseDoctorOptions(args: string[]) {
  let client: ReturnType<typeof parseAgentClientName> | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--client") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --client.");
      client = parseAgentClientName(value);
      index += 1;
    }
  }
  return {
    json: args.includes("--json"),
    strict: args.includes("--strict"),
    client
  };
}


function safeDoctorStatus(status: Awaited<ReturnType<typeof buildConnectionStatus>>): unknown {
  const raw = status as Record<string, any>;
  const safe = JSON.parse(JSON.stringify(raw));
  if (safe.config) delete safe.config.path;
  if (safe.token) {
    delete safe.token.path;
    delete safe.token.display_name;
  }
  if (safe.cache) delete safe.cache.path;
  if (safe.oauth) {
    safe.oauth = {
      scope_status: safe.oauth.scope_status,
      granted_scope_count: Array.isArray(safe.oauth.granted_scopes) ? safe.oauth.granted_scopes.length : 0,
      missing_recommended_scope_count: Array.isArray(safe.oauth.missing_recommended_scopes) ? safe.oauth.missing_recommended_scopes.length : 0,
    };
  }
  if (safe.client_checks?.hermes) {
    delete safe.client_checks.hermes.config_path;
    delete safe.client_checks.hermes.skill_path;
  }
  return safe;
}

function printDoctor(status: Awaited<ReturnType<typeof buildConnectionStatus>>): void {
  const ok = "✓";
  const fail = "✗";
  const info = "·";
  const check = (passed: boolean) => (passed ? ok : fail);
  const line = (mark: string, label: string, detail?: string) => {
    const labelCol = label.padEnd(28);
    console.log(`  ${mark}  ${labelCol}${detail ? `  ${detail}` : ""}`);
  };

  console.log("Oura MCP · Doctor");
  console.log(`Status: ${status.ok ? `READY ${ok}` : `NEEDS SETUP ${fail}`}`);
  if (status.client) console.log(`Client: ${status.client}`);
  console.log("");
  console.log("Checks");
  line(check(status.node.supported), "Node.js >=20", status.node.supported ? undefined : `version ${status.node.version}`);
  line(check(status.missing_env.length === 0), "Env vars", status.missing_env.length ? `missing: ${status.missing_env.join(", ")}` : undefined);
  line(check(status.config.exists), "Local config", status.config.exists ? status.config.source : "missing");
  line(check(status.automatic_auth_supported), "Automatic auth redirect", status.automatic_auth_supported ? undefined : "not configured for local callback");
  line(check(status.token.exists), "Token file", status.token.exists ? "present" : "missing");
  if (status.token.exists) {
    line(status.token.secure_permissions === false ? fail : ok, "Token permissions", status.token.secure_permissions === false ? "insecure (chmod 600)" : undefined);
    line(check(Boolean(status.token.has_refresh_token)), "Refresh token", status.token.has_refresh_token ? undefined : "missing");
  }
  const scopesOk = status.oauth.scope_status === "ok" || status.oauth.missing_recommended_scopes.length === 0;
  line(scopesOk ? ok : fail, "OAuth scopes", status.oauth.scope_status);
  if (status.oauth.granted_scopes.length > 0) {
    console.log(`      granted:  ${status.oauth.granted_scopes.length} scope(s)`);
  }
  if (status.oauth.missing_recommended_scopes.length > 0) {
    console.log(`      missing:  ${status.oauth.missing_recommended_scopes.length} scope(s)`);
  }
  line(info, "Privacy mode", status.privacy_mode);
  line(status.cache.enabled ? ok : info, "Cache", status.cache.enabled ? "enabled" : "disabled");
  if (status.client_checks?.hermes) {
    const hermes = status.client_checks.hermes;
    console.log("");
    console.log("Hermes");
    line(info, "config path", hermes.config_path ? "configured" : "missing");
    line(check(hermes.oura_server_configured), "configured");
    line(check(hermes.package_pinned), "pinned package");
    line(check(hermes.skill_installed), "skill", hermes.skill_installed ? "installed" : "missing");
    line(info, "direct tool prefix", hermes.direct_tool_prefix);
  }
  console.log("");
  console.log("Next steps");
  status.next_steps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
  if (status.client_checks?.hermes?.recommendations.length) {
    console.log("");
    console.log("Hermes recommendations");
    status.client_checks.hermes.recommendations.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
  }
}

function printHelp(): void {
  console.log(`Oura MCP Server

Usage:
  oura-mcp-server                 Start MCP stdio server
  oura-mcp-server --http          Start local HTTP MCP server
  oura-mcp-server setup           Guided setup, local config, and MCP client config
  oura-mcp-server doctor          Check setup and next steps
  oura-mcp-server doctor --json   Print setup status as JSON
  oura-mcp-server doctor --client hermes
  oura-mcp-server auth            Authorize Oura with local browser callback
  oura-mcp-server auth --no-open  Print auth URL without opening browser
  oura-mcp-server onboarding      Print the shared Delx wellness onboarding flow (11 questions)
  oura-mcp-server onboarding --pt-BR
                                  Print the onboarding flow in pt-BR

Required env:
  OURA_CLIENT_ID
  OURA_CLIENT_SECRET
  OURA_REDIRECT_URI=http://127.0.0.1:3000/callback
`);
}
