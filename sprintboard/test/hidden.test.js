'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { partitionLane, pruneHidden, applyHide, applyUnhide } = require('../public/hidden.js');

test('partitionLane splits hidden PRs from visible items, preserving order', () => {
  const items = [
    { type: 'pr', url: 'https://gh/x/1', title: 'bot bump' },
    { type: 'jira', url: 'https://jira/PROJ-1', title: 'ticket' },
    { type: 'pr', url: 'https://gh/x/2', title: 'real work' },
    { type: 'pr', url: 'https://gh/x/3', title: 'more noise' },
  ];
  const { visible, hidden } = partitionLane(items, ['https://gh/x/1', 'https://gh/x/3']);
  assert.deepStrictEqual(hidden.map((i) => i.url), ['https://gh/x/1', 'https://gh/x/3']);
  assert.deepStrictEqual(visible.map((i) => i.url), ['https://jira/PROJ-1', 'https://gh/x/2']);
});

test('partitionLane never hides jira cards even if their url is listed', () => {
  const items = [{ type: 'jira', url: 'https://jira/PROJ-1' }];
  const { visible, hidden } = partitionLane(items, ['https://jira/PROJ-1']);
  assert.deepStrictEqual(hidden, []);
  assert.strictEqual(visible.length, 1);
});

test('partitionLane with empty hidden list keeps everything visible', () => {
  const items = [{ type: 'pr', url: 'https://gh/x/1' }];
  const { visible, hidden } = partitionLane(items, []);
  assert.strictEqual(visible.length, 1);
  assert.deepStrictEqual(hidden, []);
});

test('pruneHidden drops urls absent from the feed', () => {
  const items = [{ type: 'pr', url: 'https://gh/x/1' }];
  assert.deepStrictEqual(
    pruneHidden(['https://gh/x/1', 'https://gh/x/merged'], items, false),
    ['https://gh/x/1'],
  );
});

test('pruneHidden is a no-op when the fetch had errors', () => {
  assert.deepStrictEqual(pruneHidden(['https://gh/x/1'], [], true), ['https://gh/x/1']);
});

test('partitionLane hides config-hidden items', () => {
  const items = [
    { type: 'pr', url: 'https://gh/x/1', hiddenByConfig: true },
    { type: 'pr', url: 'https://gh/x/2' },
  ];
  const { visible, hidden } = partitionLane(items, [], []);
  assert.deepStrictEqual(hidden.map((i) => i.url), ['https://gh/x/1']);
  assert.deepStrictEqual(visible.map((i) => i.url), ['https://gh/x/2']);
});

test('partitionLane shows config-hidden items listed in unhidden overrides', () => {
  const items = [
    { type: 'pr', url: 'https://gh/x/1', hiddenByConfig: true },
    { type: 'pr', url: 'https://gh/x/2', hiddenByConfig: true },
  ];
  const { visible, hidden } = partitionLane(items, [], ['https://gh/x/1']);
  assert.deepStrictEqual(visible.map((i) => i.url), ['https://gh/x/1']);
  assert.deepStrictEqual(hidden.map((i) => i.url), ['https://gh/x/2']);
});

test('partitionLane unhidden overrides do not resurrect manually hidden urls', () => {
  const items = [{ type: 'pr', url: 'https://gh/x/1' }];
  const { visible, hidden } = partitionLane(items, ['https://gh/x/1'], ['https://gh/x/1']);
  assert.deepStrictEqual(visible, []);
  assert.deepStrictEqual(hidden.map((i) => i.url), ['https://gh/x/1']);
});

test('applyHide adds a normal PR to the hidden list', () => {
  const item = { type: 'pr', url: 'https://gh/x/1' };
  const out = applyHide(item, { hidden: ['https://gh/x/0'], unhidden: [] });
  assert.deepStrictEqual(out, { hidden: ['https://gh/x/0', 'https://gh/x/1'], unhidden: [] });
});

test('applyHide on a config-hidden item removes its unhidden override instead', () => {
  const item = { type: 'pr', url: 'https://gh/x/1', hiddenByConfig: true };
  const out = applyHide(item, { hidden: [], unhidden: ['https://gh/x/1', 'https://gh/x/2'] });
  assert.deepStrictEqual(out, { hidden: [], unhidden: ['https://gh/x/2'] });
});

test('applyUnhide removes a normal PR from the hidden list', () => {
  const item = { type: 'pr', url: 'https://gh/x/1' };
  const out = applyUnhide(item, { hidden: ['https://gh/x/1', 'https://gh/x/2'], unhidden: [] });
  assert.deepStrictEqual(out, { hidden: ['https://gh/x/2'], unhidden: [] });
});

test('applyUnhide on a config-hidden item adds an unhidden override', () => {
  const item = { type: 'pr', url: 'https://gh/x/1', hiddenByConfig: true };
  const out = applyUnhide(item, { hidden: [], unhidden: [] });
  assert.deepStrictEqual(out, { hidden: [], unhidden: ['https://gh/x/1'] });
});

// An item's hiddenByConfig status can change between clicks (rule edits,
// draft -> ready). Each operation must clear the url from the opposite
// list too, so stale entries can never make a button appear broken.
test('applyHide on a normal PR clears a stale unhidden override', () => {
  const item = { type: 'pr', url: 'https://gh/x/1' };
  const out = applyHide(item, { hidden: [], unhidden: ['https://gh/x/1'] });
  assert.deepStrictEqual(out, { hidden: ['https://gh/x/1'], unhidden: [] });
});

test('applyUnhide on a config-hidden item clears a stale manual hide', () => {
  const item = { type: 'pr', url: 'https://gh/x/1', hiddenByConfig: true };
  const out = applyUnhide(item, { hidden: ['https://gh/x/1'], unhidden: [] });
  assert.deepStrictEqual(out, { hidden: [], unhidden: ['https://gh/x/1'] });
});

test('applyHide never duplicates an already-hidden url', () => {
  const item = { type: 'pr', url: 'https://gh/x/1' };
  const out = applyHide(item, { hidden: ['https://gh/x/1'], unhidden: [] });
  assert.deepStrictEqual(out, { hidden: ['https://gh/x/1'], unhidden: [] });
});
