'use strict';

// Pure card ordering, loaded both as a browser script (globalThis.Order)
// and via require() in tests. Must stay DOM-free.
(function () {
  // Jira tickets above standalone PRs; needs-my-review floats a PR within
  // the PR group; most recently updated first otherwise.
  function cardOrder(a, b) {
    const t = Number(a.type === 'pr') - Number(b.type === 'pr');
    if (t) return t;
    const n = Number(!!b.needsMyReview) - Number(!!a.needsMyReview);
    if (n) return n;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  }

  const api = { cardOrder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.Order = api;
})();
