'use strict';

// Server-side lane derivation so `lanes` is a matchable action field.
// Display titles/order live in public/app.js; ids must stay in sync.
function lanesFor(source, item) {
  if (source === 'reviewsRequested') return ['needs-review'];
  if (source === 'jira') return ['jira'];
  if (source !== 'myPRs') return [];
  const lanes = ['my-prs'];
  if (item.reviewDecision === 'CHANGES_REQUESTED') lanes.push('changes-requested');
  if (item.ci === 'failing') lanes.push('failed-ci');
  if (item.mergeable === 'MERGEABLE' && item.ci !== 'failing' && !item.isDraft) lanes.push('mergeable');
  return lanes;
}

module.exports = { lanesFor };
