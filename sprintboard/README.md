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

## Lanes

- Needs my review (`needs-review`) — open PRs where my review is requested
- My open PRs (`my-prs`) — open PRs I authored (filtered to `repoPaths` repos
  when any are configured; empty `repoPaths` shows all)
- Changes requested (`changes-requested`) / Failed CI (`failed-ci`) / Mergeable
  (`mergeable`) — derived views of my open PRs
- Team PRs (`team-prs`) — every other open PR in the `repoPaths` repos
  (anything not already on the board), fetched in one batched `gh pr list`
  call per repo (up to 100 PRs each; a board error notes any repo that hits
  the cap). Each PR maps to a Jira ticket when the branch name or title
  contains the key of an open ticket in the configured `project` (team-wide
  lookup, independent of `jql`). PRs without a matching key render
  unmapped, and if the ticket lookup fails (e.g. `acli` unauthenticated)
  the lane still renders with a board error noting mapping is unavailable.
- Jira (`jira`) — open work items for the configured project + user (or
  custom `jql`)

## Actions

Each card offers buttons for the actions viable for that item's state. You
always pick — nothing launches automatically. Define actions in
`~/.sprintboard.json` (defining any replaces the built-in catch-all):

    { "name": "fix-comments",
      "match": { "type": "pr", "reviewDecision": "CHANGES_REQUESTED" },
      "prompt": "/fix-pr-comments {url}",
      "cwd": "~/code/infra" }

Match semantics: every key must be satisfied; scalar = equality, array =
one-of; a field the item lacks never matches; `match: {}` matches
everything. `lanes` (see above) is matchable, e.g. `{ "lanes": "failed-ci" }`.

`{placeholder}` in `prompt` expands from any item field. Every placeholder
must resolve to a non-empty value or the launch fails with an error on the
card. Fields by type — pr: `key`, `type`, `repo`, `number`, `title`, `url`,
`updatedAt`, `isDraft`, `lanes` on every PR; `ci`, `reviewDecision`,
`mergeable` on authored-PR items (lanes `my-prs` / `changes-requested`
/ `failed-ci` / `mergeable`) and on `team-prs` items, absent on
`needs-review` items; `team-prs` items also carry `author`, `headRefName`,
and `latestReviews`, plus `ticketKey` and `ticketStatus` only when mapped
to a ticket; jira: `key`, `type`, `title`, `status`, `priority`,
`issuetype`, `url`, `lanes`.

## Launching sessions

An action button opens a detached tmux window (session `sprintboard`, kept
separate from `tmclaude`'s `mainsession`) running `claude` primed with the
action's prompt.
Working directory: action `cwd` if set, else `sources.github.repoPaths` for
PR items, else `launch.defaultCwd`. The sessions panel tails the pane and
shows the `tmux attach` command.

## Tests

    node --test ~/dotfiles/sprintboard/test/*.test.js
