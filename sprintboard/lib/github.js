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

async function fetchMyPRs(run, { repoPaths = {} } = {}) {
  const out = await run('gh', [
    'search', 'prs', '--author=@me', '--state=open',
    '--limit', '50', '--json', SEARCH_FIELDS,
  ]);
  const repos = Object.keys(repoPaths);
  let items = JSON.parse(out).map(toItem);
  if (repos.length > 0) items = items.filter((i) => repos.includes(i.repo));
  return Promise.all(items.map(async (item) => {
    try {
      const detail = JSON.parse(await run('gh', [
        'pr', 'view', item.url, '--json', 'mergeable,reviewDecision,statusCheckRollup',
      ]));
      return {
        ...item,
        ci: classifyCI(detail.statusCheckRollup),
        reviewDecision: detail.reviewDecision || '',
        mergeable: detail.mergeable || 'UNKNOWN',
      };
    } catch (err) {
      return {
        ...item,
        ci: 'none',
        reviewDecision: '',
        mergeable: 'UNKNOWN',
      };
    }
  }));
}

const LIST_FIELDS = 'number,title,url,updatedAt,isDraft,headRefName,author,'
  + 'mergeable,reviewDecision,latestReviews,statusCheckRollup';
const REPO_PR_LIMIT = 100;

// One batched call per repo: gh pr list returns review/CI fields that
// gh search prs cannot, so no per-PR enrichment calls are needed.
async function fetchRepoPRs(run, { repoPaths = {} } = {}) {
  const repos = Object.keys(repoPaths);
  const truncated = [];
  const failed = [];
  const lists = await Promise.all(repos.map(async (repo) => {
    let prs;
    try {
      const out = await run('gh', [
        'pr', 'list', '-R', repo, '--state', 'open',
        '--limit', String(REPO_PR_LIMIT), '--json', LIST_FIELDS,
      ]);
      prs = JSON.parse(out);
    } catch (e) {
      // One bad repo (auth, deletion, rate limit) must not lose the rest.
      failed.push({ repo, message: e.message });
      return [];
    }
    if (prs.length >= REPO_PR_LIMIT) truncated.push(repo);
    return prs.map((pr) => ({
      ...toItem({ ...pr, repository: { nameWithOwner: repo } }),
      author: pr.author?.login || '',
      headRefName: pr.headRefName || '',
      ci: classifyCI(pr.statusCheckRollup),
      reviewDecision: pr.reviewDecision || '',
      mergeable: pr.mergeable || 'UNKNOWN',
      latestReviews: pr.latestReviews || [],
    }));
  }));
  return { items: lists.flat(), truncated, failed };
}

module.exports = { fetchReviewsRequested, fetchMyPRs, fetchRepoPRs, classifyCI, toItem, SEARCH_FIELDS };
