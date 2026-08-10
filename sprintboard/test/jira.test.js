'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildJQL, fetchJiraItems, buildTeamJQL, fetchTeamTickets, TEAM_TICKET_LIMIT, buildKeysJQL, fetchTicketsByKeys, KEYS_PER_QUERY } = require('../lib/jira.js');

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

test('buildTeamJQL is project-wide: no assignee clause', () => {
  const jql = buildTeamJQL({ project: 'PROJ' });
  assert.ok(jql.includes('project = PROJ'));
  assert.ok(jql.includes('statusCategory != Done'));
  assert.ok(!jql.includes('assignee'));
});

test('fetchTeamTickets queries acli with the team JQL and a raised limit', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return FIXTURE; };
  const items = await fetchTeamTickets(fakeRun, { site: 'co.atlassian.net', project: 'PROJ', user: 'me@co.com', jql: '' });
  assert.strictEqual(calls[0][0], 'acli');
  const args = calls[0][1];
  const jql = args[args.indexOf('--jql') + 1];
  assert.ok(!jql.includes('assignee'));
  assert.strictEqual(args[args.indexOf('--limit') + 1], '100');
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].type, 'jira');
});

test('fetchTeamTickets ignores any user jql override (that only shapes the jira lane)', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return FIXTURE; };
  await fetchTeamTickets(fakeRun, { site: 's', project: 'PROJ', user: 'u', jql: 'sprint in openSprints()' });
  const args = calls[0][1];
  assert.ok(args[args.indexOf('--jql') + 1].includes('project = PROJ'));
});

test('fetchTeamTickets limit matches the exported TEAM_TICKET_LIMIT', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return FIXTURE; };
  await fetchTeamTickets(fakeRun, { site: 's', project: 'PROJ', user: 'u', jql: '' });
  const args = calls[0][1];
  assert.strictEqual(args[args.indexOf('--limit') + 1], String(TEAM_TICKET_LIMIT));
});

test('items carry assignee, coerced from object shapes, empty when unassigned', async () => {
  const fixture = JSON.stringify([
    { key: 'PROJ-401', summary: 'a', status: 'To Do', priority: 'Low', issuetype: 'Task', assignee: { displayName: 'Sam Doe' } },
    { key: 'PROJ-402', summary: 'b', status: 'To Do', priority: 'Low', issuetype: 'Task', assignee: 'sam@co.com' },
    { key: 'PROJ-403', summary: 'c', status: 'To Do', priority: 'Low', issuetype: 'Task' },
  ]);
  const items = await fetchJiraItems(async () => fixture, { site: 's', project: 'PROJ', user: 'u', jql: '' });
  assert.strictEqual(items[0].assignee, 'Sam Doe');
  assert.strictEqual(items[1].assignee, 'sam@co.com');
  assert.strictEqual(items[2].assignee, '');
});

test('search requests the assignee field from acli', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push(args); return '[]'; };
  await fetchJiraItems(fakeRun, { site: 's', project: 'PROJ', user: 'u', jql: '' });
  await fetchTeamTickets(fakeRun, { site: 's', project: 'PROJ', user: 'u', jql: '' });
  for (const args of calls) {
    assert.ok(args[args.indexOf('--fields') + 1].includes('assignee'));
  }
});

test('buildKeysJQL builds a key in (...) clause', () => {
  assert.strictEqual(buildKeysJQL(['PROJ-1', 'PROJ-22']), 'key in (PROJ-1, PROJ-22)');
});

test('fetchTicketsByKeys returns [] without querying when there are no keys', async () => {
  let calls = 0;
  const items = await fetchTicketsByKeys(async () => { calls++; return '[]'; }, { site: 's' }, []);
  assert.strictEqual(calls, 0);
  assert.deepStrictEqual(items, []);
});

test('fetchTicketsByKeys queries the exact keys with limit = key count', async () => {
  const calls = [];
  const fixture = JSON.stringify([{ key: 'PROJ-1', summary: 'a', status: 'To Do', priority: 'Low', issuetype: 'Task' }]);
  const fakeRun = async (cmd, args) => { calls.push([cmd, args]); return fixture; };
  const items = await fetchTicketsByKeys(fakeRun, { site: 'co.atlassian.net' }, ['PROJ-1', 'PROJ-2']);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], 'acli');
  const args = calls[0][1];
  assert.strictEqual(args[args.indexOf('--jql') + 1], 'key in (PROJ-1, PROJ-2)');
  assert.strictEqual(args[args.indexOf('--limit') + 1], '2');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].url, 'https://co.atlassian.net/browse/PROJ-1');
});

test('fetchTicketsByKeys chunks queries at KEYS_PER_QUERY and concatenates results', async () => {
  const keys = Array.from({ length: KEYS_PER_QUERY + 10 }, (_, i) => `PROJ-${i + 1}`);
  const calls = [];
  const fakeRun = async (cmd, args) => {
    calls.push(args);
    const jql = args[args.indexOf('--jql') + 1];
    const first = jql.slice('key in ('.length).split(',')[0].trim();
    return JSON.stringify([{ key: first, summary: 'x', status: 'To Do', priority: 'Low', issuetype: 'Task' }]);
  };
  const items = await fetchTicketsByKeys(fakeRun, { site: 's' }, keys);
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0][calls[0].indexOf('--limit') + 1], String(KEYS_PER_QUERY));
  assert.strictEqual(calls[1][calls[1].indexOf('--limit') + 1], '10');
  assert.deepStrictEqual(items.map((i) => i.key), ['PROJ-1', `PROJ-${KEYS_PER_QUERY + 1}`]);
});
