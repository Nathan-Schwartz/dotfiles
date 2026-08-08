'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { lanesFor } = require('../lib/lanes.js');

test('reviewsRequested items land in needs-review', () => {
  assert.deepStrictEqual(lanesFor('reviewsRequested', { key: 'a/b#1' }), ['needs-review']);
});

test('jira items land in jira', () => {
  assert.deepStrictEqual(lanesFor('jira', { key: 'PROJ-1' }), ['jira']);
});

test('myPRs always land in my-prs, plus derived attention lanes', () => {
  assert.deepStrictEqual(lanesFor('myPRs', { ci: 'passing', reviewDecision: '', mergeable: 'UNKNOWN' }), ['my-prs']);
  assert.deepStrictEqual(
    lanesFor('myPRs', { ci: 'failing', reviewDecision: 'CHANGES_REQUESTED', mergeable: 'UNKNOWN' }),
    ['my-prs', 'changes-requested', 'failed-ci'],
  );
});

test('mergeable requires MERGEABLE, non-failing CI, and not draft', () => {
  assert.deepStrictEqual(lanesFor('myPRs', { ci: 'passing', mergeable: 'MERGEABLE', isDraft: false }), ['my-prs', 'mergeable']);
  assert.deepStrictEqual(lanesFor('myPRs', { ci: 'failing', mergeable: 'MERGEABLE', isDraft: false }), ['my-prs', 'failed-ci']);
  assert.deepStrictEqual(lanesFor('myPRs', { ci: 'passing', mergeable: 'MERGEABLE', isDraft: true }), ['my-prs']);
});

test('unknown source yields no lanes', () => {
  assert.deepStrictEqual(lanesFor('nope', {}), []);
});
