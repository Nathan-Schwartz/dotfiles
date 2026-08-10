'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createApp } = require('../server.js');

// fetch() cannot set a spoofed Host header (undici drops it), so use http.request directly.
function requestWithHost(port, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/board', headers: { host: hostHeader } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

const CFG = {
  port: 0, cacheSeconds: 300,
  sources: { github: { enabled: true }, jira: { enabled: true } },
  actions: [{ name: 'work-on', match: {}, prompt: 'do {key}' }],
  launch: {},
};

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
  assert.strictEqual(body.items.length, 3);
  const byKey = Object.fromEntries(body.items.map((i) => [i.key, i]));
  assert.deepStrictEqual(byKey['a/b#1'].lanes, ['needs-review']);
  assert.deepStrictEqual(byKey['a/b#2'].lanes, ['my-prs', 'failed-ci']);
  assert.deepStrictEqual(byKey['PROJ-1'].lanes, ['jira']);
  assert.deepStrictEqual(byKey['a/b#1'].actions, ['work-on']);
  assert.deepStrictEqual(body.errors, []);
  assert.ok(body.fetchedAt);

  await fetch(`http://127.0.0.1:${port}/api/board`); // second hit: cached
  assert.strictEqual(jiraCalls, 1);
  await fetch(`http://127.0.0.1:${port}/api/board?refresh=1`); // bypasses cache
  assert.strictEqual(jiraCalls, 2);
});

test('board actions can match on derived lanes', async (t) => {
  const app = createApp({
    config: { ...CFG, actions: [{ name: 'fix-ci', match: { lanes: 'failed-ci' }, prompt: 'fix {key}' }] },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', ci: 'failing' }, { key: 'a/b#3', ci: 'passing' }],
      jira: async () => [],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  const byKey = Object.fromEntries(body.items.map((i) => [i.key, i]));
  assert.deepStrictEqual(byKey['a/b#2'].actions, ['fix-ci']);
  assert.deepStrictEqual(byKey['a/b#3'].actions, []);
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
  assert.deepStrictEqual(body.items, []);
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

test('a request with a spoofed Host header is rejected', async (t) => {
  const app = createApp({ config: CFG, fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] } });
  const port = await listen(app);
  t.after(() => app.close());
  const { status, body } = await requestWithHost(port, 'evil.example');
  assert.strictEqual(status, 403);
  assert.strictEqual(body.error, 'forbidden host');
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
      launch: { session: 'mainsession', defaultCwd: '/' } },
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
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#2', action: 'work-on' }),
  });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.target, 'mainsession:5');
  assert.strictEqual(body.action, 'work-on');
  assert.strictEqual(launched[0].cwd, '/tmp');        // repoPaths mapping
  assert.strictEqual(launched[0].prompt, 'do a/b#2'); // template filled

  const missing = await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'nope', action: 'work-on' }),
  });
  assert.strictEqual(missing.status, 404);
});

test('POST /api/launch with a malformed JSON body 500s without crashing the server', async (t) => {
  const app = createApp({
    config: { ...CFG, launch: { session: 'mainsession', defaultCwd: '/' } },
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
    config: { ...CFG, launch: { session: 'm', defaultCwd: '/' } },
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
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#2', action: 'work-on' }),
  });
  await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#3', action: 'work-on' }),
  });

  const listRes = await fetch(`http://127.0.0.1:${port}/api/sessions`);
  assert.strictEqual(listRes.status, 200);
  const list = await listRes.json();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].target, 'm:5');
  assert.strictEqual(list[0].alive, true);
  assert.strictEqual(list[0].action, 'work-on');
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
      launch: { session: 'mainsession', defaultCwd: '/' } },
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
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#3', action: 'work-on' }),
  });
  assert.strictEqual(res.status, 500);
  const body = await res.json();
  assert.ok(body.error.includes('tmux exploded'));

  // proves the process (and this createApp instance) survived the rejection
  const board = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.strictEqual(board.status, 200);
});

