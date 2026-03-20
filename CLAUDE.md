# CLAUDE.md

## Project Overview

Personal dotfiles repo managing configs for bash, vim, git, and ghostty via GNU Stow symlinks. Currently in use on macOS, CentOS, and Debian. CI runs on Ubuntu, Rocky Linux, and macOS.

## Architecture

### Stow Modules

Each top-level directory is a stow module. Running `stow <module>` symlinks its contents into `$HOME`. Current modules: `bash`, `vim`, `git`, `ghostty`, `mise`, `tmux`, `claude`. Any tool that requires configuration is a candidate for a new module.

New vim plugins must be added as git submodules under `vim/.vim/bundle/` and are loaded via Pathogen. All git submodules (including vim plugins) are part of the dependency upgrade commit flow in `install.sh` — the `upgrade_dependencies` function checks `mise/.tool-versions`, `vim/.vim/bundle`, and `vendor/ticket` for unstaged changes before and after upgrading. Any new submodule must be included in that flow.

### Vendor Directory

`vendor/` contains third-party tools managed as git submodules or local scripts:
- `vendor/ticket/` — git submodule for [tk](https://github.com/wedow/ticket), a bash-based task manager
- `vendor/tk-plugins/` — custom tk plugins (`ticket-tag`, `ticket-untag`), symlinked into `~/.local/bin/` by `install.sh`

### Key Files

- `scripts/install.sh` — Idempotent install script (brew/apt/yum + mise + python + dependency upgrades)
- `mise/.tool-versions` — Pinned versions for mise-managed dev tools
- `test.sh` — Linters and assertions (yamllint, proselint, vint, shellcheck, jq)
- `.github/workflows/ci.yml` — GitHub Actions CI (ubuntu + rocky linux + mac)
- `bash/.bash_profile` — Shell entry point; sources `~/.env` first, `~/.bash_profile.local` last
- `bash/.bash/functions.sh` — Shared helpers (`command_exists`, `missing_command`, `assert`)
- `scripts/pkm-integrity-hook.sh` — PostToolUse hook: validates frontmatter schemas, triggers qmd index updates
- `scripts/qmd-sync.sh` — Discovers PKM directories and registers them as qmd collections
- `scripts/qmd-mcp.sh` — Wrapper that launches `qmd mcp` for the Claude MCP server integration
- `scripts/generate-mocs.py` — Generates Maps of Content (`.index.md`) for PKM directories

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

## Claude Code (`claude/` stow module)

The `claude/` stow module symlinks into `~/.claude/` and provides the base Claude Code configuration. Two layers govern behavior:

### Development Pipeline

The workflow is a progression of formalization — from fuzzy intuition to concrete implementation:

```
intuition → clarity → plan → tickets → implementation
```

Skills help move along this spectrum. Each transition increases structure and commitment. Not every step is required — enter wherever your starting point is, exit whenever you have what you need. Implementation planning and execution support multiple levels of supervision.

| Transition | Skill | Supervision | Input | Output |
|---|---|---|---|---|
| intuition → clarity | `/brainstorm` | interactive | fuzzy idea, spidey sense | understanding, defined problem |
| clarity → plan | `/brainstorm` (planning) | interactive | defined problem + approach | `.synth.md` plan via `/to-pkm` |
| plan → tickets | `/plan-to-tk` | interactive or autonomous | plan file or `.synth.md` | tk tickets with dependencies |
| tickets → code | `/execute` | interactive | tk tickets tagged `planned` | committed code |
| tickets → code | ralph | autonomous | tk tickets tagged `planned` | committed code |

`/to-pkm` is not a pipeline step — it's a utility that captures knowledge at any point on the spectrum. Brainstorm output, research findings, execution learnings — whatever is worth persisting.

#### Design Principles

1. **Progressive formalization.** The pipeline moves from loose to structured. Each step refines, never regresses. Epistemic rigor scales with commitment: brainstorm tolerates Guesses, plans require Verified claims in the approach, tickets must be execution-ready.

2. **Composable with variable supervision.** Each skill works independently. Supervision is a parameter, not a separate implementation. The same core logic serves both collaborative (human-gated) and autonomous (ralph) execution.

3. **Flexible input, strict output.** Each skill accepts messy input and produces structured output (Postel's law). A brainstorm synth, a rough plan file, or a bare conversation can all feed `/plan-to-tk`. But every ticket it produces meets the same contract: tagged `planned`, sufficiently specified, ralph-ready.

4. **Session-independent.** The pipeline is designed to span multiple sessions. Artifacts (`.synth.md`, tk tickets) are the durable handoff mechanism, not conversation context. Brainstorm today, plan next week, execute next month.

5. **PKM as interchange.** Structured artifacts are how knowledge moves between steps. `.synth.md` files carry plans, `.ref.md` files carry research, tk tickets carry execution specs. All are searchable via qmd across sessions.

6. **Shared core, separate wrappers.** Where multiple skills need the same behavior (e.g., per-ticket execution), it's defined once as a reference doc. Skills and scripts are wrappers that add supervision and context.

### Global CLAUDE.md

`claude/CLAUDE.md` stows to `~/CLAUDE.md` and loads in every Claude Code session. It defines:

- **Trust economics** — all interactions evaluated by verification cost, not automation savings
- **Universally applicable rules** — no guessing intent, no unverified premises, mandatory epistemic classification (V/I/G) on all claims
- **PKM system** — compound-extension files (`.ref.md`, `.synth.md`, `.temp.md`, `.index.md`) with enforced frontmatter schemas, ref-bias decomposition, and qmd semantic search integration
- **Automation policy** — prefer durable scripts over ad-hoc when a task will recur

Projects extend behavior at the project level (`<project>/.claude/settings.json` and `<project>/CLAUDE.md`).

### settings.json

Default mode is `plan`. Model is `claude-opus-4-6` with `effortLevel: high`, `outputStyle: explanatory`. Shell is set to `/usr/local/bin/bash`.

**Permissions (allowlist):** `tk *`, read-only git (`status`, `diff`, `log`, `show`, `rev-parse`, `remote -v`), bash utilities (`which`, `pwd`, `file`, `wc`, `tree`, `ls`, `stat`), and `cat ~/.claude/references/*`. Everything else requires approval.

**PostToolUse hook:** Every `Write|Edit` runs `pkm-integrity-hook.sh` which validates PKM frontmatter schemas and updates the qmd keyword index for compound-extension files.

**MCP server:** qmd (via `scripts/qmd-mcp.sh`) provides semantic and keyword search across PKM collections.

### Skills

- **`/brainstorm`** — Adaptive dialogue for shaping ideas. Posture shifts from nurturing (nascent ideas) to constructive challenge (defined problems) to full rigor (concrete approaches). Can transition into planning when the conversation converges — shifts focus from exploration to specification, enables proactive codebase research, and targets a structured plan (goal, scope, constraints, approach, risks, verification) captured as a `.synth.md` via `/to-pkm`.
- **`/to-pkm`** — Converts conversation context into PKM artifacts. Manifest-first: proposes files, waits for confirmation before writing. Checks qmd for duplicates. Generates a session `.index.md`. Injects both reference docs.
- **`/fix-pr-comments`** — Addresses unresolved PR review comments. User-only (`disable-model-invocation: true`). Tool-sandboxed to `Bash(gh *)` only.
- **`/plan-to-tk`** — Converts a plan file into actionable tk tickets with dependencies. Accepts plain markdown or `.synth.md` (respects epistemic classifications). Researches codebase via orthogonal `epistemic-explore` agents, decomposes into tickets with verification expectations, establishes dependency graph. Supports collaborative/autonomous supervision modes. Every ticket tagged `planned` and ralph-ready.
- **`/execute`** — Interactive execution of tk tickets with human approval gates. Dispatches subagents per task using the shared core execution flow, presents results for review. Uses dynamic context injection (`!`tk ready -T planned``) for task selection. Accepts optional task ID argument.
- **`tk`** — Not user-invocable. Canonical reference for tk commands, state machine, and workflow conventions (planned gate, abandoned tag, dependency direction). Loaded automatically when tk-related work comes up.
- **`epistemic-classification`** — Not user-invocable. Thin wrapper injecting epistemic reference for agents that need V/I/G rigor without PKM.
- **`epistemic-pkm-research`** — Not user-invocable. Injects epistemic + PKM references with behavioral guidance (ref vs synth selection, qmd duplicate checking, return vs persist modes). Preloaded into `epistemic-explore`.

### Agents

- **`epistemic-explore`** — Research subagent with enforced epistemic classification. Tools: Read, Grep, Glob, Bash, Write, Edit. Has qmd MCP access. Output must use V/I/G tiers plus a mandatory "Not Checked" section. Two modes: return findings to caller (default) or persist as `.ref.md` artifacts when instructed.

### Reference Docs

- `references/epistemic-reference.md` — Canonical V/I/G classification definitions. Injected into skills via dynamic inclusion.
- `references/pkm-schema-reference.md` — PKM frontmatter schema reference, generated from `scripts/schemas/pkm.json`. Injected into skills via dynamic inclusion.
- `references/core-execute.md` — Shared per-ticket execution flow (load context, do work with TDD lean, self-check, report). Referenced by `/execute` skill and ralph's prompt.

## tk (Task Management)

[tk](https://github.com/wedow/ticket) is a bash-based, git-native task manager with zero dependencies. Installed from `vendor/ticket/` submodule, symlinked to `~/.local/bin/tk`.

- `tk` commands are allow-listed in the base Claude Code settings
- Custom plugins in `vendor/tk-plugins/`: `ticket-tag`, `ticket-untag`

## Root .gitignore

The root `.gitignore` contains `*` — this ignores everything by default. This is intentional: it prevents stow from symlinking the entire directory and ensures only explicitly tracked files are committed. **Every new file must be added with `git add -f`** or it will be silently ignored. New files won't appear in `git status` unless force-added. This applies to new stow modules, scripts, config files, and **git submodule commit references** — everything. A submodule entry in `.gitmodules` without its commit reference force-added and committed means `git submodule update --init` has nothing to check out, resulting in an empty directory in fresh clones and CI.
