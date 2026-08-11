'use strict';

const stageDefs = [
  { id: 'todo', title: 'Todo' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'in-review', title: 'In Review' },
  { id: 'qa', title: 'QA' },
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

let lastData = null;
let pendingHideItem = null;

async function postHideToggle(endpoint, item) {
  let body = null;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: item.key }),
    });
    if (res.ok && lastData) body = await res.json();
  } catch {
    // fetch rejects on network failure, res.json() on a malformed body. Either
    // way the click is lost; the next successful action syncs.
  }
  if (body) renderBoard({ ...lastData, hidden: body.hidden, unhidden: body.unhidden });
}

const hideDialog = document.getElementById('hide-confirm');
document.getElementById('hide-confirm-yes').addEventListener('click', async () => {
  if (pendingHideItem) await postHideToggle('/api/hide', pendingHideItem);
  pendingHideItem = null;
  hideDialog.close();
});
document.getElementById('hide-confirm-no').addEventListener('click', () => {
  pendingHideItem = null;
  hideDialog.close();
});

function hideButton(item) {
  const btn = el('button', { class: 'hide-btn', text: '✕', title: 'hide' });
  btn.addEventListener('click', () => {
    pendingHideItem = item;
    document.getElementById('hide-confirm-title').textContent =
      `${item.repo ? `${item.repo}#${item.number}` : item.key} ${item.title}`;
    hideDialog.showModal();
  });
  return btn;
}

