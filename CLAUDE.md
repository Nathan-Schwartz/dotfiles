# CLAUDE.md

## Project Overview

Personal dotfiles repo managing configs for bash, vim, git, and ghostty via GNU Stow symlinks. Currently in use on macOS, CentOS, and Debian. CI runs on Ubuntu, Rocky Linux, and macOS.

## Architecture

### Stow Modules

Each top-level directory is a stow module. Running `stow <module>` symlinks its contents into `$HOME`. Current modules: `bash`, `vim`, `git`, `ghostty`, `mise`, `tmux`, `claude`. Any tool that requires configuration is a candidate for a new module.

New vim plugins must be added as git submodules under `vim/.vim/bundle/` and are loaded via Pathogen. All git submodules (including vim plugins) are part of the dependency upgrade commit flow in `install.sh` — the `upgrade_dependencies` function checks `mise/.tool-versions`, `vim/.vim/bundle`, and `vendor/ticket` for unstaged changes before and after upgrading. Any new submodule must be included in that flow.

### Vendor Directory

`vendor/` contains third-party tools managed as git submodules or local scripts:
- `vendor/ticket/` — git submodule for [tk](https://github.com/Nathan-Schwartz/ticket), a bash-based task manager

### Key Files

- `scripts/install.sh` — Idempotent install script (brew/apt/yum + mise + python + dependency upgrades + qmd PKM collection sync)
- `mise/.tool-versions` — Pinned versions for mise-managed dev tools
- `test.sh` — Linters and assertions (yamllint, proselint, vint, shellcheck, jq)
- `.github/workflows/ci.yml` — GitHub Actions CI (ubuntu + rocky linux + mac)
- `bash/.bash_profile` — Shell entry point; sources `~/.env` first, `~/.bash_profile.local` last
- `bash/.bash/functions.sh` — Shared helpers (`command_exists`, `missing_command`, `assert`)
- `scripts/pkm-integrity-hook.sh` — PostToolUse hook: validates frontmatter schemas, triggers qmd index updates
- `scripts/qmd-sync.sh` — Discovers PKM directories and registers them as qmd collections
- `scripts/generate-mocs.py` — Generates Maps of Content (`.index.md`) for PKM directories
- `scripts/claude-permission-audit.py` — Parses `~/.claude/projects/` JSONL history for tool approval/denial patterns and recommends allowlist additions
- `claude/.claude/block-chained-bash.js` — PreToolUse hook: rejects Bash commands with 3+ chained statements or `echo` banners
- `claude/.claude/statusline.sh` — Claude Code statusline (session info, context window, rate limits, cost)
- `sprintboard/server.js` — Personal attention board webapp (Jira + GitHub lanes, tmux Claude-session launcher) on localhost:1337

### Override Pattern

Machine-specific config goes in files that are NOT checked in:
- `~/.env` — sourced first in `.bash_profile`
- `~/.bash_profile.local` — sourced last in `.bash_profile`
- `~/.gitconfig.local` — included by `.gitconfig` (name/email go here)
- `~/.gitconfig.mac` — macOS-specific git settings (credential helper)

## Platform Support

All three must be supported: **macOS**, **Debian/Ubuntu**, **RedHat/CentOS**.

Both **Intel and Apple Silicon** architectures must work. Key difference: Homebrew lives at `/opt/homebrew` (Apple Silicon) vs `/usr/local` (Intel). The `.bash_profile` handles both paths.

Platform detection uses `$OSTYPE` (`darwin*` = mac) and checks for `apt`/`yum` on Linux.

## Shell Conventions

- Shebang: `#!/usr/bin/env bash`
- Use `set -e` in scripts
- Helper functions are `export -f`'d for use in subshells
- Use `command_exists` / `missing_command` (from `functions.sh`) for feature detection
- Shellcheck linting at warning severity; disable rules inline with `# shellcheck disable=SCXXXX`
- Format with shfmt

## Testing

Run `./test.sh` after changes. It runs:
- `yamllint` on YAML files
- `proselint` on README.md
- `vint` on `.vimrc`
- `shellcheck` on all shell scripts
- `jq` validation on JSON files
- Assertions that core commands exist (node, python3, bash, vim, rg, mise, delta, biome, stow, shfmt, jq, jc, tree, pipx, tk)

## Package Management

**Prefer mise** for any new tool. If mise has a registry entry (check `mise registry` or the [registry](https://github.com/jdx/mise/tree/main/registry)), add it to `mise/.tool-versions` with a pinned version instead of installing via brew/apt/yum/pipx. Fall back to OS packages only for things mise can't manage (e.g. bash, vim, stow, tree) and to pipx for Python-only CLI tools without a mise backend.

- **OS packages**: brew (mac), apt (debian), yum (redhat) — only for tools mise can't manage
- **Dev tools**: managed by mise via `~/.tool-versions` (node, ripgrep, delta, biome, jq, shellcheck, shfmt, jc, yq, qmd)
- **Python CLI tools**: installed via `pipx` (never raw pip)
- **npm globals**: none (use project-local tooling instead)

## install.sh Environment Variables

- `SKIP_OS_UPDATE` — Skip OS-level updates (macOS softwareupdate, apt/yum upgrade). Default: `false`.
- `SKIP_COMMITS` — Skip the automatic pre-upgrade and post-upgrade commits. Defaults to `CI` env var (so commits are skipped in CI automatically). Set `SKIP_COMMITS=true` for non-git environments or when commits are unwanted.
- `DOTFILES_DIR` — Path to the dotfiles repo. Defaults to `~/dotfiles`. Only needed for environments where the repo isn't at the default location (e.g. CI runners). Other locations are not explicitly supported.

## CI

GitHub Actions runs on every push/PR to master and daily at midnight. Three jobs: `build-ubuntu`, `build-redhat` (Rocky Linux 9 container), and `build-mac`. All run `install.sh` then `test.sh`.

## Vim Features

Leader is `<Space>`. Plugins are loaded via Pathogen from `vim/.vim/bundle/`.

### Plugins

- **ALE** — linting, autofixing, autocomplete, go-to-definition, hover, rename, find references, code actions
- **CtrlP** — fuzzy file finder (backed by ripgrep)
- **Ack.vim** — project-wide search (backed by ripgrep via `:Search` / `:Rg` / `:Ag`, searches from git root)
- **NERDTree** — file browser (`<C-b>` to toggle)
- **vim-fugitive** — git commands and branch name in statusline
- **vim-gitgutter** — git diff signs in the gutter
- **vim-commentary** — toggle comments with `gc`
- **vim-abolish** — word-case coercion (`crs` snake, `crc` camel, `crm` mixed, etc.)
- **vim-surround** — add/change/delete surrounding chars
- **vim-repeat** — `.` repeat for plugin mappings
- **CamelCaseMotion** — `w`, `b`, `e` respect camelCase/snake_case boundaries
- **lightline** — statusline with solarized theme, branch, and relative filepath
- **vim-startify** — MRU files and session management on startup
- **vim-polyglot** — syntax highlighting for many languages
- **vim-tmux-navigator** — seamless navigation between vim splits and tmux panes
- **comfortable-motion** — inertia scrolling (`<C-d>`, `<C-u>`)

### Key Mappings

- `<leader>af` — ALE autofix
- `<leader>an` / `<leader>ap` — next/previous ALE error
- `<leader>d` — go to definition
- `<leader>h` — hover info
- `<leader>r` — rename symbol
- `<leader>cf` — code action
- `<leader>f` — find references
- `<leader>n` — clear search highlight

### Custom Functions

- **Git conflict resolution**: `<leader>top` / `<leader>bot` — keep top or bottom side of a merge conflict
- **JS helpers**: `<leader>imp` (import), `<leader>req` (require), `<leader>log` (console.log), `<leader>js` (JSON.stringify) — generates boilerplate from word under cursor
- **Visual case conversion**: `<leader>cc` (camelCase), `<leader>cm` (MixedCase), `<leader>c_` (snake_case), `<leader>cu` (UPPER_CASE), `<leader>c-` (dash-case), `<leader>c.` (dot.case), `<leader>ct` (Title Case), `<leader>c<space>` (space case)
- **Visual search**: `<leader>/` — search for highlighted text
- **Visual repeat**: `<leader>.` — apply last operation to selected lines; `<leader>o` — apply macro "o" to selected lines
- **OpenQFTabs**: opens all quickfix results in separate tabs
- `<leader>gf` — follow JS import to source file in new tab
- `<leader>=` — re-indent entire file
- `<leader>rel` — reload vimrc
- `<leader>p` — clear CtrlP caches

### Other Behaviors

- Per-project `.vimrc` support (`set exrc`)
- Persistent undo across sessions
- Typo-tolerant commands (`:W`, `:Wq`, `:Q`, etc.)
- Git conflict markers highlighted in red
- System clipboard integration
- `gf` opens file in new tab (overridden default)
- `j`/`k` navigate visual lines (respect wrapping)

## Tmux

Prefix is `Ctrl-Space`. Key bindings use vi-style navigation. Solarized dark theme matches vim.

### Bash Helpers

- `tma` — start or resume the main tmux session
- `tmk` — kill all tmux sessions
- `tmc` / `tmclaude [name]` — open Claude Code in a named tmux window (defined in `bash/.bash/aliases.sh`). Works from inside or outside tmux, and from popups.

### Key Bindings

- `<prefix> Enter` — scratch terminal popup (80%, exits on shell exit)
- `<prefix> w` — built-in window/session tree picker
- `<prefix> Tab` — toggle to last active window
- `<prefix> v` / `<prefix> s` — split vertical / horizontal
- `Ctrl h/j/k/l` — navigate panes (shared with vim-tmux-navigator)
- `Alt h/j/k/l` — resize panes

## Sprintboard

`sprintboard/` is a zero-dependency Node webapp (localhost:1337) that aggregates
Jira (acli) and GitHub (gh) into attention lanes and launches context-primed
claude tmux windows. Config lives in `~/.sprintboard.json` (not checked in —
override pattern). Tests run via `node --test sprintboard/test/*.test.js` (wired into
`test.sh`). See `sprintboard/README.md`.

## Claude Code (`claude/` stow module)

The `claude/` stow module symlinks into `~/.claude/` and provides the base Claude Code configuration. Two layers govern behavior:

### Development Pipeline

Two orthogonal pipelines. The implementation pipeline ships code; the knowledge pipeline
accumulates what is known. They feed each other but neither is a stage of the other — a
research question can arise mid-implementation, and a captured finding can sit unused for
months before it informs a plan.

#### Implementation — from fuzzy intuition to shipped code

```
intuition → clarity → plan → execution
```

Each transition increases structure and commitment. Not every step is required — enter wherever your starting point is, exit whenever you have what you need.

| Transition | Skill | Input | Output |
|---|---|---|---|
| intuition → clarity | `/brainstorm` | fuzzy idea, spidey sense | understanding, defined problem |
| clarity → plan | `/brainstorm` (planning) | defined problem + approach | structured plan (goal, scope, approach, risks, verification) |
| plan → execution | `/transition-to-superpowers` | converged conversation | handoff to the superpowers plugin |

**Execution moved to the superpowers plugin.** The locally-built execution half —
`/plan-to-tk`, `/execute`, `/tk-triage`, the `tk` skill, `references/core-execute.md`, and
the ralph autonomous executor — was replaced, not abandoned: superpowers supplies planning,
plan execution, subagent-driven development, and TDD. `tk` the tool is still installed and
allow-listed, but nothing in the Claude config drives it.

#### Knowledge — from open question to trusted reference

```
question → findings → captured → audited
```

| Transition | Skill | Input | Output |
|---|---|---|---|
| question → findings | `epistemic-explore` agent | delegation prompt | V/I/G-classified `.ref.md` in session scratch |
| anything → captured | `/to-pkm` | conversation context, session scratch | `.ref.md` / `.synth.md` / `.temp.md` + session `.index.md` |
| captured → trusted | `/pkm-audit` | a `pkm/` directory | per-claim dispositions recorded as a `.synth.md` |

`/to-pkm` has no fixed position on the implementation spectrum — it captures at any point. Brainstorm output, research findings, review conclusions, execution learnings: whatever is worth persisting.

Two further skills operate on the conversation itself rather than advancing either pipeline: `/discussion` (stable IDs and full-list repaints for multi-item threads) and `/disproof-review` (a review contract where severity carries evidence like any other claim).

#### Design Principles

1. **Progressive formalization.** Both pipelines move from loose to structured. Each step refines, never regresses. Epistemic rigor scales with commitment: brainstorm tolerates Guesses, plans require Verified claims in the approach, refs must be checkable in one step.

2. **Flexible input, strict output.** Each skill accepts messy input and produces structured output (Postel's law). A brainstorm synth, a research folder, or a bare conversation can all feed `/to-pkm`. But every file it writes meets the same contract: correct compound extension, schema-valid frontmatter, and claims classified.

3. **Session-independent.** Both pipelines are designed to span multiple sessions. Artifacts (`.synth.md`, `.ref.md`) are the durable handoff mechanism, not conversation context. Brainstorm today, capture next week, audit next month.

4. **PKM as interchange.** Structured artifacts are how knowledge crosses between the two pipelines, and how it survives between sessions. `.synth.md` files carry plans and analysis, `.ref.md` files carry research. All are searchable via qmd.

5. **Shared core, separate wrappers.** Where multiple skills need the same behavior, it's defined once as a reference doc and injected via `!cat` — `epistemic-reference.md` and `pkm-schema-reference.md` are consumed by several skills and by the `epistemic-explore` agent. Editing the reference changes every consumer at once.

6. **Own the parts that are ours.** Where a plugin does a job well, hand off to it rather than maintaining a parallel implementation. What stays local is what encodes preferences no plugin knows: epistemic discipline, PKM schema, permission economics.

### Global CLAUDE.md

`claude/CLAUDE.md` stows to `~/CLAUDE.md` and loads in every Claude Code session. It defines:

- **Trust economics** — all interactions evaluated by verification cost, not automation savings
- **Universally applicable rules** — no guessing intent, no unverified premises, mandatory epistemic classification (V/I/G) on all claims
- **PKM system** — compound-extension files (`.ref.md`, `.synth.md`, `.temp.md`, `.index.md`) with enforced frontmatter schemas, ref-bias decomposition, and qmd semantic search integration
- **Automation policy** — prefer durable scripts over ad-hoc when a task will recur

Projects extend behavior at the project level (`<project>/.claude/settings.json` and `<project>/CLAUDE.md`).

### settings.json

Default mode is `auto`. Model is `opus[1m]` with `effortLevel: high`, `outputStyle: explanatory`. Shell is set to `/usr/local/bin/bash`. `autoCompactEnabled` is off. Enabled plugins: `superpowers`.

**Permissions (allowlist):** `tk *`, `qmd *`, `acli *`, full `git *` and `gh *`, search and inspection utilities (`find`, `rg`, `grep`, `jq`, `cat`, `head`, `tail`, `wc`, `ls`, `stat`, `file`, `tree`, `which`, `date`, `pwd`, `whoami`), `mkdir -p`, and `cat ~/.claude/references/*`. Everything else requires approval. Use `scripts/claude-permission-audit.py` to find further candidates from history rather than guessing.

**PreToolUse hook:** Every `Bash` call runs `block-chained-bash.js`, which rejects commands containing 3+ chained statements (`;`, `&&`, `||` outside quotes) or `echo` banners. The rationale is permission economics, not style: small single-purpose commands match reusable allow patterns and auto-approve, while a combined command matches nothing and forces a prompt.

**PostToolUse hook:** Every `Write|Edit` runs `pkm-integrity-hook.sh` which validates PKM frontmatter schemas and body structure, and updates the qmd keyword index for compound-extension files. The same script runs standalone as `pkm-integrity-hook.sh --lint <file-or-dir>` for the non-blocking checks (weak citations, unresolvable source paths, untagged paragraphs).

**Semantic search:** qmd is invoked via its CLI directly (no MCP server) — keeps it portable to environments with locked-down MCP server policies.

### Skills

- **`/brainstorm`** — Adaptive dialogue for shaping ideas. Posture shifts from nurturing (nascent ideas) to constructive challenge (defined problems) to full rigor (concrete approaches). Can transition into planning when the conversation converges — shifts focus from exploration to specification, enables proactive codebase research, and targets a structured plan (goal, scope, constraints, approach, risks, verification) captured as a `.synth.md` via `/to-pkm`.
- **`/to-pkm`** — Converts conversation context into PKM artifacts. Manifest-first: proposes files, waits for confirmation before writing. Discovers `epistemic-explore` scratch from this session, with a fallback tier for research folders written outside the session directory. Generates a session `.index.md`. Injects both reference docs. **Does not** check the corpus for duplicates — that is `/pkm-audit`'s job, because judging two notes redundant needs a view of the whole collection.
- **`/fix-pr-comments`** — Addresses unresolved PR review comments. User-only (`disable-model-invocation: true`). Tool-sandboxed to `Bash(gh *)` only.
- **`/explain`** — Closes the gap between what Claude knows and what the user knows: missing service context, autonomously-completed work, plan ambiguities/second-order effects, complex flows. Bare invocation opens a dialogue to locate the gap; a supplied target gets a layered explanation (mental model → structure/diagram → selective depth → boundaries → drill-downs). Terminal-first; may suggest a private artifact for rendered diagrams. User-only (`disable-model-invocation: true`).
- **`/pkm-audit`** — Audits an existing knowledge base for the defects a per-file review cannot see: composed claims spanning two source scopes, negatives asserted from inside one repo, and corpus-level duplication. Seven passes (0-6), scaled to the corpus; pass 0 is the free mechanical lint. Proposes dispositions and never merges or deletes.
- **`/discussion`** — Maintains shared state in a multi-item conversation. Mints `PREFIX-NN` IDs if the list arrived without them, then repaints the entire open-item list on every status change so dismissals are acknowledged and resolutions survive the session. Works retroactively on a conversation that has already scattered.
- **`/disproof-review`** — Review contract for reporting defects to a human. Treats severity as a claim needing evidence: every finding carries a disproof question with its source and graded outcome (Refuted / Narrowed / Intact), plus reachability recorded as actual config values rather than "behind a flag".
- **`/transition-to-superpowers`** — Hands a converged conversation off to the superpowers plugin for planning and execution. User-only (`disable-model-invocation: true`).
- **`epistemic-classification`** — Not user-invocable. Thin wrapper injecting epistemic reference for agents that need V/I/G rigor without PKM.
- **`epistemic-pkm-research`** — Not user-invocable. Injects epistemic + PKM references with behavioral guidance (ref vs synth selection, catalog avoidance, destination rules). Preloaded into `epistemic-explore`.

### Agents

- **`epistemic-explore`** — Research subagent with enforced epistemic classification. Tools: Read, Grep, Glob, Bash, Write, Edit (qmd via CLI, no MCP). Output must use V/I/G tiers plus a mandatory "Not Checked" section. Always writes findings to disk and returns both summary and path. Default destination: `<project-root>/.claude/scratch/epistemic-explore/$CLAUDE_CODE_SESSION_ID/<topic-slug>/*.ref.md` (creates `.claude/` if absent; falls back to `$PWD` outside git repos). Explicit destination overrides the default when the delegation specifies one. Scratch is session-scoped; promotion to durable PKM is a manual `mv` into a project's `pkm/` dir followed by `qmd update`.

### Reference Docs

- `references/epistemic-reference.md` — Canonical V/I/G classification definitions. Injected into skills via dynamic inclusion.
- `references/pkm-schema-reference.md` — PKM frontmatter schema reference, generated from `scripts/schemas/pkm.json` by `scripts/generate-pkm-reference.sh`. Injected into skills via dynamic inclusion. Edit the JSON, not the markdown.

Both references are consumed by `/to-pkm`, `/pkm-audit`, `epistemic-pkm-research`, and (transitively) the `epistemic-explore` agent. `~/.claude/references` is a directory-level stow symlink into this repo, so an edit here is live immediately with no restow.

## tk (Task Management)

[tk](https://github.com/Nathan-Schwartz/ticket) is a bash-based, git-native task manager with zero dependencies. Installed from `vendor/ticket/` submodule, symlinked to `~/.local/bin/tk`, and asserted by `test.sh`.

- `tk` commands are allow-listed in the base Claude Code settings
- The Claude-side integration (`/plan-to-tk`, `/execute`, `/tk-triage`, the `tk` skill, ralph) was dropped when execution moved to the superpowers plugin. The tool stands on its own; no skill drives it.
- Left behind by that move: `scripts/tk-triage-context.sh` and its allowlist entry in `claude/.claude/settings.json` no longer have a caller.

## Root .gitignore

The root `.gitignore` contains `*` — this ignores everything by default. This is intentional: it prevents stow from symlinking the entire directory and ensures only explicitly tracked files are committed. **Every new file must be added with `git add -f`** or it will be silently ignored. New files won't appear in `git status` unless force-added. This applies to new stow modules, scripts, config files, and **git submodule commit references** — everything. A submodule entry in `.gitmodules` without its commit reference force-added and committed means `git submodule update --init` has nothing to check out, resulting in an empty directory in fresh clones and CI.
