import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const expectedTools = [
  'oura_agent_manifest', 'oura_cache_status', 'oura_capabilities', 'oura_connection_status',
  'oura_daily_summary', 'oura_data_inventory', 'oura_demo', 'oura_exchange_code',
  'oura_get_auth_url', 'oura_get_personal_info', 'oura_list_daily_activity', 'oura_list_daily_readiness',
  'oura_list_daily_sleep', 'oura_list_daily_spo2', 'oura_list_heartrate', 'oura_list_sessions',
  'oura_list_sleep', 'oura_list_tags', 'oura_list_workouts', 'oura_onboarding',
  'oura_privacy_audit', 'oura_profile_get', 'oura_profile_update', 'oura_quickstart',
  'oura_revoke_access', 'oura_weekly_summary', 'oura_wellness_context'
];

const expectedResources = [
  'oura://agent-manifest', 'oura://capabilities', 'oura://inventory', 'oura://latest/readiness',
  'oura://personal-info', 'oura://summary/daily', 'oura://summary/weekly'
];
const expectedPrompts = ['oura_daily_checkin', 'oura_heart_context_investigation', 'oura_weekly_review'];

const home = await mkdtemp(join(tmpdir(), 'oura-smoke-'));
const client = new Client({ name: 'oura-mcp-smoke-test', version: '0.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['dist/index.js'],
  env: { HOME: home, USERPROFILE: home, PATH: process.env.PATH ?? '' }
});
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, expectedTools.sort());

  // Claude Desktop uses a 2020-12 validator and rejects draft-07 declarations.
  const ajv = new Ajv2020({ strictSchema: true, strictTypes: true, validateSchema: true });
  addFormats(ajv);
  const validators = new Map();
  for (const tool of tools.tools) {
    for (const direction of ['inputSchema', 'outputSchema']) {
      if (!tool[direction]) continue;
      const validate = ajv.compile(tool[direction]);
      assert.equal(tool[direction].$schema, 'https://json-schema.org/draft/2020-12/schema', `${tool.name}.${direction}`);
      validators.set(`${tool.name}.${direction}`, validate);
    }
  }
  const summaryInput = validators.get('oura_daily_summary.inputSchema');
  assert.equal(summaryInput({}), true, 'defaulted input fields remain optional');
  assert.equal(summaryInput({ days: 0 }), false, 'minimum bound remains enforced');
  assert.equal(summaryInput({ response_format: 'xml' }), false, 'response format enum remains enforced');
  const exchangeInput = validators.get('oura_exchange_code.inputSchema');
  assert.equal(exchangeInput({ code: 'synthetic-code' }), true);
  assert.equal(exchangeInput({}), false, 'required code remains required');

  const resources = await client.listResources();
  const resourceUris = resources.resources.map((resource) => resource.uri).sort();
  assert.deepEqual(resourceUris, expectedResources.sort());

  const prompts = await client.listPrompts();
  const promptNames = prompts.prompts.map((prompt) => prompt.name).sort();
  assert.deepEqual(promptNames, expectedPrompts.sort());

  const prompt = await client.getPrompt({ name: 'oura_daily_checkin', arguments: { focus: 'sleep' } });
  assert.ok(prompt.messages[0]?.content?.type === 'text');

  const auditResult = await client.callTool({ name: 'oura_privacy_audit', arguments: { response_format: 'json' } });
  assert.equal(auditResult.structuredContent?.unofficial, true);
  assert.ok(auditResult.structuredContent?.secret_env_vars?.includes('OURA_CLIENT_SECRET'));

  const capabilitiesResult = await client.callTool({ name: 'oura_capabilities', arguments: { response_format: 'json' } });
  const capabilitiesOutput = validators.get('oura_capabilities.outputSchema');
  assert.equal(capabilitiesOutput(capabilitiesResult.structuredContent), true);
  assert.equal(capabilitiesOutput({ ...capabilitiesResult.structuredContent, unofficial: 'true' }), false);
  assert.equal(capabilitiesResult.structuredContent?.unofficial, true);
  assert.ok(capabilitiesResult.structuredContent?.api_boundary?.does_not_include?.includes('raw accelerometer/device telemetry'));
  assert.ok(capabilitiesResult.structuredContent?.supported_data?.some((entry) => entry.tools?.includes('oura_list_daily_readiness')));
  assert.ok(capabilitiesResult.structuredContent?.recommended_agent_flow?.some((step) => step.includes('oura_connection_status')));

  const inventoryResult = await client.callTool({ name: 'oura_data_inventory', arguments: { response_format: 'json' } });
  assert.equal(inventoryResult.structuredContent?.kind, 'data_inventory');
  assert.equal(typeof inventoryResult.structuredContent?.source, 'string');

  const manifestResult = await client.callTool({ name: 'oura_agent_manifest', arguments: { client: 'hermes', response_format: 'json' } });
  assert.equal(manifestResult.structuredContent?.client, 'hermes');
  assert.ok(manifestResult.structuredContent?.hermes?.common_tool_names?.includes('mcp_oura_oura_connection_status'));
  assert.ok(manifestResult.structuredContent?.standard_tools?.includes('oura_list_daily_sleep'));
  assert.equal(manifestResult.structuredContent?.hermes?.no_gateway_restart_for_data_access, true);

  const statusResult = await client.callTool({ name: 'oura_connection_status', arguments: { client: 'hermes', response_format: 'json' } });
  assert.equal(statusResult.structuredContent?.ok, false);
  assert.ok(statusResult.structuredContent?.missing_env?.includes('OURA_CLIENT_ID'));
  assert.equal(statusResult.structuredContent?.client, 'hermes');

  const invalidInput = await client.callTool({ name: 'oura_daily_summary', arguments: { days: 0 } });
  assert.equal(invalidInput.isError, true, 'runtime Zod validation still rejects invalid input');
  assert.match(invalidInput.content[0]?.text ?? '', /validation error/i);

  console.log(JSON.stringify({ ok: true, tools: toolNames.length, schemas: validators.size, resources: resourceUris.length, prompts: promptNames.length }, null, 2));
} finally {
  await client.close();
  await rm(home, { recursive: true, force: true });
}
