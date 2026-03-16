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

The `claude/` stow module symlinks into `~/.claude/` and provides the base Claude Code configuration.

- `settings.json` — Default mode is `plan`. Permissions allow `tk *` and read-only git commands. PostToolUse hook runs `pkm-integrity-hook.sh` on Write/Edit for PKM validation. MCP server configured for qmd.
- `references/epistemic-reference.md` — Canonical epistemic classification definitions (V/I/G). Injected into skills via `!`cat``.
- `references/pkm-schema-reference.md` — PKM frontmatter schema reference, generated from `scripts/schemas/pkm.json`. Injected into skills via `!`cat``.
- `skills/to-pkm/SKILL.md` — `/to-pkm` skill: converts conversation context into PKM artifacts. Injects both references.
- `skills/fix-pr-comments/SKILL.md` — `/fix-pr-comments` skill: addresses unresolved PR review comments. User-only (`disable-model-invocation: true`).
- `skills/epistemic-classification/SKILL.md` — Thin wrapper injecting epistemic reference. Not user-invocable; for agents needing epistemic rigor without PKM.
- `skills/epistemic-pkm-research/SKILL.md` — Injects both references + behavioral guidance for research. Not user-invocable; preloaded into `epistemic-explore`.
- `agents/epistemic-explore.md` — Research subagent with enforced epistemic classification. Preloads `epistemic-pkm-research` skill. Optionally persists findings as `.ref.md` artifacts.

Projects extend permissions and settings at the project level (`<project>/.claude/settings.json`).

## tk (Task Management)

[tk](https://github.com/wedow/ticket) is a bash-based, git-native task manager with zero dependencies. Installed from `vendor/ticket/` submodule, symlinked to `~/.local/bin/tk`.

- `tk` commands are allow-listed in the base Claude Code settings
- Custom plugins in `vendor/tk-plugins/`: `ticket-tag`, `ticket-untag`

## Root .gitignore

The root `.gitignore` contains `*` — this ignores everything by default. This is intentional: it prevents stow from symlinking the entire directory and ensures only explicitly tracked files are committed. **Every new file must be added with `git add -f`** or it will be silently ignored. New files won't appear in `git status` unless force-added. This applies to new stow modules, scripts, config files, and **git submodule commit references** — everything. A submodule entry in `.gitmodules` without its commit reference force-added and committed means `git submodule update --init` has nothing to check out, resulting in an empty directory in fresh clones and CI.
