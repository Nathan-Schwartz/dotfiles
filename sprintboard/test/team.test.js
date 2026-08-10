'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { extractTicketKey, joinTickets, extractCandidateKeys, fetchTeamLane } = require('../lib/team.js');

const KNOWN = new Set(['ENG-1234', 'PROJ-7']);

test('extracts a key from the branch name, case-normalized', () => {
  const pr = { headRefName: 'eng-1234-show-and-hide-nodes', title: 'unrelated' };
  assert.strictEqual(extractTicketKey(pr, KNOWN), 'ENG-1234');
});

test('falls back to the title when the branch has no known key', () => {
  const pr = { headRefName: 'quick-fix', title: 'PROJ-7: repair the widget' };
  assert.strictEqual(extractTicketKey(pr, KNOWN), 'PROJ-7');
});

test('a longer key sharing a prefix does not match (ENG-12346 vs ENG-1234)', () => {
  const pr = { headRefName: 'eng-12346-terraform-issue-203', title: '' };
  assert.strictEqual(extractTicketKey(pr, KNOWN), '');
});

test('keys not in the known set are ignored', () => {
  const pr = { headRefName: 'other-99-thing', title: 'OTHER-99 do it' };
  assert.strictEqual(extractTicketKey(pr, KNOWN), '');
});

test('first known key wins when several appear', () => {
  const pr = { headRefName: 'proj-7-then-eng-1234', title: '' };
  assert.strictEqual(extractTicketKey(pr, KNOWN), 'PROJ-7');
});

test('missing fields are tolerated', () => {
  assert.strictEqual(extractTicketKey({}, KNOWN), '');
});

test('joinTickets annotates mapped PRs and leaves unmapped PRs untouched', () => {
  const prs = [
    { key: 'a/b#1', headRefName: 'eng-1234-x', title: 't1' },
    { key: 'a/b#2', headRefName: 'no-key-here', title: 't2' },
  ];
  const tickets = [{ key: 'ENG-1234', status: 'In Progress' }];
  const out = joinTickets(prs, tickets);
  assert.strictEqual(out[0].ticketKey, 'ENG-1234');
  assert.strictEqual(out[0].ticketStatus, 'In Progress');
  // absence, not empty string: action matching/interpolation depend on it
  assert.ok(!('ticketKey' in out[1]));
  assert.ok(!('ticketStatus' in out[1]));
});

test('joinTickets with no tickets returns PRs unchanged', () => {
  const prs = [{ key: 'a/b#1', headRefName: 'eng-1234-x', title: '' }];
  assert.deepStrictEqual(joinTickets(prs, []), prs);
});

test('extractCandidateKeys collects unique project-prefixed keys from branch and title', () => {
  const prs = [
    { headRefName: 'proj-12-fix-login', title: 'Fix login' },
    { headRefName: 'feature/retry', title: 'PROJ-345: retry queue' },
    { headRefName: 'gpt-4-experiment', title: 'OTHER-9 unrelated project' },
    { headRefName: 'proj-12-alt', title: 'duplicate branch key' },
  ];
  assert.deepStrictEqual(extractCandidateKeys(prs, 'PROJ'), ['PROJ-12', 'PROJ-345']);
});

test('extractCandidateKeys lowercased config project key still matches', () => {
  assert.deepStrictEqual(
    extractCandidateKeys([{ headRefName: 'PROJ-7-x', title: '' }], 'proj'),
    ['PROJ-7'],
  );
});

test('extractCandidateKeys tolerates missing text fields and empty input', () => {
  assert.deepStrictEqual(extractCandidateKeys([], 'PROJ'), []);
  assert.deepStrictEqual(extractCandidateKeys([{ title: null, headRefName: undefined }], 'PROJ'), []);
});

function laneDeps({ prs = [], byKeys, bulk } = {}) {
  const calls = { byKeys: [], bulk: 0 };
  return {
    calls,
    deps: {
      gh: { fetchRepoPRs: async () => ({ items: prs, truncated: [], failed: [] }) },
      jira: {
        TEAM_TICKET_LIMIT: 100,
        fetchTicketsByKeys: async (run, cfg, keys) => { calls.byKeys.push(keys); if (byKeys instanceof Error) throw byKeys; return byKeys || []; },
        fetchTeamTickets: async () => { calls.bulk++; if (bulk instanceof Error) throw bulk; return bulk || []; },
      },
    },
  };
}

