'use strict';

function buildJQL({ project, user, jql }) {
  if (jql) return jql;
  return `project = ${project} AND assignee = "${user}" AND statusCategory != Done ORDER BY updated DESC`;
}

function str(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v.name || v.displayName || v.value || String(v);
}

function toItem(raw, site) {
  const f = raw.fields || raw;
  const key = raw.key || raw.Key || f.key;
  return {
    key,
    type: 'jira',
    title: str(f.summary),
    status: str(f.status),
    priority: str(f.priority),
    issuetype: str(f.issuetype || f.issueType),
    url: `https://${site}/browse/${key}`,
  };
}

async function fetchJiraItems(run, cfg) {
  const out = await run('acli', [
    'jira', 'workitem', 'search',
    '--jql', buildJQL(cfg),
    '--fields', 'key,summary,status,priority,issuetype',
    '--json', '--limit', '50',
  ]);
  const parsed = JSON.parse(out);
  let list;
  if (Array.isArray(parsed)) {
    list = parsed;
  } else {
    list = parsed.results || parsed.workItems || parsed.issues;
    if (!Array.isArray(list)) {
      throw new Error('unrecognized acli output shape: keys [' + Object.keys(parsed).join(', ') + ']');
    }
  }
  return list.map((raw) => toItem(raw, cfg.site)).filter((item) => item.key);
}

module.exports = { buildJQL, fetchJiraItems };
