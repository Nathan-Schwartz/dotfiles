'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { extractTicketKey, joinTickets } = require('../lib/team.js');

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
