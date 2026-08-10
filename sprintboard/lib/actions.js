'use strict';

// Match semantics: every key must be satisfied. Scalar = strict equality,
// array = one-of; an item-side array matches on intersection. A field
// missing from the item never matches; an empty match matches everything.
// A match ARRAY is OR across its objects (empty array matches nothing).
function matches(match, item) {
  if (Array.isArray(match)) return match.some((m) => matches(m, item));
  return Object.entries(match || {}).every(([field, want]) => {
    const have = item[field];
    if (have === undefined) return false;
    const wants = Array.isArray(want) ? want : [want];
    const haves = Array.isArray(have) ? have : [have];
    return haves.some((h) => wants.includes(h));
  });
}

function viableActions(actions, item) {
  return (actions || []).filter((a) => matches(a.match, item)).map((a) => a.name);
}

// Strict interpolation: every placeholder must resolve to a non-empty value.
// Launching a claude session with a mangled prompt costs more than failing loudly.
function fillTemplate(tpl, item) {
  const missing = [];
  const out = tpl.replace(/\{([A-Za-z0-9_]+)\}/g, (_, field) => {
    const v = item[field];
    if (v === undefined || v === null || String(v) === '') {
      missing.push(field);
      return '';
    }
    return String(v);
  });
  if (missing.length > 0) {
    throw new Error(`unresolved placeholders: ${missing.map((f) => `{${f}}`).join(', ')}`);
  }
  return out;
}

module.exports = { matches, viableActions, fillTemplate };
