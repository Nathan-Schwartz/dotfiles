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
everything. A match may also be an ARRAY of objects — the action is viable
if any one matches. Matching controls which buttons appear on the card;
every configured action stays launchable from the card's `⋯` overflow menu
regardless (you always pick — nothing launches automatically).

`{placeholder}` in `prompt` expands from any item field. Every placeholder
must resolve to a non-empty value or the launch fails with an error on the
card. Shared fields: `lanes`, `stage` (todo / in-progress / in-review /
qa), `source`. PR fields: `key`, `type`, `repo`, `number`, `title`, `url`,
`updatedAt`, `isDraft`, `mine`, `approvedByMe`, `ciFailing`,
`needsMyReview`; `ci`, `reviewDecision`, `mergeable`, `author`,
`headRefName`, `latestReviews` when the data source provides them, and
`ticketKey`/`ticketStatus` only when mapped to a ticket. Jira fields:
`key`, `type`, `title`, `status`, `priority`, `issuetype`, `assignee`,
`unclaimed`, `claimedByMe`, `url`.

## Launching sessions

An action button opens a detached tmux window (session `sprintboard`, kept
separate from `tmclaude`'s `mainsession`) running `claude` primed with the
action's prompt.
Working directory: action `cwd` if set, else `sources.github.repoPaths` for
PR items, else `launch.defaultCwd`. The sessions panel tails the pane and
shows the `tmux attach` command.

## Tests

    node --test ~/dotfiles/sprintboard/test/*.test.js
