'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig, configPath, DEFAULTS, merge } = require('../lib/config.js');

function tmpConfig(obj) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-')), 'config.json');
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

test('missing file returns defaults', () => {
  const cfg = loadConfig('/nonexistent/sprintboard.json');
  assert.strictEqual(cfg.port, 1337);
  assert.strictEqual(cfg.cacheSeconds, 300);
  assert.strictEqual(cfg.launch.session, 'sprintboard');
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

test('mutating returned config does not mutate DEFAULTS', () => {
  const cfg = loadConfig('/nonexistent/sprintboard.json');
  // Mutate nested objects and fields on the returned config
  cfg.sources.github.repoPaths['acme/mutated'] = '~/code/mutated';
  cfg.launch.session = 'mutated-session';

  // DEFAULTS should be unchanged
  assert.strictEqual(Object.keys(DEFAULTS.sources.github.repoPaths).length, 0);
  assert.strictEqual(DEFAULTS.launch.session, 'sprintboard');

  // A fresh load should also return unchanged defaults
  const cfg2 = loadConfig('/nonexistent/sprintboard.json');
  assert.strictEqual(Object.keys(cfg2.sources.github.repoPaths).length, 0);
  assert.strictEqual(cfg2.launch.session, 'sprintboard');
});

test('DEFAULTS ship a catch-all action and no promptTemplate', () => {
  assert.strictEqual(DEFAULTS.actions.length, 1);
  assert.strictEqual(DEFAULTS.actions[0].name, 'work-on');
  assert.deepStrictEqual(DEFAULTS.actions[0].match, {});
  assert.ok(DEFAULTS.actions[0].prompt.includes('{key}'));
  assert.strictEqual(DEFAULTS.launch.promptTemplate, undefined);
});

test('a user actions array replaces the default actions entirely', () => {
  const merged = merge(DEFAULTS, { actions: [{ name: 'mine', match: { type: 'pr' }, prompt: 'p {key}' }] });
  assert.strictEqual(merged.actions.length, 1);
  assert.strictEqual(merged.actions[0].name, 'mine');
});
