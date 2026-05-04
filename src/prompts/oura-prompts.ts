import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function userPrompt(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function registerOuraPrompts(server: McpServer): void {
  server.registerPrompt("oura_daily_checkin", {
    title: "Oura Daily Check-in",
    description: "Ask an agent to create a practical daily health and training check-in from Oura.",
    argsSchema: { focus: z.string().optional().describe("Optional focus, e.g. sleep, readiness, training, recovery, HRV.") }
  }, ({ focus }) => userPrompt(`Use Oura MCP for a daily check-in${focus ? ` focused on ${focus}` : ""}.

Required flow:
1. Call oura_connection_status.
2. If ready, call oura_daily_summary with response_format=json.
3. Only drill into low-level tools if the summary shows a concrete question.

Return:
- main signal
- what changed or needs attention
- 3 practical actions for today
- confidence and missing data
- no medical diagnosis.`));

  server.registerPrompt("oura_weekly_review", {
    title: "Oura Weekly Review",
    description: "Ask an agent to review Oura trends across activity, sleep and heart context.",
    argsSchema: { goal: z.string().optional().describe("Optional goal, e.g. fat loss, tennis conditioning, endurance base, sleep repair.") }
  }, ({ goal }) => userPrompt(`Use Oura MCP for a weekly review${goal ? ` for this goal: ${goal}` : ""}.

Required flow:
1. Call oura_connection_status.
2. Call oura_weekly_summary with response_format=json.
3. Use oura_list_daily_readiness, oura_list_daily_sleep, oura_list_sleep or oura_list_heartrate only to investigate specific bottlenecks.

Return:
- scorecard
- bottlenecks
- next-week actions
- risks/unknowns
- no medical diagnosis.`));

  server.registerPrompt("oura_heart_context_investigation", {
    title: "Oura Heart Context Investigation",
    description: "Investigate Oura heart-rate records and adjacent sleep context when API access permits it.",
    argsSchema: { after: z.string().describe("ISO 8601 start date-time"), before: z.string().optional().describe("Optional ISO 8601 end date-time") }
  }, ({ after, before }) => userPrompt(`Call oura_list_heartrate with after=${after}${before ? `, before=${before}` : ""}, response_format=json.

Explain:
- what the samples can and cannot prove
- notable periods or missing data
- whether follow-up should use sleep/activity tools
- no diagnosis or alarmism.`));
}
