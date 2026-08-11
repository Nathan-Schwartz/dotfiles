'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { cardOrder } = require('../public/order.js');

test('jira tickets sort above standalone PRs regardless of recency', () => {
  const jira = { type: 'jira', updatedAt: '2026-01-01T00:00:00Z' };
  const pr = { type: 'pr', updatedAt: '2026-08-01T00:00:00Z' };
  assert.deepStrictEqual([pr, jira].sort(cardOrder), [jira, pr]);
});

test('needs-my-review boosts a PR within the PR group but not above jira', () => {
  const jira = { type: 'jira', updatedAt: '2026-01-01T00:00:00Z' };
  const reviewPr = { type: 'pr', needsMyReview: true, updatedAt: '2026-01-02T00:00:00Z' };
  const newerPr = { type: 'pr', updatedAt: '2026-08-01T00:00:00Z' };
  assert.deepStrictEqual(
    [newerPr, reviewPr, jira].sort(cardOrder),
    [jira, reviewPr, newerPr],
  );
});

test('failing CI does not affect ordering', () => {
  const failing = { type: 'pr', ciFailing: true, updatedAt: '2026-01-01T00:00:00Z' };
  const newer = { type: 'pr', updatedAt: '2026-08-01T00:00:00Z' };
  assert.deepStrictEqual([failing, newer].sort(cardOrder), [newer, failing]);
});

test('recency orders items within the same group, missing updatedAt last', () => {
  const older = { type: 'jira', updatedAt: '2026-01-01T00:00:00Z' };
  const newer = { type: 'jira', updatedAt: '2026-08-01T00:00:00Z' };
  const dateless = { type: 'jira' };
  assert.deepStrictEqual([dateless, older, newer].sort(cardOrder), [newer, older, dateless]);
});
