'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { fetchReviewsRequested, fetchMyPRs, classifyCI, fetchRepoPRs } = require('../lib/github.js');

const SEARCH_RESULT = JSON.stringify([
  {
    number: 42,
    title: 'Fix the flux capacitor',
    url: 'https://github.com/acme/widgets/pull/42',
    repository: { name: 'widgets', nameWithOwner: 'acme/widgets' },
    updatedAt: '2026-08-01T12:00:00Z',
    isDraft: false,
    author: { login: 'dependabot[bot]' },
  },
]);

test('fetchReviewsRequested shapes gh search output into PRItems with normalized author', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return SEARCH_RESULT; };
  const items = await fetchReviewsRequested(fakeRun);
  assert.strictEqual(calls[0][0], 'gh');
  assert.ok(calls[0][1].includes('--review-requested=@me'));
  const jsonArg = calls[0][1][calls[0][1].indexOf('--json') + 1];
  assert.ok(jsonArg.includes('author'), 'search must request the author field');
  assert.deepStrictEqual(items, [{
    key: 'acme/widgets#42', type: 'pr', repo: 'acme/widgets', number: 42,
    title: 'Fix the flux capacitor', url: 'https://github.com/acme/widgets/pull/42',
    updatedAt: '2026-08-01T12:00:00Z', isDraft: false, author: 'dependabot',
  }]);
});

test('fetchReviewsRequested tolerates empty result', async () => {
  const items = await fetchReviewsRequested(async () => '[]');
  assert.deepStrictEqual(items, []);
});

test('classifyCI verdicts', () => {
  assert.strictEqual(classifyCI(null), 'none');
  assert.strictEqual(classifyCI([]), 'none');
  assert.strictEqual(classifyCI([{ conclusion: 'SUCCESS' }, { conclusion: 'SKIPPED' }]), 'passing');
  assert.strictEqual(classifyCI([{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }]), 'failing');
  assert.strictEqual(classifyCI([{ conclusion: '', status: 'IN_PROGRESS' }]), 'pending');
  // statusContext entries use `state` instead of `conclusion`
  assert.strictEqual(classifyCI([{ state: 'FAILURE' }]), 'failing');
});

test('classifyCI treats unknown-shaped entries conservatively as pending', () => {
  assert.strictEqual(classifyCI([{}]), 'pending');
});

test('fetchMyPRs enriches each PR via gh pr view', async () => {
  const searchOut = JSON.stringify([{
    number: 7, title: 'My PR', url: 'https://github.com/acme/widgets/pull/7',
    repository: { nameWithOwner: 'acme/widgets' },
    updatedAt: '2026-08-02T00:00:00Z', isDraft: false,
  }]);
  const viewOut = JSON.stringify({
    mergeable: 'MERGEABLE', reviewDecision: 'CHANGES_REQUESTED',
    statusCheckRollup: [{ conclusion: 'FAILURE' }],
  });
  const fakeRun = async (cmd, args) => (args[0] === 'search' ? searchOut : viewOut);
  const items = await fetchMyPRs(fakeRun, { repoPaths: {} });
  assert.strictEqual(items[0].ci, 'failing');
  assert.strictEqual(items[0].reviewDecision, 'CHANGES_REQUESTED');
  assert.strictEqual(items[0].mergeable, 'MERGEABLE');
});

test('fetchMyPRs filters to repoPaths repos when non-empty', async () => {
  const searchOut = JSON.stringify([
    { number: 1, title: 'a', url: 'u1', repository: { nameWithOwner: 'acme/keep' }, updatedAt: 't', isDraft: false },
    { number: 2, title: 'b', url: 'u2', repository: { nameWithOwner: 'acme/drop' }, updatedAt: 't', isDraft: false },
  ]);
  const viewOut = JSON.stringify({ mergeable: 'UNKNOWN', reviewDecision: '', statusCheckRollup: [] });
  const fakeRun = async (cmd, args) => (args[0] === 'search' ? searchOut : viewOut);
  const items = await fetchMyPRs(fakeRun, { repoPaths: { 'acme/keep': '~/code/keep' } });
  assert.deepStrictEqual(items.map((i) => i.repo), ['acme/keep']);
});

test('fetchMyPRs degrades gracefully on per-item enrichment failure', async () => {
  const searchOut = JSON.stringify([
    { number: 1, title: 'good', url: 'u1', repository: { nameWithOwner: 'acme/repo' }, updatedAt: 't1', isDraft: false },
    { number: 2, title: 'bad', url: 'u2', repository: { nameWithOwner: 'acme/repo' }, updatedAt: 't2', isDraft: false },
  ]);
  const viewOutSuccess = JSON.stringify({
    mergeable: 'MERGEABLE', reviewDecision: 'APPROVED',
    statusCheckRollup: [{ conclusion: 'SUCCESS' }],
  });
  let callCount = 0;
  const fakeRun = async (cmd, args) => {
    if (args[0] === 'search') return searchOut;
    // First pr view succeeds, second fails
    callCount++;
    if (callCount === 1) return viewOutSuccess;
    throw new Error('gh pr view failed');
  };
  const items = await fetchMyPRs(fakeRun, { repoPaths: {} });
  assert.strictEqual(items.length, 2);
  // Successful enrichment
  assert.strictEqual(items[0].ci, 'passing');
  assert.strictEqual(items[0].reviewDecision, 'APPROVED');
  assert.strictEqual(items[0].mergeable, 'MERGEABLE');
  // Failed enrichment with degraded defaults
  assert.strictEqual(items[1].ci, 'none');
  assert.strictEqual(items[1].reviewDecision, '');
  assert.strictEqual(items[1].mergeable, 'UNKNOWN');
});

