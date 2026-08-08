'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { fetchReviewsRequested, fetchMyPRs, classifyCI } = require('../lib/github.js');

const SEARCH_RESULT = JSON.stringify([
  {
    number: 42,
    title: 'Fix the flux capacitor',
    url: 'https://github.com/acme/widgets/pull/42',
    repository: { name: 'widgets', nameWithOwner: 'acme/widgets' },
    updatedAt: '2026-08-01T12:00:00Z',
    isDraft: false,
  },
]);

test('fetchReviewsRequested shapes gh search output into PRItems', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return SEARCH_RESULT; };
  const items = await fetchReviewsRequested(fakeRun);
  assert.strictEqual(calls[0][0], 'gh');
  assert.ok(calls[0][1].includes('--review-requested=@me'));
  assert.deepStrictEqual(items, [{
    key: 'acme/widgets#42', type: 'pr', repo: 'acme/widgets', number: 42,
    title: 'Fix the flux capacitor', url: 'https://github.com/acme/widgets/pull/42',
    updatedAt: '2026-08-01T12:00:00Z', isDraft: false,
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
  const items = await fetchMyPRs(fakeRun, { repos: [] });
  assert.strictEqual(items[0].ci, 'failing');
  assert.strictEqual(items[0].reviewDecision, 'CHANGES_REQUESTED');
  assert.strictEqual(items[0].mergeable, 'MERGEABLE');
});

test('fetchMyPRs filters by repos allowlist when non-empty', async () => {
  const searchOut = JSON.stringify([
    { number: 1, title: 'a', url: 'u1', repository: { nameWithOwner: 'acme/keep' }, updatedAt: 't', isDraft: false },
    { number: 2, title: 'b', url: 'u2', repository: { nameWithOwner: 'acme/drop' }, updatedAt: 't', isDraft: false },
  ]);
  const viewOut = JSON.stringify({ mergeable: 'UNKNOWN', reviewDecision: '', statusCheckRollup: [] });
  const fakeRun = async (cmd, args) => (args[0] === 'search' ? searchOut : viewOut);
  const items = await fetchMyPRs(fakeRun, { repos: ['acme/keep'] });
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
  const items = await fetchMyPRs(fakeRun, { repos: [] });
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
