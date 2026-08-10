'use strict';

// Pure hidden-PR set logic, loaded both as a browser script (globalThis.Hidden)
// and via require() in tests. Must stay DOM-free.
(function () {
  // Split one lane's items into visible and hidden. Only top-level PR cards
  // are hideable; jira cards always stay visible.
  function partitionLane(items, hiddenUrls) {
    const set = new Set(hiddenUrls);
    const visible = [];
    const hidden = [];
    for (const item of items) {
      if (item.type === 'pr' && set.has(item.url)) hidden.push(item);
      else visible.push(item);
    }
    return { visible, hidden };
  }

  // Drop hidden urls that no longer match any fetched item (merged/closed PRs).
  // Skipped when the fetch had errors so a partial feed can't wipe the set.
  function pruneHidden(hiddenUrls, items, hasErrors) {
    if (hasErrors) return hiddenUrls;
    const urls = new Set(items.map((i) => i.url));
    return hiddenUrls.filter((u) => urls.has(u));
  }

  const api = { partitionLane, pruneHidden };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.Hidden = api;
})();
