'use strict';
const SEARCH_FIELDS = 'number,title,url,repository,updatedAt,isDraft';

function toItem(pr) {
  const repo = pr.repository?.nameWithOwner || pr.repository?.name || '';
  return {
    key: `${repo}#${pr.number}`,
    type: 'pr',
    repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    updatedAt: pr.updatedAt,
    isDraft: !!pr.isDraft,
  };
}

async function fetchReviewsRequested(run) {
  const out = await run('gh', [
    'search', 'prs', '--review-requested=@me', '--state=open',
    '--limit', '50', '--json', SEARCH_FIELDS,
  ]);
  return JSON.parse(out).map(toItem);
}

function classifyCI(rollup) {
  if (!rollup || rollup.length === 0) return 'none';
  const states = rollup.map((c) => String(c.conclusion || c.state || c.status || '').toUpperCase());
  if (states.some((s) => s === 'FAILURE' || s === 'ERROR' || s === 'TIMED_OUT')) return 'failing';
  if (states.some((s) => s === '' || s === 'PENDING' || s === 'IN_PROGRESS' || s === 'QUEUED' || s === 'EXPECTED')) return 'pending';
  return 'passing';
}

async function fetchMyPRs(run, { repos = [] } = {}) {
  const out = await run('gh', [
    'search', 'prs', '--author=@me', '--state=open',
    '--limit', '50', '--json', SEARCH_FIELDS,
  ]);
  let items = JSON.parse(out).map(toItem);
  if (repos.length > 0) items = items.filter((i) => repos.includes(i.repo));
  return Promise.all(items.map(async (item) => {
    const detail = JSON.parse(await run('gh', [
      'pr', 'view', item.url, '--json', 'mergeable,reviewDecision,statusCheckRollup',
    ]));
    return {
      ...item,
      ci: classifyCI(detail.statusCheckRollup),
      reviewDecision: detail.reviewDecision || '',
      mergeable: detail.mergeable || 'UNKNOWN',
    };
  }));
}

module.exports = { fetchReviewsRequested, fetchMyPRs, classifyCI, toItem, SEARCH_FIELDS };
