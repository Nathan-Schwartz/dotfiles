'use strict';
const crypto = require('node:crypto');
const { STAGES } = require('./derive.js');

// Personal reminder notes: machine-local cards that exist only in the state
// file, never in Jira or GitHub. Soft delete keeps the tombstone in the file
// (recovery is hand-editing the JSON — there is deliberately no undelete UI);
// only live notes ever reach the board payload.

function liveNotes(notes) {
  return notes
    .filter((n) => n && !n.deletedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function badStage(stage) {
  return STAGES.includes(stage) ? '' : `stage must be one of ${STAGES.join(', ')}`;
}

function createNote(notes, body, now = new Date().toISOString()) {
  const title = String(body.title ?? '').trim();
  if (!title) return { error: 'title is required' };
  const stageError = badStage(body.stage);
  if (stageError) return { error: stageError };
  const note = {
    id: crypto.randomUUID(),
    title,
    details: String(body.details ?? ''),
    stage: body.stage,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
  };
  return { notes: [...notes, note], note };
}

function findLive(notes, id) {
  return notes.findIndex((n) => n.id === id && !n.deletedAt);
}

function updateNote(notes, body, now = new Date().toISOString()) {
  const idx = findLive(notes, body.id);
  if (idx === -1) return { error: `no note with id ${body.id}`, notFound: true };
  const next = { ...notes[idx] };
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return { error: 'title cannot be empty' };
    next.title = title;
  }
  if (body.details !== undefined) next.details = String(body.details);
  if (body.stage !== undefined) {
    const stageError = badStage(body.stage);
    if (stageError) return { error: stageError };
    next.stage = body.stage;
  }
  next.updatedAt = now;
  return { notes: notes.map((n, i) => (i === idx ? next : n)), note: next };
}

function deleteNote(notes, body, now = new Date().toISOString()) {
  const idx = findLive(notes, body.id);
  if (idx === -1) return { error: `no note with id ${body.id}`, notFound: true };
  const next = { ...notes[idx], deletedAt: now };
  return { notes: notes.map((n, i) => (i === idx ? next : n)), note: next };
}

module.exports = { liveNotes, createNote, updateNote, deleteNote };