test('POST /api/launch rejects unknown, non-viable, and non-interpolable actions', async (t) => {
  const app = createApp({
    config: {
      ...CFG,
      actions: [
        { name: 'work-on', match: {}, prompt: 'do {key}' },
        { name: 'pr-only', match: { type: 'pr' }, prompt: 'x {key}' },
        { name: 'needs-number', match: {}, prompt: 'n {number}' },
      ],
      launch: { session: 'm', defaultCwd: '/' },
    },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [],
      jira: async () => [{ key: 'PROJ-1', type: 'jira', title: 'T', url: 'https://j' }],
    },
    tmux: { launch: async () => ({ target: '@1', attach: 'x' }) },
  });
  const port = await listen(app);
  t.after(() => app.close());
  await fetch(`http://127.0.0.1:${port}/api/board`);
  const post = (body) => fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  assert.strictEqual((await post({ key: 'PROJ-1', action: 'nope' })).status, 404);
  assert.strictEqual((await post({ key: 'PROJ-1', action: 'pr-only' })).status, 409);

  const bad = await post({ key: 'PROJ-1', action: 'needs-number' });
  assert.strictEqual(bad.status, 400);
  assert.ok((await bad.json()).error.includes('{number}'));

  const ok = await post({ key: 'PROJ-1', action: 'work-on' });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual((await ok.json()).action, 'work-on');
});

test('action-level cwd beats repoPaths and defaultCwd', async (t) => {
  const launched = [];
  const app = createApp({
    config: {
      ...CFG,
      sources: { ...CFG.sources, github: { enabled: true, repoPaths: { 'a/b': '/repo-path' } } },
      actions: [{ name: 'deploy', match: {}, prompt: 'd {key}', cwd: '/deploy-cwd' }],
      launch: { session: 'm', defaultCwd: '/default' },
    },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', repo: 'a/b', title: 'T', url: 'https://x' }],
      jira: async () => [],
    },
    tmux: { launch: async (run, opts) => { launched.push(opts); return { target: '@1', attach: 'x' }; } },
  });
  const port = await listen(app);
  t.after(() => app.close());
  await fetch(`http://127.0.0.1:${port}/api/board`);
  await fetch(`http://127.0.0.1:${port}/api/launch`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: 'a/b#2', action: 'deploy' }),
  });
  assert.strictEqual(launched[0].cwd, '/deploy-cwd');
});

test('teamPRs items land in team-prs and dedupe against earlier sources', async (t) => {
  const app = createApp({
    config: CFG,
    fetchers: {
      reviewsRequested: async () => [{ key: 'a/b#1' }],
      myPRs: async () => [{ key: 'a/b#2', ci: 'failing' }],
      jira: async () => [],
      teamPRs: async () => [
        { key: 'a/b#2', ci: 'failing' },                             // dup of my PR
        { key: 'a/b#9', ticketKey: 'PROJ-1', ticketStatus: 'QA' },   // teammate PR
      ],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  const byKey = Object.fromEntries(body.items.map((i) => [i.key, i]));
  assert.strictEqual(body.items.length, 3); // a/b#2 appears once
  assert.deepStrictEqual(byKey['a/b#2'].lanes, ['my-prs', 'failed-ci']); // earlier source wins
  assert.deepStrictEqual(byKey['a/b#9'].lanes, ['team-prs']);
  assert.strictEqual(byKey['a/b#9'].ticketKey, 'PROJ-1');
});

test('board works when the teamPRs fetcher is absent', async (t) => {
  const app = createApp({
    config: CFG,
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const res = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual((await res.json()).errors, []);
});

test('fetcher warnings surface in errors without failing the lane', async (t) => {
  const app = createApp({
    config: CFG,
    fetchers: {
      reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [],
      teamPRs: async () => ({
        items: [{ key: 'a/b#9' }],
        warnings: ['a/big: only the first 100 open PRs were fetched'],
      }),
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.deepStrictEqual(body.errors, [
    { source: 'github', message: 'a/big: only the first 100 open PRs were fetched' },
  ]);
  assert.strictEqual(body.items.length, 1);
  assert.deepStrictEqual(body.items[0].lanes, ['team-prs']);
});
