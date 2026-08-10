'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { partitionLane, pruneHidden } = require('../public/hidden.js');

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
