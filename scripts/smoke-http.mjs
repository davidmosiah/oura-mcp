import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const home = await mkdtemp(join(tmpdir(), 'oura-http-smoke-'));
const port = String(43000 + Math.floor(Math.random() * 1000));
const healthCheckAttempts = 100;
const healthCheckDelayMs = 200;
const child = spawn(process.execPath, ['dist/index.js', '--http'], {
  env: { HOME: home, USERPROFILE: home, PATH: process.env.PATH ?? '', OURA_MCP_PORT: port, OURA_MCP_HOST: '127.0.0.1' },
  stdio: ['ignore', 'ignore', 'pipe']
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const client = new Client({ name: 'oura-mcp-http-smoke-test', version: '0.0.0' });

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 1000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve({ statusCode: response.statusCode, data: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('HTTP health check timed out')));
    request.on('error', reject);
  });
}

try {
  let ok = false;
  for (let i = 0; i < healthCheckAttempts; i += 1) {
    try {
      const { statusCode, data } = await getJson(`http://127.0.0.1:${port}/health`);
      assert.equal(statusCode, 200);
      assert.equal(data.ok, true);
      ok = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, healthCheckDelayMs));
    }
  }
  if (!ok) throw new Error(`HTTP server did not become healthy. stderr=${stderr}`);
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  const { tools } = await client.listTools();
  const capabilities = tools.find((tool) => tool.name === 'oura_capabilities');
  assert.equal(capabilities?.inputSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(capabilities?.outputSchema?.$schema, 'https://json-schema.org/draft/2020-12/schema');
  const result = await client.callTool({ name: 'oura_capabilities', arguments: { response_format: 'json' } });
  assert.equal(result.structuredContent?.unofficial, true);
  console.log(JSON.stringify({ ok: true, transport: 'http', tools: tools.length, port: Number(port) }, null, 2));
} finally {
  await client.close();
  child.kill('SIGTERM');
  await rm(home, { recursive: true, force: true });
}
