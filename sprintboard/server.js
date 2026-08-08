'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('./lib/config.js');
const tmuxLib = require('./lib/tmux.js');
const { run } = require('./lib/exec.js');

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
    ];
    const results = await Promise.allSettled(sources.map(([, , fn]) => fn()));
    const lanes = {};
    const errors = [];
    results.forEach((r, i) => {
      const [lane, source] = sources[i];
      if (r.status === 'fulfilled') lanes[lane] = r.value;
      else { lanes[lane] = []; errors.push({ source, message: r.reason.message }); }
    });
    const payload = { fetchedAt: new Date().toISOString(), lanes, errors };
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
    for (const items of Object.values(cache.payload.lanes)) {
      const hit = items.find((i) => i.key === key);
      if (hit) return hit;
    }
    return null;
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (c) => { data += c; });
      req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    });
  }

  async function handleLaunch(req, res) {
    const { key } = await readBody(req);
    const item = findItem(key);
    if (!item) return sendJSON(res, 404, { error: `no board item with key ${key}` });
    const cwd = expandTilde(
      (item.type === 'pr' && config.sources.github.repoPaths?.[item.repo]) || config.launch.defaultCwd || os.homedir(),
    );
    const prompt = tmuxLib.fillTemplate(config.launch.promptTemplate, item);
    const { target, attach } = await tmux.launch(run, {
      session: config.launch.session, name: tmuxLib.windowName(key), cwd, prompt,
    });
    const record = { key, target, attach, launchedAt: new Date().toISOString() };
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
  const app = createApp({
    config,
    fetchers: {
      reviewsRequested: () => (config.sources.github.enabled ? gh.fetchReviewsRequested(run) : Promise.resolve([])),
      myPRs: () => (config.sources.github.enabled ? gh.fetchMyPRs(run, config.sources.github) : Promise.resolve([])),
      jira: () => (config.sources.jira.enabled && (config.sources.jira.project || config.sources.jira.jql)
        ? jira.fetchJiraItems(run, config.sources.jira) : Promise.resolve([])),
    },
  });
  app.listen(config.port, '127.0.0.1', () => {
    console.log(`sprintboard on http://localhost:${config.port}`);
  });
}

if (require.main === module) main();
module.exports = { createApp };
