'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { matches, viableActions, fillTemplate } = require('../lib/actions.js');

test('matches: empty match matches any item', () => {
  assert.strictEqual(matches({}, { key: 'PROJ-1' }), true);
  assert.strictEqual(matches(undefined, { key: 'PROJ-1' }), true);
});

test('matches: scalar value requires strict equality', () => {
  assert.strictEqual(matches({ type: 'pr' }, { type: 'pr' }), true);
  assert.strictEqual(matches({ type: 'pr' }, { type: 'jira' }), false);
  assert.strictEqual(matches({ isDraft: false }, { isDraft: false }), true);
});

test('matches: array value means one-of', () => {
  assert.strictEqual(matches({ status: ['To Do', 'In Progress'] }, { status: 'In Progress' }), true);
  assert.strictEqual(matches({ status: ['To Do', 'In Progress'] }, { status: 'Done' }), false);
});

test('matches: item-side array matches on intersection', () => {
  assert.strictEqual(matches({ lanes: 'failed-ci' }, { lanes: ['my-prs', 'failed-ci'] }), true);
  assert.strictEqual(matches({ lanes: 'jira' }, { lanes: ['my-prs'] }), false);
});

test('matches: a field missing from the item never matches', () => {
  assert.strictEqual(matches({ status: 'In Review' }, { key: 'a/b#1', type: 'pr' }), false);
});

test('matches: all keys must be satisfied', () => {
  const item = { type: 'jira', status: 'In Review' };
  assert.strictEqual(matches({ type: 'jira', status: 'In Review' }, item), true);
  assert.strictEqual(matches({ type: 'jira', status: 'Done' }, item), false);
});

test('viableActions returns matching action names in config order', () => {
  const actions = [
    { name: 'work-on', match: {}, prompt: 'p' },
    { name: 'pr-only', match: { type: 'pr' }, prompt: 'p' },
    { name: 'jira-only', match: { type: 'jira' }, prompt: 'p' },
  ];
  assert.deepStrictEqual(viableActions(actions, { type: 'jira' }), ['work-on', 'jira-only']);
  assert.deepStrictEqual(viableActions([], { type: 'jira' }), []);
  assert.deepStrictEqual(viableActions(undefined, { type: 'jira' }), []);
});

test('fillTemplate substitutes any item field', () => {
  const out = fillTemplate('review {repo}#{number}: "{title}" ({url})', {
    repo: 'a/b', number: 7, title: 'T', url: 'https://x',
  });
  assert.strictEqual(out, 'review a/b#7: "T" (https://x)');
});

test('fillTemplate stringifies non-string values including false', () => {
  assert.strictEqual(fillTemplate('draft={isDraft} n={number}', { isDraft: false, number: 0 }), 'draft=false n=0');
});

test('fillTemplate throws naming every missing or empty placeholder', () => {
  assert.throws(
    () => fillTemplate('n {number} p {priority}', { key: 'PROJ-1', priority: '' }),
    (e) => e.message.includes('{number}') && e.message.includes('{priority}'),
  );
});

test('fillTemplate leaves brace-less text untouched', () => {
  assert.strictEqual(fillTemplate('no placeholders here', {}), 'no placeholders here');
});
