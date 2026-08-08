'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildJQL, fetchJiraItems } = require('../lib/jira.js');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'acli-search.json'), 'utf8');

test('buildJQL defaults to project + assignee + not-done', () => {
  const jql = buildJQL({ project: 'PROJ', user: 'me@co.com', jql: '' });
  assert.ok(jql.includes('project = PROJ'));
  assert.ok(jql.includes('assignee = "me@co.com"'));
  assert.ok(jql.includes('statusCategory != Done'));
});

test('buildJQL uses explicit jql override verbatim', () => {
  assert.strictEqual(buildJQL({ project: 'X', user: 'y', jql: 'sprint in openSprints()' }), 'sprint in openSprints()');
});

test('fetchJiraItems shapes real acli output into JiraItems', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return FIXTURE; };
  const items = await fetchJiraItems(fakeRun, { site: 'co.atlassian.net', project: 'PROJ', user: 'me@co.com', jql: '' });
  assert.strictEqual(calls[0][0], 'acli');
  assert.ok(calls[0][1].includes('--json'));
  assert.strictEqual(items.length, 2);

  // Verify flat-shaped item (PROJ-101)
  const flat = items.find(it => it.key === 'PROJ-101');
  assert.ok(flat);
  assert.strictEqual(flat.type, 'jira');
  assert.strictEqual(flat.title, 'Flat-shaped item');
  assert.strictEqual(flat.status, 'In Progress');
  assert.strictEqual(flat.priority, 'High');
  assert.strictEqual(flat.issuetype, 'Task');
  assert.strictEqual(flat.url, 'https://co.atlassian.net/browse/PROJ-101');

  // Verify nested REST-shaped item (PROJ-102)
  const nested = items.find(it => it.key === 'PROJ-102');
  assert.ok(nested);
  assert.strictEqual(nested.type, 'jira');
  assert.strictEqual(nested.title, 'Nested REST-shaped item');
  assert.strictEqual(nested.status, 'To Do');
  assert.strictEqual(nested.priority, 'Medium');
  assert.strictEqual(nested.issuetype, 'Bug');
  assert.strictEqual(nested.url, 'https://co.atlassian.net/browse/PROJ-102');
});

test('fetchJiraItems unwraps a {results: [...]} container shape', async () => {
  const fixture = JSON.stringify({
    results: [
      { key: 'PROJ-201', summary: 'Wrapped item', status: 'To Do', priority: 'Low', issuetype: 'Task' },
    ],
  });
  const fakeRun = async () => fixture;
  const items = await fetchJiraItems(fakeRun, { site: 'co.atlassian.net', project: 'PROJ', user: 'me@co.com', jql: '' });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].key, 'PROJ-201');
  assert.strictEqual(items[0].title, 'Wrapped item');
});

test('fetchJiraItems rejects an unrecognized container shape naming the keys', async () => {
  const fixture = JSON.stringify({ values: [{ key: 'PROJ-301' }] });
  const fakeRun = async () => fixture;
  await assert.rejects(
    fetchJiraItems(fakeRun, { site: 'co.atlassian.net', project: 'PROJ', user: 'me@co.com', jql: '' }),
    (err) => {
      assert.ok(err.message.includes('unrecognized acli output shape'));
      assert.ok(err.message.includes('values'));
      return true;
    },
  );
});

test('fetchJiraItems filters out entries with no key', async () => {
  const fixtureWithKeyless = JSON.stringify([
    { key: 'PROJ-101', summary: 'Valid item', status: 'To Do', priority: 'High', issuetype: 'Task' },
    { summary: 'Keyless item', status: 'In Progress', priority: 'Medium', issuetype: 'Bug' },
    { key: 'PROJ-102', summary: 'Another valid item', status: 'Done', priority: 'Low', issuetype: 'Story' },
  ]);
  const fakeRun = async () => fixtureWithKeyless;
  const items = await fetchJiraItems(fakeRun, { site: 'example.atlassian.net', project: 'TEST', user: 'x', jql: '' });

  assert.strictEqual(items.length, 2, 'keyless entry should be filtered out');
  assert.ok(items.every(it => it.key && it.key !== 'undefined'));
  const keys = items.map(it => it.key);
  assert.deepStrictEqual(keys, ['PROJ-101', 'PROJ-102']);
});