function badges(item) {
  const out = [];
  if (item.type === 'pr') {
    if (item.needsMyReview) out.push(['needs my review', 'attn']);
    if (item.isDraft) out.push(['draft', 'muted']);
    if (item.ci && item.ci !== 'none') out.push([`ci: ${item.ci}`, item.ci === 'failing' ? 'bad' : item.ci === 'passing' ? 'good' : 'muted']);
    if (item.reviewDecision) out.push([item.reviewDecision.toLowerCase().replace(/_/g, ' '), item.reviewDecision === 'CHANGES_REQUESTED' ? 'bad' : item.reviewDecision === 'APPROVED' ? 'good' : 'muted']);
    if (item.mergeable === 'CONFLICTING') out.push(['conflicts', 'bad']);
    if (item.ticketKey) out.push([`${item.ticketKey}${item.ticketStatus ? `: ${item.ticketStatus}` : ''}`, 'muted']);
    if (item.author) out.push([item.author, 'muted']);
  } else {
    if (item.status) out.push([item.status, 'muted']);
    if (item.priority) out.push([item.priority, 'muted']);
  }
  if (item.stageUnknown) out.push(['unknown status', 'muted']);
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

function actionsRow(item, allNames) {
  const rest = allNames.filter((n) => !item.actions.includes(n));
  const kids = item.actions.map((n) => actionButton(item, n));
  if (rest.length > 0) {
    kids.push(el('details', { class: 'more' }, [
      el('summary', { text: '⋯', title: 'all actions' }),
      el('div', { class: 'actions' }, rest.map((n) => actionButton(item, n))),
    ]));
  }
  return el('div', { class: 'actions' }, kids);
}

function renderPRRow(item, allNames) {
  const link = el('a', { href: item.url, target: '_blank', text: `${item.repo}#${item.number} ${item.title}` });
  return el('div', { class: `pr-row${item.needsMyReview ? ' attention' : ''}` }, [
    link, el('div', { class: 'badges' }, badges(item)), actionsRow(item, allNames),
  ]);
}

function renderCard(item, allNames, prRows = []) {
  const link = el('a', { href: item.url, target: '_blank', text: item.title });
  const meta = el('div', { class: 'meta', text: item.type === 'pr' ? `${item.repo}#${item.number}` : item.key });
  const cls = `card${item.type === 'pr' ? ' pr' : ''}${item.needsMyReview ? ' attention' : ''}`;
  // Config-hidden non-PR cards also get the ✕ so an unhidden override can
  // be undone in place (applyHide routes it back to the override list).
  const head = item.type === 'pr' || item.hiddenByConfig ? [hideButton(item), link] : [link];
  return el('article', { class: cls, 'data-key': item.key }, [
    ...head, meta, el('div', { class: 'badges' }, badges(item)), actionsRow(item, allNames), ...prRows,
  ]);
}

function renderHiddenGroup(hidden) {
  return el('details', { class: 'hidden-group' }, [
    el('summary', { text: `${hidden.length} hidden` }),
    ...hidden.map((item) => {
      const btn = el('button', { class: 'unhide-btn', text: 'unhide' });
      btn.addEventListener('click', () => postHideToggle('/api/unhide', item));
      return el('div', { class: 'hidden-row' }, [
        el('a', { href: item.url, target: '_blank', text: `${item.repo ? `${item.repo}#${item.number}` : item.key} ${item.title}` }),
        btn,
      ]);
    }),
  ]);
}

// needs-my-review first, failing CI next, then most recently updated.
function cardOrder(a, b) {
  const n = Number(!!b.needsMyReview) - Number(!!a.needsMyReview);
  if (n) return n;
  const c = Number(!!b.ciFailing) - Number(!!a.ciFailing);
  if (c) return c;
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
}

function renderBoard(data) {
  lastData = data;
  document.getElementById('fetched-at').textContent =
    `fetched ${new Date(data.fetchedAt).toLocaleTimeString()}${data.stale ? ' (stale)' : ''}`;
  const errBox = document.getElementById('errors');
  errBox.replaceChildren(...data.errors.map((e) => el('p', { class: 'error', text: `${e.source}: ${e.message}` })));
  const hiddenUrls = data.hidden || [];
  const unhiddenUrls = data.unhidden || [];
  const allNames = data.actionNames || [];
  const tickets = new Map(data.items.filter((i) => i.type === 'jira').map((t) => [t.key, t]));
  const nested = new Map(); // ticketKey -> PR items rendered inside that ticket's card
  for (const pr of data.items) {
    if (pr.type !== 'pr' || !pr.ticketKey || !tickets.has(pr.ticketKey)) continue;
    if (!nested.has(pr.ticketKey)) nested.set(pr.ticketKey, []);
    nested.get(pr.ticketKey).push(pr);
  }
  const topLevel = data.items.filter(
    (i) => i.type === 'jira' || !(i.ticketKey && tickets.has(i.ticketKey)),
  );
  const board = document.getElementById('board');
  board.replaceChildren(...stageDefs.map((def) => {
    const laneItems = topLevel.filter((i) => i.stage === def.id).sort(cardOrder);
    const { visible, hidden } = Hidden.partitionLane(laneItems, hiddenUrls, unhiddenUrls);
    return el('section', { class: 'lane', id: `lane-${def.id}` }, [
      el('h2', { text: `${def.title} (${visible.length})` }),
      ...visible.map((i) => renderCard(i, allNames, (nested.get(i.key) || []).map((pr) => renderPRRow(pr, allNames)))),
      ...(hidden.length > 0 ? [renderHiddenGroup(hidden)] : []),
    ]);
  }));
}

async function load(refresh) {
  const res = await fetch(`/api/board${refresh ? '?refresh=1' : ''}`);
  renderBoard(await res.json());
}

document.getElementById('refresh').addEventListener('click', () => load(true));

async function migrateLocalStorage() {
  const read = (k) => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const hidden = read('sprintboard-hidden-prs');
  const unhidden = read('sprintboard-unhidden-prs');
  if (hidden.length === 0 && unhidden.length === 0) return;
  try {
    await fetch('/api/migrate-hidden', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hidden, unhidden }),
    });
    localStorage.removeItem('sprintboard-hidden-prs');
    localStorage.removeItem('sprintboard-unhidden-prs');
  } catch {
    // Server unreachable — keep localStorage so a later load can migrate.
  }
}

async function loadStale() {
  let data = null;
  try {
    const res = await fetch('/api/board?stale=1');
    if (res.ok) data = await res.json();
  } catch {
    // fetch rejects on network failure, res.json() on a malformed body. An
    // absent cache answers 404, which does not throw and leaves data null.
  }
  if (data) renderBoard(data);
}

migrateLocalStorage().then(loadStale).then(() => load(false));

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
