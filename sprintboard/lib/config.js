'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = {
  port: 1337,
  cacheSeconds: 300,
  stageMap: {},
  sources: {
    github: { enabled: true, repoPaths: {} },
    jira: { enabled: true, site: '', project: '', user: '', jql: '' },
  },
  actions: [
    {
      name: 'work-on',
      match: {},
      prompt:
        'You are picking up work item {key}: "{title}" ({url}). ' +
        'Investigate the current state and address what needs attention.',
    },
  ],
  launch: {
    session: 'sprintboard',
    defaultCwd: os.homedir(),
  },
};

function configPath() {
  return process.env.SPRINTBOARD_CONFIG || path.join(os.homedir(), '.sprintboard.json');
}

function merge(base, over) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object'
      ? merge(base[k], v)
      : v;
  }
  return out;
}

function loadConfig(p = configPath()) {
  if (!fs.existsSync(p)) return merge(DEFAULTS, {});
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`sprintboard config ${p} is not valid JSON: ${e.message}`);
  }
  return merge(DEFAULTS, raw);
}

module.exports = { loadConfig, configPath, DEFAULTS, merge };
