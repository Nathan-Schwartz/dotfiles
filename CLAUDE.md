# CLAUDE.md

## Project Overview

Personal dotfiles repo managing configs for bash, vim, git, and iterm via GNU Stow symlinks. Currently in use on macOS, Raspbian, CentOS, Ubuntu, and Debian. CI runs on Ubuntu and macOS.

## Architecture

### Stow Modules

Each top-level directory is a stow module. Running `stow <module>` symlinks its contents into `$HOME`. Current modules: `bash`, `vim`, `git`, `iterm`. More may be added (tmux, claude configs, etc.) — any tool that requires configuration is a candidate.

New vim plugins must be added as git submodules under `vim/.vim/bundle/` and are loaded via Pathogen.

### Key Files

- `scripts/install.sh` — Idempotent install script (brew/apt/yum + node + python)
- `test.sh` — Linters and assertions (yamllint, proselint, vint, shellcheck, jq)
- `.github/workflows/ci.yml` — GitHub Actions CI (ubuntu + mac)
- `bash/.bash_profile` — Shell entry point; sources `~/.env` first, `~/.bash_profile.local` last
- `bash/.bash/functions.sh` — Shared helpers (`command_exists`, `missing_command`, `assert`)

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
- Assertions that core commands exist (node, python3, bash, vim, ag, stow)

## Package Management

- **OS packages**: brew (mac), apt (debian), yum (redhat)
- **Node**: managed by `n`, targeting LTS (migrating to asdf soon)
- **Python CLI tools**: installed via `pipx` (never raw pip)
- **npm globals**: none (removed yarn, eslint, prettier, prettier-eslint — use project-local tooling instead)

## CI

GitHub Actions runs on every push/PR to master and daily at midnight. Two jobs: `build-ubuntu` and `build-mac`. Both run `install.sh` then `test.sh`.

## Root .gitignore

The root `.gitignore` contains `*` — this is intentional. It prevents stow from symlinking the entire directory and ensures only explicitly tracked files are committed. Use `git add -f` when adding new files.
