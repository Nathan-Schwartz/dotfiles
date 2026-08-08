'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./lib/config.js');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function createApp({ config, fetchers }) {
  let cache = null; // { at: epoch-ms, payload }

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

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/board') {
        return sendJSON(res, 200, await board(url.searchParams.has('refresh')));
      }
      if (req.method === 'GET') return sendStatic(res, url.pathname);
      return sendJSON(res, 405, { error: 'method not allowed' });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  });
}

function main() {
  const config = loadConfig();
  const { run } = require('./lib/exec.js');
  const gh = require('./lib/github.js');
  const jira = require('./lib/jira.js');
  const app = createApp({
    config,
    fetchers: {
      reviewsRequested: () => (config.sources.github.enabled ? gh.fetchReviewsRequested(run) : Promise.resolve([])),
      myPRs: () => (config.sources.github.enabled ? gh.fetchMyPRs(run, config.sources.github) : Promise.resolve([])),
      jira: () => (config.sources.jira.enabled && config.sources.jira.project
        ? jira.fetchJiraItems(run, config.sources.jira) : Promise.resolve([])),
    },
  });
  app.listen(config.port, '127.0.0.1', () => {
    console.log(`sprintboard on http://localhost:${config.port}`);
  });
}

if (require.main === module) main();
module.exports = { createApp };
