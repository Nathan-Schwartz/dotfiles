'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../server.js');

const CFG = { port: 0, cacheSeconds: 300, sources: { github: { enabled: true }, jira: { enabled: true } }, launch: {} };

function listen(app) {
  return new Promise((resolve) => app.listen(0, '127.0.0.1', () => resolve(app.address().port)));
}

test('GET /api/board aggregates lanes and caches', async (t) => {
  let jiraCalls = 0;
  const app = createApp({
    config: CFG,
    fetchers: {
      reviewsRequested: async () => [{ key: 'a/b#1' }],
      myPRs: async () => [{ key: 'a/b#2', ci: 'failing' }],
      jira: async () => { jiraCalls++; return [{ key: 'PROJ-1' }]; },
    },
  });
  const port = await listen(app);
  t.after(() => app.close());

  const res = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body.lanes.reviewsRequested, [{ key: 'a/b#1' }]);
  assert.deepStrictEqual(body.lanes.myPRs, [{ key: 'a/b#2', ci: 'failing' }]);
  assert.deepStrictEqual(body.lanes.jira, [{ key: 'PROJ-1' }]);
  assert.deepStrictEqual(body.errors, []);
  assert.ok(body.fetchedAt);

  await fetch(`http://127.0.0.1:${port}/api/board`); // second hit: cached
  assert.strictEqual(jiraCalls, 1);
  await fetch(`http://127.0.0.1:${port}/api/board?refresh=1`); // bypasses cache
  assert.strictEqual(jiraCalls, 2);
});

test('a failing source lands in errors, other lanes still render', async (t) => {
  const app = createApp({
    config: CFG,
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [],
      jira: async () => { throw new Error('acli exploded'); },
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.deepStrictEqual(body.lanes.jira, []);
  assert.strictEqual(body.errors.length, 1);
  assert.strictEqual(body.errors[0].source, 'jira');
  assert.ok(body.errors[0].message.includes('acli exploded'));
});

test('GET / serves the board HTML', async (t) => {
  const app = createApp({ config: CFG, fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] } });
  const port = await listen(app);
  t.after(() => app.close());
  const res = await fetch(`http://127.0.0.1:${port}/`);
  assert.strictEqual(res.status, 200);
  assert.ok((res.headers.get('content-type') || '').includes('text/html'));
});
