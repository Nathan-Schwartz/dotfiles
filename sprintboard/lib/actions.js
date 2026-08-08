'use strict';

// Match semantics: every key must be satisfied. Scalar = strict equality,
// array = one-of; an item-side array matches on intersection. A field
// missing from the item never matches; an empty match matches everything.
function matches(match, item) {
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

module.exports = { matches, viableActions };
