'use strict';

// Pure hidden-PR set logic, loaded both as a browser script (globalThis.Hidden)
// and via require() in tests. Must stay DOM-free.
(function () {
  // Split one lane's items into visible and hidden. Manual hides apply only
  // to PR cards; config hides apply to any item unless overridden in
  // unhiddenUrls. A manual hide always wins over an unhidden override.
  function partitionLane(items, hiddenUrls, unhiddenUrls = []) {
    const set = new Set(hiddenUrls);
    const unhidden = new Set(unhiddenUrls);
    const visible = [];
    const hidden = [];
    for (const item of items) {
      const manual = item.type === 'pr' && set.has(item.url);
      if (manual || (item.hiddenByConfig && !unhidden.has(item.url))) hidden.push(item);
      else visible.push(item);
    }
    return { visible, hidden };
  }

  // Each click writes the url's canonical end state and clears it from
  // everywhere else, so a url lives in at most one list even when its
  // hiddenByConfig status changed between clicks (rule edits, draft flips).
  // Hide: config-matched items need neither list (config does the hiding);
  // others go on the manual hidden list.
  function applyHide(item, { hidden, unhidden }) {
    const rest = hidden.filter((u) => u !== item.url);
    return {
      hidden: item.hiddenByConfig ? rest : [...rest, item.url],
      unhidden: unhidden.filter((u) => u !== item.url),
    };
  }

  // Unhide: config-matched items need an override; others need neither list.
  function applyUnhide(item, { hidden, unhidden }) {
    const rest = unhidden.filter((u) => u !== item.url);
    return {
      hidden: hidden.filter((u) => u !== item.url),
      unhidden: item.hiddenByConfig ? [...rest, item.url] : rest,
    };
  }

  // Drop hidden urls that no longer match any fetched item (merged/closed PRs).
  // Skipped when the fetch had errors so a partial feed can't wipe the set.
  function pruneHidden(hiddenUrls, items, hasErrors) {
    if (hasErrors) return hiddenUrls;
    const urls = new Set(items.map((i) => i.url));
    return hiddenUrls.filter((u) => urls.has(u));
  }

  const api = { partitionLane, pruneHidden, applyHide, applyUnhide };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.Hidden = api;
})();
