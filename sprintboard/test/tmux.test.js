'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { launch, tail, fillTemplate, windowName } = require('../lib/tmux.js');

test('fillTemplate substitutes placeholders', () => {
  const out = fillTemplate('work on {key}: "{title}" ({url}) in {repo}', {
    key: 'a/b#1', title: 'T', url: 'https://x', repo: 'a/b',
  });
  assert.strictEqual(out, 'work on a/b#1: "T" (https://x) in a/b');
});

test('windowName sanitizes keys for tmux', () => {
  assert.strictEqual(windowName('acme/widgets#42'), 'widgets-42');
  assert.strictEqual(windowName('PROJ-123'), 'PROJ-123');
});

test('launch uses new-window when session exists', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => {
    calls.push(args);
    if (args[0] === 'has-session') return '';
    if (args[0] === 'new-window') return 'mainsession:3\n';
    return '';
  };
  const r = await launch(fakeRun, { session: 'mainsession', name: 'w', cwd: '/tmp', prompt: "it's go time" });
  assert.strictEqual(r.target, 'mainsession:3');
  assert.ok(r.attach.includes('mainsession:3'));
  const nw = calls.find((a) => a[0] === 'new-window');
  // single-quote shell quoting of the prompt inside the tmux shell-command
  assert.ok(nw[nw.length - 1].includes(`claude 'it'\\''s go time'`));
  // window created detached so board focus is not stolen
  assert.ok(nw.includes('-d'));
});

test('launch creates the session when absent', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => {
    calls.push(args);
    if (args[0] === 'has-session') throw new Error('no server');
    if (args[0] === 'new-session') return 'mainsession:0\n';
    return '';
  };
  const r = await launch(fakeRun, { session: 'mainsession', name: 'w', cwd: '/tmp', prompt: 'p' });
  assert.strictEqual(r.target, 'mainsession:0');
  assert.ok(calls.some((a) => a[0] === 'new-session'));
});

test('tail captures pane text', async () => {
  const calls = [];
  const fakeRun = async (cmd, args) => { calls.push(args); return 'line1\nline2\n'; };
  const out = await tail(fakeRun, 'mainsession:3', 40);
  assert.strictEqual(out, 'line1\nline2\n');
  assert.deepStrictEqual(calls[0], ['capture-pane', '-p', '-t', 'mainsession:3', '-S', '-40']);
});
