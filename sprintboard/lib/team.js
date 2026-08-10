'use strict';

const defaultDeps = () => ({ gh: require('./github.js'), jira: require('./jira.js') });

// Jira-key-shaped tokens: letters, optional alphanumerics, dash, digits.
// Candidates are only accepted on exact membership in the known-ticket set,
// so lookalikes (UTF-8) and longer keys (ENG-12346 vs ENG-1234) never map.
const KEY_RE = /([A-Za-z][A-Za-z0-9]*-\d+)/g;

// Shared helper: yields all uppercased Jira keys found in a PR's text fields.
function* keysInPR(pr) {
  for (const text of [pr.headRefName, pr.title]) {
    for (const m of String(text || '').matchAll(KEY_RE)) {
      yield m[1].toUpperCase();
    }
  }
}

function extractTicketKey(pr, knownKeys) {
  for (const key of keysInPR(pr)) {
    if (knownKeys.has(key)) return key;
  }
  return '';
}

// Reverse-join candidate set: every project-prefixed key any PR references.
// This becomes the exact key list queried from Jira, so mapping completeness
// depends on the board's PRs, not on project backlog size.
function extractCandidateKeys(prs, projectKey) {
  const prefix = `${String(projectKey).toUpperCase()}-`;
  const keys = new Set();
  for (const pr of prs) {
    for (const key of keysInPR(pr)) {
      if (key.startsWith(prefix)) keys.add(key);
    }
  }
  return [...keys];
}

function joinTickets(prs, tickets) {
  const byKey = new Map(tickets.map((t) => [t.key, t]));
  const known = new Set(byKey.keys());
  return prs.map((pr) => {
    const ticketKey = extractTicketKey(pr, known);
    if (!ticketKey) return pr;
    return { ...pr, ticketKey, ticketStatus: byKey.get(ticketKey).status || '' };
  });
}

// Team lane: batched repo PR fetch + reverse ticket join. The Jira query set
// is derived from the PRs themselves, so mapping completeness depends on the
// board, not on project backlog size. A failed key query falls back to the
// legacy bulk query so behavior never regresses below the pre-reverse-join
// baseline (including its cap warning).
async function fetchTeamLane(run, sources, deps = defaultDeps()) {
  const { items: prs, truncated, failed } = await deps.gh.fetchRepoPRs(run, sources.github);
  const warnings = [
    ...failed.map(({ repo, message }) => `${repo}: fetch failed: ${message}`),
    ...truncated.map((repo) => `${repo}: only the first 100 open PRs were fetched`),
  ];
  let tickets = [];
  const jiraCfg = sources.jira || {};
  if (prs.length > 0 && jiraCfg.enabled && jiraCfg.project) {
    const keys = extractCandidateKeys(prs, jiraCfg.project);
    if (keys.length > 0) {
      try {
        tickets = await deps.jira.fetchTicketsByKeys(run, jiraCfg, keys);
      } catch (e) {
        warnings.push(`ticket key query failed (${e.message}); falling back to bulk query`);
        try {
          tickets = await deps.jira.fetchTeamTickets(run, jiraCfg);
        } catch (e2) {
          // Mapping is best-effort: a Jira outage degrades badges, not the lane.
          warnings.push(`ticket mapping unavailable: ${e2.message}`);
        }
        if (tickets.length >= deps.jira.TEAM_TICKET_LIMIT) {
          warnings.push('ticket mapping may be incomplete: ticket query cap reached');
        }
      }
    }
  }
  return { items: joinTickets(prs, tickets), warnings };
}

module.exports = { extractTicketKey, joinTickets, extractCandidateKeys, fetchTeamLane };
