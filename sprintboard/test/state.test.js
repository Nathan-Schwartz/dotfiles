'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore, statePath } = require('../lib/state.js');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-state-')), 'state.json');
}

test('statePath honors SPRINTBOARD_STATE and defaults to ~/.sprintboard-state.json', () => {
  process.env.SPRINTBOARD_STATE = '/tmp/custom-state.json';
  assert.strictEqual(statePath(), '/tmp/custom-state.json');
  delete process.env.SPRINTBOARD_STATE;
  assert.strictEqual(statePath(), path.join(os.homedir(), '.sprintboard-state.json'));
});

test('a missing file yields empty defaults', () => {
  const store = createStore(tmpFile());
  assert.deepStrictEqual(store.state, { hidden: [], unhidden: [], board: null, migratedAt: '', notes: [] });
});

test('a non-array notes field is coerced back to an empty list', () => {
  const p = tmpFile();
  fs.writeFileSync(p, JSON.stringify({ notes: 'scribbles' }));
  const store = createStore(p);
  assert.deepStrictEqual(store.state.notes, []);
});

test('save/load round-trips and unknown fields in an older file do not crash', () => {
  const p = tmpFile();
  const a = createStore(p);
  a.state.hidden = ['https://x/1'];
  a.state.board = { at: 123, payload: { items: [] } };
  a.state.migratedAt = '2026-08-10T00:00:00Z';
  a.save();
  const b = createStore(p);
  assert.deepStrictEqual(b.state, a.state);

  fs.writeFileSync(p, JSON.stringify({ hidden: ['u'], futureField: 1 }));
  const c = createStore(p);
  assert.deepStrictEqual(c.state.hidden, ['u']);
  assert.deepStrictEqual(c.state.unhidden, []);
});

test('a corrupt file is quarantined, not deleted, and yields defaults', () => {
  const p = tmpFile();
  fs.writeFileSync(p, '{not json');
  const store = createStore(p);
  assert.deepStrictEqual(store.state.hidden, []);
  assert.ok(fs.existsSync(`${p}.corrupt`));
  assert.strictEqual(fs.readFileSync(`${p}.corrupt`, 'utf8'), '{not json');
});

test('hand-edited fields of the wrong shape load as defaults', () => {
  const p = tmpFile();
  fs.writeFileSync(p, JSON.stringify({ hidden: null, unhidden: 'nope', board: { bogus: true }, migratedAt: 7, keepMe: 1 }));
  const store = createStore(p);
  assert.deepStrictEqual(store.state.hidden, []);
  assert.deepStrictEqual(store.state.unhidden, []);
  assert.strictEqual(store.state.board, null);
  assert.strictEqual(store.state.migratedAt, '');
  assert.strictEqual(store.state.keepMe, 1);
});

test('a board snapshot missing at or payload is dropped', () => {
  const p = tmpFile();
  fs.writeFileSync(p, JSON.stringify({ board: { at: '123', payload: {} } }));
  assert.strictEqual(createStore(p).state.board, null);
  fs.writeFileSync(p, JSON.stringify({ board: { at: 123 } }));
  assert.strictEqual(createStore(p).state.board, null);
  fs.writeFileSync(p, JSON.stringify({ board: { at: 123, payload: { items: [] } } }));
  assert.deepStrictEqual(createStore(p).state.board, { at: 123, payload: { items: [] } });
});

test('save persists the current store.state even after reassignment', () => {
  const p = tmpFile();
  const store = createStore(p);
  store.state = { hidden: ['https://x/2'], unhidden: [], board: null, migratedAt: '' };
  store.save();
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).hidden, ['https://x/2']);
});

test('save is atomic: no lingering tmp file, valid JSON on disk', () => {
  const p = tmpFile();
  const store = createStore(p);
  store.state.hidden = ['https://x/1'];
  store.save();
  assert.ok(!fs.existsSync(`${p}.tmp`));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(p, 'utf8')).hidden, ['https://x/1']);
});
