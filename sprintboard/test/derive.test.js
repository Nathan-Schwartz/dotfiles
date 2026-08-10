'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { STAGES, ticketStage, prStage, deriveFields } = require('../lib/derive.js');

test('STAGES is the board order with qa right-most', () => {
  assert.deepStrictEqual(STAGES, ['todo', 'in-progress', 'in-review', 'qa']);
});

test('ticketStage maps default synonyms case-insensitively', () => {
  assert.strictEqual(ticketStage('To Do'), 'todo');
  assert.strictEqual(ticketStage('todo'), 'todo');
  assert.strictEqual(ticketStage('In Progress'), 'in-progress');
  assert.strictEqual(ticketStage('REVIEW'), 'in-review');
  assert.strictEqual(ticketStage('In Review'), 'in-review');
  assert.strictEqual(ticketStage('QA'), 'qa');
  assert.strictEqual(ticketStage('Testable'), 'qa');
});

test('ticketStage returns empty string for unknown statuses', () => {
  assert.strictEqual(ticketStage('Blocked'), '');
  assert.strictEqual(ticketStage(''), '');
  assert.strictEqual(ticketStage(undefined), '');
});

test('ticketStage honors a stageMap override, case-insensitively', () => {
  assert.strictEqual(ticketStage('Blocked', { Blocked: 'in-progress' }), 'in-progress');
  assert.strictEqual(ticketStage('blocked', { Blocked: 'in-progress' }), 'in-progress');
  // override beats the default map
  assert.strictEqual(ticketStage('QA', { qa: 'in-review' }), 'in-review');
});

test('prStage: draft wins, then merge-ready, else in-review', () => {
  assert.strictEqual(prStage({ isDraft: true, mergeable: 'MERGEABLE', ci: 'passing' }), 'in-progress');
  assert.strictEqual(prStage({ isDraft: false, mergeable: 'MERGEABLE', ci: 'passing' }), 'qa');
  assert.strictEqual(prStage({ isDraft: false, mergeable: 'MERGEABLE', ci: 'failing' }), 'in-review');
  assert.strictEqual(prStage({ isDraft: false, mergeable: 'UNKNOWN', ci: 'none' }), 'in-review');
  assert.strictEqual(prStage({}), 'in-review');
});

test('deriveFields on a ticket: stage, stageUnknown, unclaimed, claimedByMe; no PR fields', () => {
  const known = deriveFields({ type: 'jira', status: 'In Progress', assignee: '' }, { jiraUser: 'me@co.com' });
  assert.strictEqual(known.stage, 'in-progress');
  assert.ok(!('stageUnknown' in known));
  assert.strictEqual(known.unclaimed, true);
  assert.strictEqual(known.claimedByMe, false);
  assert.ok(!('mine' in known) && !('ciFailing' in known) && !('needsMyReview' in known) && !('approvedByMe' in known));

  const unknown = deriveFields({ type: 'jira', status: 'Blocked', assignee: 'Me Person' }, { jiraUser: 'me@co.com' });
  assert.strictEqual(unknown.stage, 'in-progress');
  assert.strictEqual(unknown.stageUnknown, true);
  assert.strictEqual(unknown.unclaimed, false);
  assert.strictEqual(unknown.claimedByMe, false); // displayName vs email: best-effort miss
});

test('deriveFields claimedByMe compares case-insensitively', () => {
  const t = deriveFields({ type: 'jira', status: 'To Do', assignee: 'Me@CO.com' }, { jiraUser: 'me@co.com' });
  assert.strictEqual(t.claimedByMe, true);
  assert.strictEqual(t.unclaimed, false);
});

test('deriveFields on a mapped PR inherits the ticket status stage', () => {
  const pr = deriveFields(
    { type: 'pr', ticketKey: 'PROJ-1', ticketStatus: 'QA', isDraft: false, mergeable: 'UNKNOWN', ci: 'none' },
    { source: 'teamPRs' },
  );
  assert.strictEqual(pr.stage, 'qa');
  assert.ok(!('stageUnknown' in pr));

  const odd = deriveFields(
    { type: 'pr', ticketKey: 'PROJ-2', ticketStatus: 'Weird', isDraft: false },
    { source: 'teamPRs' },
  );
  assert.strictEqual(odd.stage, 'in-progress');
  assert.strictEqual(odd.stageUnknown, true);
});

test('deriveFields on an unmapped PR uses prStage; no jira fields', () => {
  const pr = deriveFields(
    { type: 'pr', isDraft: false, mergeable: 'MERGEABLE', ci: 'passing' },
    { source: 'teamPRs' },
  );
  assert.strictEqual(pr.stage, 'qa');
  assert.ok(!('unclaimed' in pr) && !('claimedByMe' in pr));
});

test('deriveFields mine: myPRs source, or author matches login', () => {
  assert.strictEqual(deriveFields({ type: 'pr' }, { source: 'myPRs' }).mine, true);
  assert.strictEqual(
    deriveFields({ type: 'pr', author: 'me' }, { source: 'teamPRs', login: 'me' }).mine, true,
  );
  assert.strictEqual(
    deriveFields({ type: 'pr', author: 'someone' }, { source: 'teamPRs', login: 'me' }).mine, false,
  );
  // no login known: author cannot prove mine
  assert.strictEqual(deriveFields({ type: 'pr', author: 'me' }, { source: 'teamPRs' }).mine, false);
});

test('deriveFields approvedByMe and needsMyReview', () => {
  const reviews = [{ author: { login: 'me' }, state: 'APPROVED' }, { author: { login: 'x' }, state: 'COMMENTED' }];
  const approved = deriveFields(
    { type: 'pr', latestReviews: reviews }, { source: 'reviewsRequested', login: 'me' },
  );
  assert.strictEqual(approved.approvedByMe, true);
  assert.strictEqual(approved.needsMyReview, false);

  const pending = deriveFields(
    { type: 'pr', latestReviews: [] }, { source: 'reviewsRequested', login: 'me' },
  );
  assert.strictEqual(pending.approvedByMe, false);
  assert.strictEqual(pending.needsMyReview, true);

  const notForMe = deriveFields({ type: 'pr' }, { source: 'teamPRs', login: 'me' });
  assert.strictEqual(notForMe.needsMyReview, false);
});

test('deriveFields ciFailing tracks ci', () => {
  assert.strictEqual(deriveFields({ type: 'pr', ci: 'failing' }, { source: 'myPRs' }).ciFailing, true);
  assert.strictEqual(deriveFields({ type: 'pr', ci: 'passing' }, { source: 'myPRs' }).ciFailing, false);
  assert.strictEqual(deriveFields({ type: 'pr' }, { source: 'myPRs' }).ciFailing, false);
});