const SOURCES = { github: { enabled: true, repoPaths: {} }, jira: { enabled: true, site: 's', project: 'PROJ' } };

test('fetchTeamLane joins via exact-key query, never the bulk query', async () => {
  const prs = [{ key: 'a/b#1', headRefName: 'proj-12-x', title: 'T', url: 'u1' }];
  const { calls, deps } = laneDeps({ prs, byKeys: [{ key: 'PROJ-12', status: 'QA' }] });
  const { items, warnings } = await fetchTeamLane(async () => '', SOURCES, deps);
  assert.deepStrictEqual(calls.byKeys, [['PROJ-12']]);
  assert.strictEqual(calls.bulk, 0);
  assert.strictEqual(items[0].ticketKey, 'PROJ-12');
  assert.strictEqual(items[0].ticketStatus, 'QA');
  assert.deepStrictEqual(warnings, []);
});

test('fetchTeamLane skips jira entirely when no PR references a project key', async () => {
  const prs = [{ key: 'a/b#1', headRefName: 'chore/bump', title: 'Bump deps', url: 'u1' }];
  const { calls, deps } = laneDeps({ prs });
  const { warnings } = await fetchTeamLane(async () => '', SOURCES, deps);
  assert.deepStrictEqual(calls.byKeys, []);
  assert.strictEqual(calls.bulk, 0);
  assert.deepStrictEqual(warnings, []);
});

test('fetchTeamLane falls back to the bulk query when the key query fails', async () => {
  const prs = [{ key: 'a/b#1', headRefName: 'proj-12-x', title: 'T', url: 'u1' }];
  const { calls, deps } = laneDeps({ prs, byKeys: new Error('key FAKE-1 does not exist'), bulk: [{ key: 'PROJ-12', status: 'QA' }] });
  const { items, warnings } = await fetchTeamLane(async () => '', SOURCES, deps);
  assert.strictEqual(calls.bulk, 1);
  assert.strictEqual(items[0].ticketKey, 'PROJ-12');
  assert.ok(warnings.some((w) => w.includes('falling back')));
});

test('fetchTeamLane fallback keeps the cap warning and survives a full jira outage', async () => {
  const prs = [{ key: 'a/b#1', headRefName: 'proj-12-x', title: 'T', url: 'u1' }];
  const capped = Array.from({ length: 100 }, (_, i) => ({ key: `PROJ-${i}`, status: 'x' }));
  const withCap = laneDeps({ prs, byKeys: new Error('boom'), bulk: capped });
  const r1 = await fetchTeamLane(async () => '', SOURCES, withCap.deps);
  assert.ok(r1.warnings.some((w) => w.includes('ticket query cap reached')));

  const allDown = laneDeps({ prs, byKeys: new Error('boom'), bulk: new Error('acli down') });
  const r2 = await fetchTeamLane(async () => '', SOURCES, allDown.deps);
  assert.strictEqual(r2.items.length, 1);
  assert.strictEqual(r2.items[0].ticketKey, undefined);
  assert.ok(r2.warnings.some((w) => w.includes('ticket mapping unavailable')));
});

test('fetchTeamLane surfaces repo fetch warnings unchanged', async () => {
  const deps = {
    gh: { fetchRepoPRs: async () => ({ items: [], truncated: ['a/big'], failed: [{ repo: 'a/bad', message: 'nope' }] }) },
    jira: { TEAM_TICKET_LIMIT: 100, fetchTicketsByKeys: async () => [], fetchTeamTickets: async () => [] },
  };
  const { warnings } = await fetchTeamLane(async () => '', SOURCES, deps);
  assert.deepStrictEqual(warnings, [
    'a/bad: fetch failed: nope',
    'a/big: only the first 100 open PRs were fetched',
  ]);
});
