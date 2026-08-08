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

- Needs my review — open PRs where my review is requested
- My open PRs — all open PRs I authored
- Changes requested / Failed CI / Mergeable — derived views of my open PRs
- Jira — open work items for the configured project + user (or custom `jql`)

## Launching sessions

Each card's ▶ button opens a detached tmux window (session `mainsession`, same
convention as `tmclaude`) running `claude` primed via `launch.promptTemplate`.
PR items use `sources.github.repoPaths` to pick the working directory. The
sessions panel tails the pane and shows the `tmux attach` command.

## Tests

    node --test ~/dotfiles/sprintboard/test/
