'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function statePath() {
  return process.env.SPRINTBOARD_STATE || path.join(os.homedir(), '.sprintboard-state.json');
}

const EMPTY = { hidden: [], unhidden: [], board: null, migratedAt: '', notes: [] };

function isSnapshot(v) {
  return !!v && typeof v === 'object' && typeof v.at === 'number' && !!v.payload && typeof v.payload === 'object';
}

// Machine-local mutable state (manual hide lists, reminder notes + last good board payload).
// Lives in $HOME beside ~/.sprintboard.json — never inside the repo, where
// `git clean -fdx` would destroy it.
function createStore(p = statePath()) {
  let state = structuredClone(EMPTY);
  if (fs.existsSync(p)) {
    try {
      state = { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(p, 'utf8')) };
    } catch (e) {
      // Quarantine rather than delete: hide lists are user data.
      fs.renameSync(p, `${p}.corrupt`);
      console.warn(`sprintboard state ${p} unreadable (${e.message}); moved to ${p}.corrupt`);
    }
  }
  // The file is hand-editable, so every field the board reads is forced back to
  // its expected shape; unknown fields still ride along untouched.
  if (!Array.isArray(state.hidden)) state.hidden = [];
  if (!Array.isArray(state.unhidden)) state.unhidden = [];
  if (!isSnapshot(state.board)) state.board = null;
  if (typeof state.migratedAt !== 'string') state.migratedAt = '';
  if (!Array.isArray(state.notes)) state.notes = [];

  const store = {
    state,
    save() {
      const tmp = `${p}.tmp`;
      // Serialize store.state, not the captured local, so a `store.state = {...}`
      // reassignment can never persist the stale object.
      // 0600: the snapshot holds work data and $HOME may be shared.
      fs.writeFileSync(tmp, JSON.stringify(store.state, null, 2), { mode: 0o600 });
      fs.renameSync(tmp, p); // rename is atomic: readers never see a partial file
    },
    path: p,
  };
  return store;
}

module.exports = { createStore, statePath, EMPTY };
