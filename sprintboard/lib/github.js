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

module.exports = { fetchReviewsRequested, toItem, SEARCH_FIELDS };
