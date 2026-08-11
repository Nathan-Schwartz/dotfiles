# sprintboard

Personal attention board on `http://localhost:1337`: aggregates Jira work items
(via `acli`) and GitHub PRs (via `gh`) into read-only lanes, and can launch a
context-primed `claude` session in a tmux window for any item.

## Run

    node ~/dotfiles/sprintboard/server.js

## Setup

1. `gh auth login` (if not already authenticated)
2. `acli jira auth login`
3. Until acli is authenticated, the Jira lane shows a per-source error and the GitHub lanes work normally.
4. `cp ~/dotfiles/sprintboard/config.example.json ~/.sprintboard.json` and edit
   (`SPRINTBOARD_CONFIG` overrides the path)

No credentials are stored — auth lives entirely in the CLIs.

## State

Mutable state lives in `~/.sprintboard-state.json` (`SPRINTBOARD_STATE`
overrides the path). It sits in `$HOME` beside the config rather than in the
repo, is machine-local, and is never committed. It holds the hide and unhide
lists, the last error-free board payload, the timestamp of the one-time
localStorage import, and your reminder notes (including soft-deleted ones).

- The file is rewritten after every board fetch, every hide click, and every
  note edit. If the write fails the server logs a warning and carries on with
  in-memory state — persistence never takes the board down.
- A file that will not parse is moved aside to `~/.sprintboard-state.json.corrupt`
  and the server starts from empty state. Hide lists are your data, so nothing
  is deleted.
- Only error-free fetches overwrite the saved payload, so a degraded fetch
  cannot clobber the last good snapshot. The bar is every error and every
  warning, so a source that warns on each fetch — a repo with more than a
  hundred open pull requests tripping the truncation warning, or a dead entry
  in `repoPaths` — stops the snapshot from ever updating, and startup
  rehydration keeps serving the last wholly clean fetch.
- On startup that snapshot seeds the cache, so the board paints the last
  known state immediately instead of waiting on `gh` and `acli`. The page
  loads the cached copy first, then a normal load refreshes it; the header
  reads `fetched … (stale)` while the copy on screen is older than
  `cacheSeconds`.

Endpoints behind this state:

- `POST /api/hide`, `POST /api/unhide` — body `{ "key": "..." }`, answering
  with the updated `{ hidden, unhidden }` lists, or 404 when the key is not
  on the board.
- `POST /api/migrate-hidden` — one-time import of a browser's legacy
  localStorage lists. It runs only while the `migratedAt` stamp is unset and
  both lists are still empty, so a stale browser cannot resurrect entries
  unhidden since.
- `POST /api/notes` (create; body `{ "title": "...", "details": "...", "stage": "todo" }`),
  `POST /api/notes/update` (body: `id` plus any of `title`/`details`/`stage`),
  `POST /api/notes/delete` (body `{ "id": "..." }`) — all answer with the live
  notes list; 400 on invalid input, 404 on an unknown id.
- `GET /api/board?stale=1` — the cached payload at any age, flagged `stale`
  when older than `cacheSeconds`. It never fetches, and 404s when nothing is
  cached.

## Stages

The board is a kanban: four columns, each item appears exactly once.

- Todo → In Progress → In Review → QA (right-most; QA also holds
  merge-ready PRs)
- Jira work items place by status. Common names map automatically
  (To Do/Todo, In Progress, Review/In Review, QA/Testable); add a top-level
  `stageMap` in `~/.sprintboard.json` (e.g. `{"Blocked": "in-progress"}`)
  for anything else. Unmapped statuses land in In Progress with an
  `unknown status` badge.
- A PR mapped to one of my tickets renders inside that ticket's card and
  follows the ticket. Other PRs place by their own state: draft → In
  Progress; mergeable with CI not failing → QA; else In Review.
- Former columns are now badges: failing CI, changes requested, approved
  (green), and a `needs my review` marker that also sorts those cards to
  the top of their column.

