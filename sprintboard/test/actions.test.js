'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { matches, viableActions, fillTemplate } = require('../lib/actions.js');
const { deriveFields } = require('../lib/derive.js');
const exampleConfig = require('../config.example.json');

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

test('matches: an array of match objects is OR across objects', () => {
  const match = [
    { mine: true, stage: 'in-progress' },
    { mine: false, stage: 'in-review', approvedByMe: false },
  ];
  assert.strictEqual(matches(match, { mine: true, stage: 'in-progress' }), true);
  assert.strictEqual(matches(match, { mine: false, stage: 'in-review', approvedByMe: false }), true);
  assert.strictEqual(matches(match, { mine: false, stage: 'in-review', approvedByMe: true }), false);
  assert.strictEqual(matches(match, { mine: true, stage: 'in-review' }), false);
});

test('matches: an empty match array matches nothing', () => {
  assert.strictEqual(matches([], { key: 'PROJ-1' }), false);
});

test('viableActions accepts array matches', () => {
  const actions = [{ name: 'code-review', match: [{ stage: 'in-progress' }, { stage: 'in-review' }], prompt: 'p' }];
  assert.deepStrictEqual(viableActions(actions, { stage: 'in-review' }), ['code-review']);
  assert.deepStrictEqual(viableActions(actions, { stage: 'qa' }), []);
});

test('every action matched for representative items interpolates without throwing', () => {
  const item = (base, opts) => Object.assign(base, deriveFields(base, opts));
  const jiraOpts = { jiraUser: 'me' };
  const items = [
    item({ type: 'jira', key: 'PROJ-1', title: 'Fix bug', status: 'To Do', url: 'https://jira.example.com/PROJ-1', assignee: 'me' }, jiraOpts),
    item({ type: 'jira', key: 'PROJ-2', title: 'Improve X', status: 'In Progress', url: 'https://jira.example.com/PROJ-2', assignee: 'other' }, jiraOpts),
    item({ type: 'jira', key: 'PROJ-3', title: 'QA ticket', status: 'QA', url: 'https://jira.example.com/PROJ-3', assignee: 'me' }, jiraOpts),
    item({ type: 'jira', key: 'PROJ-4', title: 'Untriaged', status: 'To Do', url: 'https://jira.example.com/PROJ-4' }, jiraOpts),
    item({ type: 'pr', key: 'me/repo#1', title: 'WIP feature', url: 'https://github.com/me/repo/pull/1', repo: 'me/repo', number: 1, isDraft: true }, { source: 'myPRs', login: 'me' }),
    item({ type: 'pr', key: 'org/repo#7', title: 'Team feature', url: 'https://github.com/org/repo/pull/7', repo: 'org/repo', number: 7, ticketKey: 'PROJ-7', ticketStatus: 'QA', author: 'teammate', latestReviews: [] }, { source: 'teamPRs', login: 'me' }),
    item({ type: 'pr', key: 'org/repo#8', title: 'Broken CI', url: 'https://github.com/org/repo/pull/8', repo: 'org/repo', number: 8, author: 'teammate', ci: 'failing' }, { source: 'teamPRs', login: 'me' }),
  ];

  for (const it of items) {
    for (const name of viableActions(exampleConfig.actions, it)) {
      const action = exampleConfig.actions.find((a) => a.name === name);
      assert.doesNotThrow(() => fillTemplate(action.prompt, it), `${name} failed to interpolate for ${it.key}`);
    }
  }
});
