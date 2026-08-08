'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig, DEFAULTS } = require('../lib/config.js');

function tmpConfig(obj) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-')), 'config.json');
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

test('missing file returns defaults', () => {
  const cfg = loadConfig('/nonexistent/sprintboard.json');
  assert.strictEqual(cfg.port, 1337);
  assert.strictEqual(cfg.cacheSeconds, 300);
  assert.strictEqual(cfg.launch.session, 'mainsession');
});

test('user values deep-merge over defaults', () => {
  const p = tmpConfig({ port: 4000, sources: { jira: { project: 'PROJ' } } });
  const cfg = loadConfig(p);
  assert.strictEqual(cfg.port, 4000);
  assert.strictEqual(cfg.sources.jira.project, 'PROJ');
  // untouched defaults survive the merge
  assert.strictEqual(cfg.sources.github.enabled, true);
  assert.strictEqual(cfg.cacheSeconds, 300);
});

test('invalid JSON throws with the file path in the message', () => {
  const p = tmpConfig({});
  fs.writeFileSync(p, '{not json');
  assert.throws(() => loadConfig(p), (e) => e.message.includes(p));
});

test('DEFAULTS includes extensible sources block', () => {
  assert.ok(DEFAULTS.sources.github);
  assert.ok(DEFAULTS.sources.jira);
});