const LIST_RESULT = JSON.stringify([
  {
    number: 9,
    title: 'ENG-77 add caching',
    url: 'https://github.com/acme/widgets/pull/9',
    updatedAt: '2026-08-05T00:00:00Z',
    isDraft: false,
    headRefName: 'eng-77-add-caching',
    author: { login: 'teammate' },
    mergeable: 'MERGEABLE',
    reviewDecision: 'REVIEW_REQUIRED',
    latestReviews: [{ author: { login: 'Nathan-Schwartz' }, state: 'COMMENTED' }],
    statusCheckRollup: [{ conclusion: 'FAILURE' }],
  },
]);

test('fetchRepoPRs makes one gh pr list call per repoPaths repo', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return LIST_RESULT; };
  const { items, truncated } = await fetchRepoPRs(fakeRun, { repoPaths: { 'acme/widgets': '~/code/widgets' } });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], 'gh');
  assert.deepStrictEqual(calls[0][1].slice(0, 4), ['pr', 'list', '-R', 'acme/widgets']);
  assert.ok(calls[0][1].includes('--limit'));
  assert.deepStrictEqual(truncated, []);
  assert.strictEqual(items.length, 1);
  assert.deepStrictEqual(items[0], {
    key: 'acme/widgets#9', type: 'pr', repo: 'acme/widgets', number: 9,
    title: 'ENG-77 add caching', url: 'https://github.com/acme/widgets/pull/9',
    updatedAt: '2026-08-05T00:00:00Z', isDraft: false,
    author: 'teammate', headRefName: 'eng-77-add-caching',
    ci: 'failing', reviewDecision: 'REVIEW_REQUIRED', mergeable: 'MERGEABLE',
    latestReviews: [{ author: { login: 'Nathan-Schwartz' }, state: 'COMMENTED' }],
  });
});

test('fetchRepoPRs with empty repoPaths makes no calls and returns nothing', async () => {
  const calls = [];
  const out = await fetchRepoPRs(async (...a) => { calls.push(a); return '[]'; }, { repoPaths: {} });
  assert.deepStrictEqual(out, { items: [], truncated: [], failed: [] });
  assert.strictEqual(calls.length, 0);
});

test('fetchRepoPRs degrades per repo: one failing repo does not lose the others', async () => {
  const fakeRun = async (cmd, args) => {
    const repo = args[args.indexOf('-R') + 1];
    if (repo === 'a/bad') throw new Error('gh exploded');
    return LIST_RESULT;
  };
  const { items, truncated, failed } = await fetchRepoPRs(fakeRun, { repoPaths: { 'acme/widgets': '/w', 'a/bad': '/b' } });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].repo, 'acme/widgets');
  assert.deepStrictEqual(truncated, []);
  assert.deepStrictEqual(failed, [{ repo: 'a/bad', message: 'gh exploded' }]);
});

test('fetchRepoPRs flattens multiple repos and defaults missing enrichment fields', async () => {
  const sparse = JSON.stringify([{ number: 1, title: 't', url: 'u', updatedAt: 'x', isDraft: true }]);
  const fakeRun = async () => sparse;
  const { items } = await fetchRepoPRs(fakeRun, { repoPaths: { 'a/one': '/1', 'a/two': '/2' } });
  assert.deepStrictEqual(items.map((i) => i.repo), ['a/one', 'a/two']);
  assert.strictEqual(items[0].author, '');
  assert.strictEqual(items[0].headRefName, '');
  assert.strictEqual(items[0].ci, 'none');
  assert.strictEqual(items[0].reviewDecision, '');
  assert.strictEqual(items[0].mergeable, 'UNKNOWN');
  assert.deepStrictEqual(items[0].latestReviews, []);
});

// gh pr list (GraphQL) and gh search prs (REST) spell the same bot
// differently: app/dependabot vs dependabot[bot]. Both normalize to the
// bare slug so one config rule matches either fetch path.
test('fetchRepoPRs normalizes app/-prefixed bot logins', async () => {
  const out = JSON.stringify([{
    number: 2, title: 'bump deps', url: 'u', updatedAt: 'x', isDraft: false,
    author: { login: 'app/dependabot' },
  }]);
  const { items } = await fetchRepoPRs(async () => out, { repoPaths: { 'a/one': '/1' } });
  assert.strictEqual(items[0].author, 'dependabot');
});

test('fetchRepoPRs flags repos whose result hit the fetch limit', async () => {
  const full = JSON.stringify(Array.from({ length: 100 }, (_, i) => (
    { number: i + 1, title: 't', url: 'u', updatedAt: 'x', isDraft: false }
  )));
  const { items, truncated } = await fetchRepoPRs(async () => full, { repoPaths: { 'a/big': '/b' } });
  assert.strictEqual(items.length, 100);
  assert.deepStrictEqual(truncated, ['a/big']);
});
