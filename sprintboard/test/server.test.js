'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server.js');
const { createStore } = require('../lib/state.js');

function tmpStore() {
  return createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-srv-')), 'state.json'));
}

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

test('POST /api/launch allows non-matching actions (escape hatch) but rejects unknown and non-interpolable', async (t) => {
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
  const hatch = await post({ key: 'PROJ-1', action: 'pr-only' });
  assert.strictEqual(hatch.status, 201); // escape hatch: non-matching actions launch

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

test('duplicate keys merge-fill: first source wins conflicts, absent fields fill in', async (t) => {
  const app = createApp({
    config: CFG,
    fetchers: {
      reviewsRequested: async () => [{ key: 'a/b#1', type: 'pr', title: 'T', url: 'u', isDraft: false, updatedAt: 'x' }],
      myPRs: async () => [], jira: async () => [],
      teamPRs: async () => [{
        key: 'a/b#1', type: 'pr', title: 'OTHER', url: 'u', isDraft: false, updatedAt: 'x',
        ci: 'failing', mergeable: 'MERGEABLE', author: 'teammate', latestReviews: [],
      }],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.strictEqual(body.items.length, 1);
  const it = body.items[0];
  assert.strictEqual(it.title, 'T');           // first source wins conflicts
  assert.strictEqual(it.ci, 'failing');        // filled from the richer duplicate
  assert.strictEqual(it.source, 'reviewsRequested');
  assert.deepStrictEqual(it.lanes, ['needs-review']);
  assert.strictEqual(it.stage, 'in-review');   // mergeable but ci failing
  assert.strictEqual(it.ciFailing, true);
  assert.strictEqual(it.needsMyReview, true);
});

test('items carry stage and derived fields; payload lists actionNames', async (t) => {
  const app = createApp({
    config: { ...CFG, actions: [{ name: 'work-on', match: {}, prompt: 'do {key}' }, { name: 'fix-ci', match: { ciFailing: true }, prompt: 'f {key}' }] },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', title: 'M', url: 'u', isDraft: false, mergeable: 'MERGEABLE', ci: 'passing', updatedAt: 'x' }],
      jira: async () => [{ key: 'PROJ-1', type: 'jira', title: 'J', url: 'u', status: 'In Progress', assignee: '' }],
      teamPRs: async () => [],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.deepStrictEqual(body.actionNames, ['work-on', 'fix-ci']);
  const byKey = Object.fromEntries(body.items.map((i) => [i.key, i]));
  assert.strictEqual(byKey['a/b#2'].stage, 'qa');
  assert.strictEqual(byKey['a/b#2'].mine, true);
  assert.deepStrictEqual(byKey['a/b#2'].actions, ['work-on']);
  assert.strictEqual(byKey['PROJ-1'].stage, 'in-progress');
  assert.strictEqual(byKey['PROJ-1'].unclaimed, true);
  assert.ok(!('mine' in byKey['PROJ-1']));
});

test('getLogin failure surfaces one warning and leaves identity empty', async (t) => {
  const app = createApp({
    config: CFG,
    getLogin: async () => { throw new Error('no gh auth'); },
    fetchers: {
      reviewsRequested: async () => [], jira: async () => [],
      myPRs: async () => [], teamPRs: async () => [{ key: 'a/b#9', type: 'pr', title: 'x', url: 'u', author: 'someone', isDraft: false, updatedAt: 'x' }],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.ok(body.errors.some((e) => e.source === 'github' && e.message.includes('gh identity unavailable')));
  assert.strictEqual(body.items[0].mine, false);
});

test('identity is not fetched when github is disabled', async (t) => {
  const app = createApp({
    config: { ...CFG, sources: { github: { enabled: false }, jira: { enabled: true } } },
    getLogin: async () => { throw new Error('no gh'); },
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [], teamPRs: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.deepStrictEqual(body.errors, []);
});

test('config.hide marks matching items hiddenByConfig, leaving lanes and actions intact', async (t) => {
  const app = createApp({
    config: { ...CFG, hide: [{ author: 'dependabot' }, { mine: false, isDraft: true }] },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', title: 'mine', url: 'u2', isDraft: true, updatedAt: 'x' }],
      jira: async () => [],
      teamPRs: async () => [
        { key: 'a/b#7', type: 'pr', title: 'bump', url: 'u7', author: 'dependabot', isDraft: false, updatedAt: 'x' },
        { key: 'a/b#8', type: 'pr', title: 'wip', url: 'u8', author: 'teammate', isDraft: true, updatedAt: 'x' },
        { key: 'a/b#9', type: 'pr', title: 'ready', url: 'u9', author: 'teammate', isDraft: false, updatedAt: 'x' },
      ],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  const byKey = Object.fromEntries(body.items.map((i) => [i.key, i]));
  assert.strictEqual(byKey['a/b#7'].hiddenByConfig, true);  // bot author
  assert.strictEqual(byKey['a/b#8'].hiddenByConfig, true);  // someone else's draft
  assert.ok(!('hiddenByConfig' in byKey['a/b#9']));         // teammate's real PR
  assert.ok(!('hiddenByConfig' in byKey['a/b#2']));         // my own draft
  assert.deepStrictEqual(byKey['a/b#7'].lanes, ['team-prs']); // hidden, not gone
  assert.deepStrictEqual(byKey['a/b#7'].actions, ['work-on']);
});

test('a config without a hide key (or with an empty one) hides nothing', async (t) => {
  for (const cfg of [CFG, { ...CFG, hide: [] }]) {
    const app = createApp({
      config: cfg,
      fetchers: {
        reviewsRequested: async () => [], jira: async () => [],
        myPRs: async () => [{ key: 'a/b#2', type: 'pr', title: 'T', url: 'u', isDraft: false, updatedAt: 'x' }],
      },
    });
    const port = await listen(app);
    t.after(() => app.close());
    const body = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
    assert.ok(!('hiddenByConfig' in body.items[0]));
  }
});

test('POST /api/hide and /api/unhide persist lists and echo them; board payload carries them', async (t) => {
  const store = tmpStore();
  const app = createApp({
    config: CFG,
    store,
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', title: 'T', url: 'https://x/2', isDraft: false, updatedAt: 'x' }],
      jira: async () => [],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());

  const board1 = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.deepStrictEqual(board1.hidden, []);
  assert.deepStrictEqual(board1.unhidden, []);

  const hideRes = await fetch(`http://127.0.0.1:${port}/api/hide`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#2' }),
  });
  assert.strictEqual(hideRes.status, 200);
  assert.deepStrictEqual(await hideRes.json(), { hidden: ['https://x/2'], unhidden: [] });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(store.path, 'utf8')).hidden, ['https://x/2']);

  const board2 = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.deepStrictEqual(board2.hidden, ['https://x/2']);

  const unhideRes = await fetch(`http://127.0.0.1:${port}/api/unhide`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#2' }),
  });
  assert.deepStrictEqual(await unhideRes.json(), { hidden: [], unhidden: [] });
});

test('POST /api/hide 404s for a key not on the board', async (t) => {
  const app = createApp({
    config: CFG, store: tmpStore(),
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  await fetch(`http://127.0.0.1:${port}/api/board`);
  const res = await fetch(`http://127.0.0.1:${port}/api/hide`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'nope' }),
  });
  assert.strictEqual(res.status, 404);
});

test('hiding a config-hidden item routes to the unhidden-override removal, not the manual list', async (t) => {
  const store = tmpStore();
  store.state.unhidden = ['https://x/7'];
  const app = createApp({
    config: { ...CFG, hide: [{ author: 'dependabot' }] },
    store,
    fetchers: {
      reviewsRequested: async () => [], jira: async () => [], myPRs: async () => [],
      teamPRs: async () => [{ key: 'a/b#7', type: 'pr', title: 'bump', url: 'https://x/7', author: 'dependabot', isDraft: false, updatedAt: 'x' }],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());
  await fetch(`http://127.0.0.1:${port}/api/board`);
  const res = await (await fetch(`http://127.0.0.1:${port}/api/hide`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#7' }),
  })).json();
  // applyHide: config-matched items need neither list — override cleared, manual list untouched.
  assert.deepStrictEqual(res, { hidden: [], unhidden: [] });
});

test('a clean fetch prunes vanished urls from both lists; an errored fetch does not', async (t) => {
  const store = tmpStore();
  store.state.hidden = ['https://gone/1', 'https://x/2'];
  store.state.unhidden = ['https://gone/2'];
  store.save();
  let fail = false;
  const app = createApp({
    config: { ...CFG, cacheSeconds: 0 },
    store,
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', title: 'T', url: 'https://x/2', isDraft: false, updatedAt: 'x' }],
      jira: async () => { if (fail) throw new Error('down'); return []; },
    },
  });
  const port = await listen(app);
  t.after(() => app.close());

  await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.deepStrictEqual(store.state.hidden, ['https://x/2']);
  assert.deepStrictEqual(store.state.unhidden, []);

  store.state.hidden = ['https://gone/1', 'https://x/2'];
  fail = true;
  await fetch(`http://127.0.0.1:${port}/api/board?refresh=1`);
  assert.deepStrictEqual(store.state.hidden, ['https://gone/1', 'https://x/2']);
});

test('a failing state save degrades to in-memory state instead of taking the board down', async (t) => {
  const app = createApp({
    config: CFG,
    store: {
      state: { hidden: [], unhidden: [], board: null, migratedAt: '', notes: [] },
      save() { throw new Error('disk full'); },
      path: '',
    },
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', title: 'T', url: 'https://x/2', isDraft: false, updatedAt: 'x' }],
      jira: async () => [],
    },
  });
  const port = await listen(app);
  t.after(() => app.close());

  const board = await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.strictEqual(board.status, 200);

  const hideRes = await fetch(`http://127.0.0.1:${port}/api/hide`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a/b#2' }),
  });
  assert.strictEqual(hideRes.status, 200);
  assert.deepStrictEqual((await hideRes.json()).hidden, ['https://x/2']);
});

test('migrate-hidden applies once, stamps migratedAt, then permanently no-ops', async (t) => {
  const store = tmpStore();
  const app = createApp({
    config: CFG, store,
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const post = (body) => fetch(`http://127.0.0.1:${port}/api/migrate-hidden`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  const first = await (await post({ hidden: ['https://x/1'], unhidden: ['https://x/2'] })).json();
  assert.strictEqual(first.migrated, true);
  assert.deepStrictEqual(first.hidden, ['https://x/1']);
  assert.ok(store.state.migratedAt);

  // Intentionally cleared lists must NOT re-migrate: migratedAt gates forever.
  store.state.hidden = [];
  store.state.unhidden = [];
  const second = await (await post({ hidden: ['https://stale/9'] })).json();
  assert.strictEqual(second.migrated, false);
  assert.deepStrictEqual(store.state.hidden, []);
});

test('migrate-hidden no-ops when server lists are already populated', async (t) => {
  const store = tmpStore();
  store.state.hidden = ['https://x/1'];
  const app = createApp({
    config: CFG, store,
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const res = await (await fetch(`http://127.0.0.1:${port}/api/migrate-hidden`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hidden: ['https://other/3'] }),
  })).json();
  assert.strictEqual(res.migrated, false);
  assert.deepStrictEqual(res.hidden, ['https://x/1']);
});

test('migrate-hidden drops non-string entries', async (t) => {
  const store = tmpStore();
  const app = createApp({
    config: CFG, store,
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  const res = await (await fetch(`http://127.0.0.1:${port}/api/migrate-hidden`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hidden: ['https://x/1', 42, null], unhidden: 'not-an-array' }),
  })).json();
  assert.deepStrictEqual(res.hidden, ['https://x/1']);
  assert.deepStrictEqual(res.unhidden, []);
});

test('a clean fetch persists the payload; an errored fetch never overwrites it', async (t) => {
  const store = tmpStore();
  let fail = false;
  const app = createApp({
    config: { ...CFG, cacheSeconds: 0 },
    store,
    fetchers: {
      reviewsRequested: async () => [],
      myPRs: async () => [{ key: 'a/b#2', type: 'pr', title: 'T', url: 'https://x/2', isDraft: false, updatedAt: 'x' }],
      jira: async () => { if (fail) throw new Error('down'); return []; },
    },
  });
  const port = await listen(app);
  t.after(() => app.close());

  await fetch(`http://127.0.0.1:${port}/api/board`);
  assert.strictEqual(store.state.board.payload.items.length, 1);
  const goodAt = store.state.board.at;

  fail = true;
  await fetch(`http://127.0.0.1:${port}/api/board?refresh=1`);
  assert.strictEqual(store.state.board.at, goodAt);
});

test('a new app rehydrates from the store: stale=1 serves it without any fetch', async (t) => {
  const store = tmpStore();
  store.state.board = {
    at: Date.now() - 10 * 60 * 1000, // older than cacheSeconds: stale
    payload: { fetchedAt: '2026-08-10T00:00:00Z', items: [{ key: 'a/b#2', url: 'https://x/2' }], errors: [], actionNames: [] },
  };
  store.state.hidden = ['https://x/2'];
  store.save();
  let fetches = 0;
  const app = createApp({
    config: CFG,
    store: createStore(store.path), // fresh load simulates a restart
    fetchers: { reviewsRequested: async () => { fetches++; return []; }, myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());

  const res = await fetch(`http://127.0.0.1:${port}/api/board?stale=1`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(fetches, 0);
  assert.strictEqual(body.stale, true);
  assert.strictEqual(body.items[0].key, 'a/b#2');
  assert.deepStrictEqual(body.hidden, ['https://x/2']);
});

test('stale=1 404s when no board has ever been cached', async (t) => {
  const app = createApp({
    config: CFG, store: tmpStore(),
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  assert.strictEqual((await fetch(`http://127.0.0.1:${port}/api/board?stale=1`)).status, 404);
});

test('a rehydrated cache within TTL serves GET /api/board without refetching', async (t) => {
  const store = tmpStore();
  store.state.board = {
    at: Date.now(), // fresh enough for the default 300s TTL
    payload: { fetchedAt: new Date().toISOString(), items: [], errors: [], actionNames: [] },
  };
  store.save();
  let fetches = 0;
  const app = createApp({
    config: CFG,
    store: createStore(store.path),
    fetchers: { reviewsRequested: async () => { fetches++; return []; }, myPRs: async () => [], jira: async () => [] },
  });
  const port = await listen(app);
  t.after(() => app.close());
  assert.strictEqual((await fetch(`http://127.0.0.1:${port}/api/board`)).status, 200);
  assert.strictEqual(fetches, 0);
});

function notesApp(t, store) {
  const app = createApp({
    config: CFG,
    store,
    fetchers: { reviewsRequested: async () => [], myPRs: async () => [], jira: async () => [] },
  });
  t.after(() => app.close());
  return app;
}

function poster(port) {
  return async (p, body) => {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
}

test('notes CRUD round-trips through the state file and board payload', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-notes-'));
  const store = createStore(path.join(dir, 'state.json'));
  const port = await listen(notesApp(t, store));
  const post = poster(port);

  const created = await post('/api/notes', { title: 'water plants', details: 'the ferns', stage: 'todo' });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.body.notes.length, 1);
  assert.strictEqual(created.body.notes[0].title, 'water plants');
  const id = created.body.notes[0].id;

  const moved = await post('/api/notes/update', { id, stage: 'qa' });
  assert.strictEqual(moved.status, 200);
  assert.strictEqual(moved.body.notes[0].stage, 'qa');

  const board = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  assert.strictEqual(board.notes.length, 1);
  assert.strictEqual(board.notes[0].id, id);

  const deleted = await post('/api/notes/delete', { id });
  assert.strictEqual(deleted.status, 200);
  assert.deepStrictEqual(deleted.body.notes, []);

  // Soft delete: the tombstone survives on disk with its deletedAt stamp.
  const onDisk = JSON.parse(fs.readFileSync(store.path, 'utf8'));
  assert.strictEqual(onDisk.notes.length, 1);
  assert.ok(onDisk.notes[0].deletedAt);
});

test('note endpoints answer 400 on bad input and 404 on unknown ids', async (t) => {
  const port = await listen(notesApp(t)); // storeless app: inert in-memory default
  const post = poster(port);
  assert.strictEqual((await post('/api/notes', { title: '', stage: 'todo' })).status, 400);
  assert.strictEqual((await post('/api/notes', { title: 'x', stage: 'someday' })).status, 400);
  assert.strictEqual((await post('/api/notes/update', { id: 'ghost', title: 'y' })).status, 404);
  assert.strictEqual((await post('/api/notes/delete', { id: 'ghost' })).status, 404);
});

test('stale board route carries notes', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-notes-'));
  const store = createStore(path.join(dir, 'state.json'));
  const port = await listen(notesApp(t, store));
  const post = poster(port);
  await post('/api/notes', { title: 'remember', stage: 'in-progress' });
  await fetch(`http://127.0.0.1:${port}/api/board`); // populate the cache
  const res = await fetch(`http://127.0.0.1:${port}/api/board?stale=1`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.notes.length, 1);
  assert.strictEqual(body.notes[0].title, 'remember');
});
