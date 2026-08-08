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
  assert.ok(items.length > 0);
  for (const it of items) {
    assert.strictEqual(it.type, 'jira');
    assert.match(it.key, /^[A-Z][A-Z0-9]*-\d+$/);
    assert.strictEqual(typeof it.title, 'string');
    assert.strictEqual(typeof it.status, 'string');
    assert.ok(it.url.startsWith('https://co.atlassian.net/browse/'));
  }
});
