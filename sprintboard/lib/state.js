'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function statePath() {
  return process.env.SPRINTBOARD_STATE || path.join(os.homedir(), '.sprintboard-state.json');
}

const EMPTY = { hidden: [], unhidden: [], board: null, migratedAt: '' };

// Machine-local mutable state (manual hide lists + last good board payload).
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
  function save() {
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, p); // rename is atomic: readers never see a partial file
  }
  return { state, save, path: p };
}

module.exports = { createStore, statePath, EMPTY };
