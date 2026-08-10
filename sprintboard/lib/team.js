'use strict';

// Jira-key-shaped tokens: letters, optional alphanumerics, dash, digits.
// Candidates are only accepted on exact membership in the known-ticket set,
// so lookalikes (UTF-8) and longer keys (ENG-12346 vs ENG-1234) never map.
const KEY_RE = /([A-Za-z][A-Za-z0-9]*-\d+)/g;

function extractTicketKey(pr, knownKeys) {
  for (const text of [pr.headRefName, pr.title]) {
    for (const m of String(text || '').matchAll(KEY_RE)) {
      const key = m[1].toUpperCase();
      if (knownKeys.has(key)) return key;
    }
  }
  return '';
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

module.exports = { extractTicketKey, joinTickets };
