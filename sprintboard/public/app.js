'use strict';

const laneDefs = [
  { id: 'needs-review', title: 'Needs my review' },
  { id: 'changes-requested', title: 'Changes requested' },
  { id: 'failed-ci', title: 'Failed CI' },
  { id: 'mergeable', title: 'Mergeable' },
  { id: 'my-prs', title: 'My open PRs' },
  { id: 'team-prs', title: 'Team PRs' },
  { id: 'jira', title: 'Jira' },
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(c);
  return node;
}

function badges(item) {
  const out = [];
  if (item.type === 'pr') {
    if (item.isDraft) out.push(['draft', 'muted']);
    if (item.ci && item.ci !== 'none') out.push([`ci: ${item.ci}`, item.ci === 'failing' ? 'bad' : item.ci === 'passing' ? 'good' : 'muted']);
    if (item.reviewDecision) out.push([item.reviewDecision.toLowerCase().replace(/_/g, ' '), item.reviewDecision === 'CHANGES_REQUESTED' ? 'bad' : 'muted']);
    if (item.mergeable === 'CONFLICTING') out.push(['conflicts', 'bad']);
    if (item.ticketKey) out.push([`${item.ticketKey}${item.ticketStatus ? `: ${item.ticketStatus}` : ''}`, 'muted']);
    if (item.author) out.push([item.author, 'muted']);
  } else {
    if (item.status) out.push([item.status, 'muted']);
    if (item.priority) out.push([item.priority, 'muted']);
  }
  return out.map(([text, cls]) => el('span', { class: `badge ${cls}`, text }));
}

function actionButton(item, name) {
  const btn = el('button', { class: 'launch', text: `▶ ${name}` });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: item.key, action: name }),
      });
      const body = await res.json();
      if (res.ok) {
        btn.textContent = `launched → ${body.target}`;
      } else {
        btn.textContent = `error: ${body.error}`;
        btn.disabled = false;
      }
    } catch (e) {
      btn.textContent = `error: ${e.message}`;
      btn.disabled = false;
    }
  });
  return btn;
}

function renderCard(item) {
  const link = el('a', { href: item.url, target: '_blank', text: item.title });
  const meta = el('div', { class: 'meta', text: item.type === 'pr' ? `${item.repo}#${item.number}` : item.key });
  const actions = el('div', { class: 'actions' }, item.actions.map((name) => actionButton(item, name)));
  return el('article', { class: 'card', 'data-key': item.key }, [link, meta, el('div', { class: 'badges' }, badges(item)), actions]);
}

function renderBoard(data) {
  document.getElementById('fetched-at').textContent = `fetched ${new Date(data.fetchedAt).toLocaleTimeString()}`;
  const errBox = document.getElementById('errors');
  errBox.replaceChildren(...data.errors.map((e) => el('p', { class: 'error', text: `${e.source}: ${e.message}` })));
  const board = document.getElementById('board');
  board.replaceChildren(...laneDefs.map((def) => {
    const items = data.items.filter((i) => i.lanes.includes(def.id));
    return el('section', { class: 'lane', id: `lane-${def.id}` }, [
      el('h2', { text: `${def.title} (${items.length})` }),
      ...items.map(renderCard),
    ]);
  }));
}

async function load(refresh) {
  const res = await fetch(`/api/board${refresh ? '?refresh=1' : ''}`);
  renderBoard(await res.json());
}

document.getElementById('refresh').addEventListener('click', () => load(true));
load(false);

let tailTarget = null;

async function refreshSessions() {
  const list = await (await fetch('/api/sessions')).json();
  const box = document.getElementById('session-list');
  box.replaceChildren(...list.map((s) => {
    const row = el('div', { class: `session ${s.alive ? '' : 'dead'}` }, [
      el('button', { class: 'tail-btn', text: `${s.key} [${s.action}] @ ${s.target}${s.alive ? '' : ' (ended)'}` }),
      el('code', { text: s.attach }),
    ]);
    row.querySelector('button').addEventListener('click', () => { tailTarget = s.target; });
    return row;
  }));
  if (tailTarget) {
    const res = await fetch(`/api/sessions/tail?target=${encodeURIComponent(tailTarget)}`);
    const body = await res.json();
    document.getElementById('session-tail').textContent = res.ok ? body.lines : body.error;
  }
}

setInterval(refreshSessions, 2000);
refreshSessions();
