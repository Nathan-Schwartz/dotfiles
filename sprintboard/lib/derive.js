'use strict';

// Canonical stages in board order; qa is the terminal (right-most) column.
const STAGES = ['todo', 'in-progress', 'in-review', 'qa'];

const DEFAULT_STAGE_MAP = {
  'to do': 'todo',
  'todo': 'todo',
  'in progress': 'in-progress',
  'review': 'in-review',
  'in review': 'in-review',
  'qa': 'qa',
  'testable': 'qa',
};

function normalizedMap(stageMap) {
  const out = { ...DEFAULT_STAGE_MAP };
  for (const [k, v] of Object.entries(stageMap || {})) {
    out[String(k).trim().toLowerCase()] = v;
  }
  return out;
}

// '' when the status maps to no known stage.
function ticketStage(status, stageMap) {
  return normalizedMap(stageMap)[String(status || '').trim().toLowerCase()] || '';
}

// Unmapped PRs only: draft -> in-progress, merge-ready -> qa, else in-review.
function prStage(pr) {
  if (pr.isDraft) return 'in-progress';
  if (pr.mergeable === 'MERGEABLE' && pr.ci !== 'failing') return 'qa';
  return 'in-review';
}

// Stage plus derived booleans, matchable like any item field. Fields that
// don't apply to the item's type stay absent so the action matcher's
// "missing field never matches" semantics hold.
function deriveFields(item, { source, login = '', jiraUser = '', stageMap } = {}) {
  const out = {};
  if (item.type === 'jira') {
    const s = ticketStage(item.status, stageMap);
    out.stage = s || 'in-progress';
    if (!s) out.stageUnknown = true;
    const assignee = String(item.assignee || '');
    out.unclaimed = assignee === '';
    out.claimedByMe = assignee !== '' && jiraUser !== ''
      && assignee.toLowerCase() === jiraUser.toLowerCase();
  }
  if (item.type === 'pr') {
    if (item.ticketKey) {
      const s = ticketStage(item.ticketStatus, stageMap);
      out.stage = s || 'in-progress';
      if (!s) out.stageUnknown = true;
    } else {
      out.stage = prStage(item);
    }
    out.mine = source === 'myPRs'
      || (login !== '' && !!item.author && item.author === login);
    out.approvedByMe = login !== '' && (item.latestReviews || []).some(
      (r) => r.author?.login === login && r.state === 'APPROVED',
    );
    out.ciFailing = item.ci === 'failing';
    out.needsMyReview = source === 'reviewsRequested' && !out.approvedByMe;
  }
  return out;
}

module.exports = { STAGES, ticketStage, prStage, deriveFields };
