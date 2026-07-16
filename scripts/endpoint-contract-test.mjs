import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OuraClient } from '../dist/services/oura-client.js';

const dir = mkdtempSync(join(tmpdir(), 'oura-mcp-endpoint-contract-'));
const tokenPath = join(dir, 'tokens.json');
writeFileSync(tokenPath, JSON.stringify({ access_token: 'synthetic-token' }), { mode: 0o600 });

const client = new OuraClient({
  clientId: 'synthetic-client',
  clientSecret: 'synthetic-secret',
  redirectUri: 'http://127.0.0.1/callback',
  scopes: [],
  tokenPath,
  privacyMode: 'structured',
  cacheEnabled: false,
  cachePath: join(dir, 'cache.sqlite')
});

const originalFetch = globalThis.fetch;
const originalNoCache = process.env.OURA_NO_CACHE;
const requestedUrls = [];
process.env.OURA_NO_CACHE = 'true';

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  requestedUrls.push(url);
  return Response.json({ data: [{ id: 'synthetic-record', day: '2026-07-08' }] });
};

try {
  const failures = [];
  const result = await client.list('/usercollection/daily_sleep', {
    after: '2026-07-08T23:00:00-03:00',
    before: '2026-07-15T23:00:00-03:00'
  });
  const requestUrl = requestedUrls.at(-1);
  try {
    assert.equal(requestUrl.searchParams.get('start_date'), '2026-07-08');
    assert.equal(requestUrl.searchParams.get('end_date'), '2026-07-15');
    assert.equal(result.records[0].id, 'synthetic-record');
  } catch (error) {
    failures.push(error);
  }

  const fetchCountBeforeInvalid = requestedUrls.length;
  try {
    await assert.rejects(
      client.list('/usercollection/daily_sleep', { after: 'not-a-date' }),
      /Invalid Oura date range value/
    );
    assert.equal(requestedUrls.length, fetchCountBeforeInvalid, 'invalid dates must fail before an HTTP request');
  } catch (error) {
    failures.push(error);
  }

  if (failures.length) throw new AggregateError(failures, 'Oura endpoint contract regressions');
  console.log(JSON.stringify({ ok: true, suite: 'endpoint-contracts', requests: requestedUrls.length }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalNoCache === undefined) delete process.env.OURA_NO_CACHE;
  else process.env.OURA_NO_CACHE = originalNoCache;
  rmSync(dir, { recursive: true, force: true });
}
