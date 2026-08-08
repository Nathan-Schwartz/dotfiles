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

test('a path traversal attempt on static files 404s instead of escaping public/', async (t) => {
  const app = createApp({ config: CFG, fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] } });
  const port = await listen(app);
  t.after(() => app.close());
  const res = await fetch(`http://127.0.0.1:${port}/%2e%2e/%2e%2e/etc/passwd`);
  assert.strictEqual(res.status, 404);
  assert.ok((res.headers.get('content-type') || '').includes('application/json'));
  const body = await res.json();
  assert.strictEqual(body.error, 'not found');
});

test('POST /api/launch starts a tmux session for a board item', async (t) => {
  const launched = [];
  const app = createApp({
    config: { ...CFG, sources: { ...CFG.sources, github: { enabled: true, repoPaths: { 'a/b': '/tmp' } } },
      launch: { session: 'mainsession', defaultCwd: '/', promptTemplate: 'do {key}' } },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', repo: 'a/b', title: 'T', url: 'https://x' }],
      jira: async () => [],
    },
    tmux: { launch: async (run, opts) => { launched.push(opts); return { target: 'mainsession:5', attach: "tmux attach -t 'mainsession:5'" }; } },
  });
  const port = await listen(app);
  t.after(() => app.close());

  await fetch(`http://127.0.0.1:${port}/api/board`); // populate board cache
  const res = await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#2' }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.target, 'mainsession:5');
  assert.strictEqual(launched[0].cwd, '/tmp');        // repoPaths mapping
  assert.strictEqual(launched[0].prompt, 'do a/b#2'); // template filled

  const missing = await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'nope' }),
  });
  assert.strictEqual(missing.status, 404);
});

test('POST /api/launch with a malformed JSON body 500s without crashing the server', async (t) => {
  const app = createApp({
    config: { ...CFG, launch: { session: 'mainsession', defaultCwd: '/', promptTemplate: 'do {key}' } },
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
    tmux: { launch: async () => ({ target: 'mainsession:1', attach: 'x' }) },
  });
  const port = await listen(app);
  t.after(() => app.close());

  const res = await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-json{',
  });
  assert.strictEqual(res.status, 500);
  assert.ok((res.headers.get('content-type') || '').includes('application/json'));
  const body = await res.json();
  assert.ok(body.error);

  // proves the process (and this createApp instance) survived the rejection
  const board = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.strictEqual(board.status, 200);
});

test('sessions list and tail', async (t) => {
  let launchCount = 0;
  const app = createApp({
    config: { ...CFG, launch: { session: 'm', defaultCwd: '/', promptTemplate: 'x {key}' } },
    fetchers: {
      reviewsRequested: async () => [], jira: async () => [],
      myPRs: async () => [
        { key: 'a/b#2', type: 'pr', repo: 'a/b', title: 'T', url: 'https://x' },
        { key: 'a/b#3', type: 'pr', repo: 'a/b', title: 'T2', url: 'https://y' },
      ],
    },
    tmux: {
      launch: async () => {
        launchCount += 1;
        const target = launchCount === 1 ? 'm:5' : 'm:9';
        return { target, attach: `tmux attach -t '${target}'` };
      },
      tail: async (run, target) => {
        if (target === 'm:5') return 'claude output here\n';
        throw new Error("can't find window");
      },
    },
  });
  const port = await listen(app);
  t.after(() => app.close());

  await fetch(`http://127.0.0.1:${port}/api/board`);
  await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#2' }),
  });
  await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#3' }),
  });

  const listRes = await fetch(`http://127.0.0.1:${port}/api/sessions`);
  assert.strictEqual(listRes.status, 200);
  const list = await listRes.json();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].target, 'm:5');
  assert.strictEqual(list[0].alive, true);
  assert.strictEqual(list[1].target, 'm:9');
  assert.strictEqual(list[1].alive, false);

  const tailRes = await fetch(`http://127.0.0.1:${port}/api/sessions/tail?target=${encodeURIComponent('m:5')}`);
  assert.strictEqual(tailRes.status, 200);
  assert.strictEqual((await tailRes.json()).lines, 'claude output here\n');

  const gone = await fetch(`http://127.0.0.1:${port}/api/sessions/tail?target=${encodeURIComponent('m:9')}`);
  assert.strictEqual(gone.status, 410);
});

test('POST /api/launch 500s when tmux.launch rejects, without crashing the server', async (t) => {
  const app = createApp({
    config: { ...CFG, sources: { ...CFG.sources, github: { enabled: true, repoPaths: {} } },
      launch: { session: 'mainsession', defaultCwd: '/', promptTemplate: 'do {key}' } },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#3', type: 'pr', repo: 'a/b', title: 'T', url: 'https://x' }],
      jira: async () => [],
    },
    tmux: { launch: async () => { throw new Error('tmux exploded'); } },
  });
  const port = await listen(app);
  t.after(() => app.close());

  await fetch(`http://127.0.0.1:${port}/api/board`); // populate board cache
  const res = await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#3' }),
  });
  assert.strictEqual(res.status, 500);
  const body = await res.json();
  assert.ok(body.error.includes('tmux exploded'));

  // proves the process (and this createApp instance) survived the rejection
  const board = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.strictEqual(board.status, 200);
});
