'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('./lib/config.js');
const tmuxLib = require('./lib/tmux.js');
const { run } = require('./lib/exec.js');
const { lanesFor } = require('./lib/lanes.js');
const { matches, viableActions, fillTemplate } = require('./lib/actions.js');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function expandTilde(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function createApp({ config, fetchers, tmux = tmuxLib }) {
  let cache = null; // { at: epoch-ms, payload }
  const sessions = [];

  async function board(refresh) {
    if (!refresh && cache && Date.now() - cache.at < config.cacheSeconds * 1000) return cache.payload;
    const sources = [
      ['reviewsRequested', 'github', fetchers.reviewsRequested],
      ['myPRs', 'github', fetchers.myPRs],
      ['jira', 'jira', fetchers.jira],
      ['teamPRs', 'github', fetchers.teamPRs], // last: loses key-dedup ties
    ];
    const results = await Promise.allSettled(
      sources.map(([, , fn]) => (fn ? fn() : Promise.resolve([]))),
    );
    const items = [];
    const errors = [];
    const seen = new Set();
    results.forEach((r, i) => {
      const [sourceLane, source] = sources[i];
      if (r.status === 'fulfilled') {
        // Fetchers return Item[] or { items, warnings } (partial success).
        const { items: list = [], warnings = [] } = Array.isArray(r.value) ? { items: r.value } : r.value;
        for (const w of warnings) errors.push({ source, message: w });
        for (const raw of list) {
          if (seen.has(raw.key)) continue;
          seen.add(raw.key);
          const item = { ...raw, lanes: lanesFor(sourceLane, raw) };
          item.actions = viableActions(config.actions, item);
          items.push(item);
        }
      } else {
        errors.push({ source, message: r.reason.message });
      }
    });
    const payload = { fetchedAt: new Date().toISOString(), items, errors };
    cache = { at: Date.now(), payload };
    return payload;
  }

  function sendJSON(res, status, obj) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  }

  function sendStatic(res, urlPath) {
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const file = path.join(PUBLIC_DIR, path.normalize(rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file)) return sendJSON(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  }

  function findItem(key) {
    if (!cache) return null;
    return cache.payload.items.find((i) => i.key === key) || null;
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (c) => { data += c; });
      req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    });
  }

  async function handleLaunch(req, res) {
    const { key, action: actionName } = await readBody(req);
    const item = findItem(key);
    if (!item) return sendJSON(res, 404, { error: `no board item with key ${key}` });
    const action = (config.actions || []).find((a) => a.name === actionName);
    if (!action) return sendJSON(res, 404, { error: `unknown action ${actionName}` });
    if (!matches(action.match, item)) {
      return sendJSON(res, 409, { error: `action ${actionName} is not viable for ${key}` });
    }
    let prompt;
    try {
      prompt = fillTemplate(action.prompt, item);
    } catch (e) {
      return sendJSON(res, 400, { error: `${actionName}: ${e.message}` });
    }
    const cwd = expandTilde(
      action.cwd
        || (item.type === 'pr' && config.sources.github.repoPaths?.[item.repo])
        || config.launch.defaultCwd
        || os.homedir(),
    );
    const { target, attach } = await tmux.launch(run, {
      session: config.launch.session, name: tmuxLib.windowName(key), cwd, prompt,
    });
    const record = { key, action: action.name, target, attach, launchedAt: new Date().toISOString() };
    sessions.push(record);
    return sendJSON(res, 201, record);
  }

  async function handleSessions(res) {
    const withAlive = await Promise.all(sessions.map(async (s) => ({
      ...s,
      alive: await tmux.tail(run, s.target, 1).then(() => true, () => false),
    })));
    return sendJSON(res, 200, withAlive);
  }

  async function handleTail(url, res) {
    const target = url.searchParams.get('target');
    const record = sessions.find((s) => s.target === target);
    try {
      const lines = await tmux.tail(run, target, 80);
      return sendJSON(res, 200, { target, attach: record ? record.attach : '', lines });
    } catch (e) {
      return sendJSON(res, 410, { error: `window ${target} is gone: ${e.message}` });
    }
  }

  return http.createServer(async (req, res) => {
    const port = req.socket.localPort;
    const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
    if (!allowedHosts.has(req.headers.host)) return sendJSON(res, 403, { error: 'forbidden host' });
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/board') {
        return sendJSON(res, 200, await board(url.searchParams.has('refresh')));
      }
      if (req.method === 'POST' && url.pathname === '/api/launch') return await handleLaunch(req, res);
      if (req.method === 'GET' && url.pathname === '/api/sessions') return await handleSessions(res);
      if (req.method === 'GET' && url.pathname === '/api/sessions/tail') return await handleTail(url, res);
      if (req.method === 'GET') return sendStatic(res, url.pathname);
      return sendJSON(res, 405, { error: 'method not allowed' });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  });
}

function main() {
  const config = loadConfig();
  const gh = require('./lib/github.js');
  const jira = require('./lib/jira.js');
  const team = require('./lib/team.js');
  const app = createApp({
    config,
    fetchers: {
      reviewsRequested: () => (config.sources.github.enabled ? gh.fetchReviewsRequested(run) : Promise.resolve([])),
      myPRs: () => (config.sources.github.enabled ? gh.fetchMyPRs(run, config.sources.github) : Promise.resolve([])),
      jira: () => (config.sources.jira.enabled && (config.sources.jira.project || config.sources.jira.jql)
        ? jira.fetchJiraItems(run, config.sources.jira) : Promise.resolve([])),
      teamPRs: async () => {
        if (!config.sources.github.enabled) return [];
        const { items: prs, truncated, failed } = await gh.fetchRepoPRs(run, config.sources.github);
        const warnings = [
          ...failed.map(({ repo, message }) => `${repo}: fetch failed: ${message}`),
          ...truncated.map((repo) => `${repo}: only the first 100 open PRs were fetched`),
        ];
        let tickets = [];
        if (prs.length > 0 && config.sources.jira.enabled && config.sources.jira.project) {
          try {
            tickets = await jira.fetchTeamTickets(run, config.sources.jira);
          } catch (e) {
            // Mapping is best-effort: a Jira outage degrades badges, not the lane.
            warnings.push(`ticket mapping unavailable: ${e.message}`);
          }
          if (tickets.length >= jira.TEAM_TICKET_LIMIT) {
            warnings.push('ticket mapping may be incomplete: ticket query cap reached');
          }
        }
        return { items: team.joinTickets(prs, tickets), warnings };
      },
    },
  });
  app.listen(config.port, '127.0.0.1', () => {
    console.log(`sprintboard on http://localhost:${config.port}`);
  });
}

if (require.main === module) main();
module.exports = { createApp };