Ticket mapping runs backwards from the PRs. Every key matching the configured
project's prefix in a PR branch name or title is collected — keys belonging to
other projects are dropped — and exactly those keys are fetched with a
`key in (...)` query, chunked at 50 keys per call, so a PR referencing a
long-untouched ticket still gets its badge no matter how large the project
backlog is. A PR maps only on an exact match against the returned keys. If
the key query fails, the board falls back to the older bulk project query
(capped at 100 tickets) and says so; only that fallback can report
`ticket query cap reached`.

## Actions

Each card offers buttons for the actions viable for that item's state. You
always pick — nothing launches automatically. Define actions in
`~/.sprintboard.json` (defining any replaces the built-in catch-all):

    { "name": "fix-comments",
      "match": { "type": "pr", "reviewDecision": "CHANGES_REQUESTED" },
      "prompt": "/fix-pr-comments {key}",
      "cwd": "~/code/infra" }

Match semantics: every key must be satisfied; scalar = equality, array =
one-of; a field the item lacks never matches; `match: {}` matches
everything. A match may also be an ARRAY of objects — the action is viable
if any one matches. Matching controls which buttons appear on the card;
every configured action stays launchable from the card's `⋯` overflow menu
regardless (you always pick — nothing launches automatically).

`{placeholder}` in `prompt` expands from any item field. Every placeholder
must resolve to a non-empty value or the launch fails with an error on the
card. Shared fields: `lanes`, `stage` (todo / in-progress / in-review /
qa), `source`. PR fields: `key`, `type`, `repo`, `number`, `title`, `url`,
`updatedAt`, `isDraft`, `mine`, `approvedByMe`, `ciFailing`,
`needsMyReview`, `ticketRef` (the mapped ticket's key, or `none`); `ci`,
`reviewDecision`, `mergeable`, `author`, `headRefName`, `latestReviews`
when the data source provides them, and `ticketKey`/`ticketStatus` only
when mapped to a ticket. Jira fields:
`key`, `type`, `title`, `status`, `priority`, `issuetype`, `assignee`,
`unclaimed`, `claimedByMe`, `url`.

## Hiding items

Cards can be hidden two ways; both land in a collapsed per-lane
`N hidden` group where they stay expandable and unhide-able.

- **Manually**: the `✕` on a PR card. Hides are stored server-side in the
  state file, so they are per machine rather than per browser and survive a
  restart. They are pruned once the PR stops appearing on the board, though
  never on a fetch that reported errors — a partial feed must not wipe the
  list.
- **By config**: a top-level `hide` key — an array of match objects with
  the same semantics as action `match`, evaluated after derived fields
  exist, so anything listed above is usable:

      "hide": [
        { "mine": false, "isDraft": true },
        { "author": ["dependabot", "renovate"] }
      ]

  An empty or absent `hide` hides nothing. Unhiding a config-hidden card
  stores an override in the state file; its `✕` removes the override so the
  rule applies again.

Bot author logins are normalized across gh's two spellings
(`dependabot[bot]` and `app/dependabot` both match `"dependabot"`).

Both lists used to live in the browser's localStorage. The first page load
after upgrading imports whatever is there into the state file and clears the
browser copy; the import happens once and never again.

## Reminder notes

Personal reminders that belong to no tracker. The `+` in a column header
creates a note in that column; each note is its own card (sticky-note tint)
pinned above the tracker cards, newest first. `✎` edits title and details,
`‹`/`›` move it one column at a time, `✕` deletes after confirmation.

Notes live in the state file, so they are machine-local like the hide lists.
Deleting is soft: the note keeps a `deletedAt` tombstone in
`~/.sprintboard-state.json` and disappears from the board. There is no
undelete button — to resurrect one, edit the file and blank its `deletedAt`.

## Launching sessions

An action button opens a detached tmux window (session `sprintboard`, kept
separate from `tmclaude`'s `mainsession`) running `claude` primed with the
action's prompt.
Working directory: action `cwd` if set, else `sources.github.repoPaths` for
PR items, else `launch.defaultCwd`. The sessions panel tails the pane and
shows the `tmux attach` command.

## Tests

    node --test ~/dotfiles/sprintboard/test/*.test.js
