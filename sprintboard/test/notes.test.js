'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { liveNotes, createNote, updateNote, deleteNote } = require('../lib/notes.js');

const T0 = '2026-08-10T00:00:00Z';
const T1 = '2026-08-11T00:00:00Z';

test('createNote validates title and stage', () => {
  assert.match(createNote([], { title: '   ', stage: 'todo' }).error, /title/);
  assert.match(createNote([], { title: 'x', stage: 'later' }).error, /stage/);
  assert.match(createNote([], { stage: 'todo' }).error, /title/);
});

test('createNote appends a complete note and does not mutate its input', () => {
  const before = [];
  const { notes, note } = createNote(before, { title: ' water plants ', details: 'the ferns', stage: 'todo' }, T0);
  assert.strictEqual(before.length, 0);
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(note.title, 'water plants');
  assert.strictEqual(note.details, 'the ferns');
  assert.strictEqual(note.stage, 'todo');
  assert.strictEqual(note.createdAt, T0);
  assert.strictEqual(note.updatedAt, T0);
  assert.strictEqual(note.deletedAt, '');
  assert.ok(note.id.length > 0);
});

test('createNote defaults details to an empty string', () => {
  const { note } = createNote([], { title: 'x', stage: 'qa' }, T0);
  assert.strictEqual(note.details, '');
});

test('updateNote patches only provided fields and stamps updatedAt', () => {
  const { notes } = createNote([], { title: 'a', details: 'd', stage: 'todo' }, T0);
  const { notes: next, note } = updateNote(notes, { id: notes[0].id, stage: 'qa' }, T1);
  assert.strictEqual(note.stage, 'qa');
  assert.strictEqual(note.title, 'a');
  assert.strictEqual(note.details, 'd');
  assert.strictEqual(note.updatedAt, T1);
  assert.strictEqual(note.createdAt, T0);
  assert.strictEqual(notes[0].stage, 'todo'); // input untouched
  assert.strictEqual(next.length, 1);
});

test('updateNote rejects empty titles, bad stages, and unknown ids', () => {
  const { notes } = createNote([], { title: 'a', stage: 'todo' }, T0);
  assert.match(updateNote(notes, { id: notes[0].id, title: ' ' }).error, /title/);
  assert.match(updateNote(notes, { id: notes[0].id, stage: 'nope' }).error, /stage/);
  const missing = updateNote(notes, { id: 'ghost' });
  assert.match(missing.error, /ghost/);
  assert.strictEqual(missing.notFound, true);
});

test('deleteNote tombstones without removing; deleted notes reject further ops', () => {
  const { notes } = createNote([], { title: 'a', stage: 'todo' }, T0);
  const id = notes[0].id;
  const { notes: next } = deleteNote(notes, { id }, T1);
  assert.strictEqual(next.length, 1);
  assert.strictEqual(next[0].deletedAt, T1);
  assert.strictEqual(deleteNote(next, { id }).notFound, true);
  assert.strictEqual(updateNote(next, { id, title: 'b' }).notFound, true);
});

test('liveNotes filters tombstones and sorts newest first', () => {
  let notes = [];
  ({ notes } = createNote(notes, { title: 'old', stage: 'todo' }, T0));
  ({ notes } = createNote(notes, { title: 'new', stage: 'todo' }, T1));
  ({ notes } = createNote(notes, { title: 'gone', stage: 'todo' }, T1));
  ({ notes } = deleteNote(notes, { id: notes.find((n) => n.title === 'gone').id }, T1));
  assert.deepStrictEqual(liveNotes(notes).map((n) => n.title), ['new', 'old']);
});

test('liveNotes skips null entries from a hand-edited file', () => {
  const { notes } = createNote([], { title: 'a', stage: 'todo' }, T0);
  assert.deepStrictEqual(liveNotes([null, ...notes]).map((n) => n.title), ['a']);
});
