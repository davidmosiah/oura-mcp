import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OuraClient } from '../dist/services/oura-client.js';

const dir = mkdtempSync(join(tmpdir(), 'oura-mcp-endpoint-contract-'));
const tokenPath = join(dir, 'tokens.json');
writeFileSync(tokenPath, JSON.stringify({ access_token: 'synthetic-token' }), { mode: 0o600 });

const config = {
  clientId: 'synthetic-client',
  clientSecret: 'synthetic-secret',
  redirectUri: 'http://127.0.0.1/callback',
  scopes: [],
  tokenPath,
  privacyMode: 'structured',
  cacheEnabled: false,
  cachePath: join(dir, 'cache.sqlite')
};
const client = new OuraClient(config);

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
    assert.equal(result.next_page, undefined);
    assert.equal(result.next_token, undefined, 'fixture has no upstream cursor');
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

  try {
    await assert.rejects(
      client.list('/usercollection/daily_sleep', { page: 2 }),
      /does not paginate by page number/
    );
  } catch (error) {
    failures.push(error);
  }

  const fetchCountBeforeCursor = requestedUrls.length;
  try {
    await client.list('/usercollection/daily_sleep', { next_token: 'cursor-abc' });
    const cursorUrl = requestedUrls.at(-1);
    assert.equal(requestedUrls.length, fetchCountBeforeCursor + 1);
    assert.equal(cursorUrl.searchParams.get('next_token'), 'cursor-abc');
  } catch (error) {
    failures.push(error);
  }

  try {
    const firstPage = await client.list('/usercollection/daily_sleep', { page: 1 });
    assert.equal(firstPage.records[0].id, 'synthetic-record');
  } catch (error) {
    failures.push(error);
  }

  if (failures.length) throw new AggregateError(failures, 'Oura endpoint contract regressions');
  // Exercise the real authenticated request path; cache operations are a generic
  // method+URL Map double. No SQLite constructor, token refresh or network runs.
  const persistentCases = [
    { name: 'initial success', cacheEnabled: true, outcome: 'success' },
    { name: 'refreshed success', cacheEnabled: true, refresh: true, outcome: 'success' },
    { name: 'initial HTTP error', cacheEnabled: true, outcome: 'http' },
    { name: 'refreshed HTTP error', cacheEnabled: true, refresh: true, outcome: 'http' },
    { name: 'same credential HTTP error', cacheEnabled: true, sameCredential: true, outcome: 'http' },
    { name: 'disabled cache HTTP error', cacheEnabled: false, outcome: 'http' },
    { name: 'transport error', cacheEnabled: true, outcome: 'transport' },
    { name: 'response read error', cacheEnabled: true, outcome: 'read' },
  ];
  for (const scenario of persistentCases) {
    const scoped = new OuraClient({ ...config, cacheEnabled: scenario.cacheEnabled });
    const url = 'https://api.ouraring.com/v2/usercollection/personal_info';
    const key = `GET ${url}`;
    const stale = { marker: 'synthetic-existing-cache-entry' };
    const cached = new Map([[key, stale]]);
    const calls = { opens: 0, gets: 0, sets: 0, refreshes: 0, requests: [] };
    const storage = {
      get(method, requestUrl) { calls.gets++; return cached.get(`${method} ${requestUrl}`); },
      set(method, requestUrl, payload) { calls.sets++; cached.set(`${method} ${requestUrl}`, payload); },
      status() { return { enabled: true, path: 'synthetic-cache.sqlite', entries: cached.size }; },
    };
    scoped.getCache = () => { calls.opens++; return storage; };
    let credential = 'synthetic-A';
    scoped.getValidToken = async () => ({ access_token: credential });
    scoped.refreshToken = async () => { calls.refreshes++; return { access_token: 'synthetic-refreshed' }; };
    const error = new Error(`synthetic ${scenario.outcome} failure`);
    let phase = 'first';
    scoped.fetchWithRetry = async (requestUrl, init) => {
      calls.requests.push({ url: requestUrl, authorization: new Headers(init.headers).get('Authorization') });
      if (phase === 'first') return Response.json({ marker: 'synthetic-fresh-A' });
      if (scenario.refresh && calls.refreshes === 0) return new Response('', { status: 401 });
      if (scenario.outcome === 'transport') throw error;
      if (scenario.outcome === 'read') {
        const response = new Response('', { status: 200 });
        response.text = async () => { throw error; };
        return response;
      }
      if (scenario.outcome === 'http') return Response.json({ message: 'synthetic unavailable' }, { status: 503 });
      return Response.json({ marker: 'synthetic-fresh-B' });
    };
    assert.deepEqual(await scoped.get('/usercollection/personal_info'), { marker: 'synthetic-fresh-A' }, scenario.name);
    phase = 'second';
    if (!scenario.sameCredential) credential = 'synthetic-B';
    if (scenario.outcome === 'success') {
      assert.deepEqual(await scoped.get('/usercollection/personal_info'), { marker: 'synthetic-fresh-B' }, scenario.name);
    } else if (scenario.outcome === 'http') {
      await assert.rejects(() => scoped.get('/usercollection/personal_info'), /Oura API HTTP 503/, scenario.name);
    } else {
      await assert.rejects(() => scoped.get('/usercollection/personal_info'), observed => observed === error, scenario.name);
    }
    assert.equal(calls.opens, 0, `${scenario.name}: authenticated payloads must not open persistent cache`);
    assert.equal(calls.gets, 0, `${scenario.name}: authenticated errors must not read fallback`);
    assert.equal(calls.sets, 0, `${scenario.name}: authenticated successes must not persist payloads`);
    assert.deepEqual([...cached.entries()], [[key, stale]], `${scenario.name}: existing cache entries stay untouched`);
    assert.equal(calls.refreshes, scenario.refresh ? 1 : 0, scenario.name);
    assert.deepEqual(calls.requests.map(r => r.url), Array(scenario.refresh ? 3 : 2).fill(url), scenario.name);
    assert.deepEqual(calls.requests.map(r => r.authorization), [
      'Bearer synthetic-A',
      scenario.sameCredential ? 'Bearer synthetic-A' : 'Bearer synthetic-B',
      ...(scenario.refresh ? ['Bearer synthetic-refreshed'] : []),
    ], scenario.name);
    assert.equal(scoped.cacheStatus().enabled, false, `${scenario.name}: cache status must not report a persistent cache that authenticated reads never use`);
    assert.equal(calls.opens, 0, `${scenario.name}: cache status must not open persistent cache`);
  }
  console.log(JSON.stringify({ ok: true, suite: 'endpoint-contracts', requests: requestedUrls.length, persistent_cases: persistentCases.length }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalNoCache === undefined) delete process.env.OURA_NO_CACHE;
  else process.env.OURA_NO_CACHE = originalNoCache;
  rmSync(dir, { recursive: true, force: true });
}
