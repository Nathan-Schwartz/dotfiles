'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { fetchReviewsRequested } = require('../lib/github.js');

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
