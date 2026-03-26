![Build](https://github.com/Nathan-Schwartz/dotfiles/actions/workflows/ci.yml/badge.svg)

# dotfiles

- Configurations and workflows for vim, bash, git, ghostty, and tmux
- Tmux and Vim plugins are included as git submodules, but other deps are installed using `scripts/install.sh`
- Currently in use on macOS, CentOS, and Debian (CI runs on Ubuntu, Rocky Linux, and macOS)

<!-- vim-markdown-toc GFM -->
# Outline
- [Setting up](#setting-up)
- [Tearing down](#tearing-down)
- [Feature tour](#feature-tour)
  - [Vim](#vim)
  - [Tmux](#tmux)
  - [Bash](#bash)
  - [Scripts](#scripts)
  - [Git](#git)
  - [Claude Code](#claude-code)
<!-- vim-markdown-toc -->



## Setting up

1. Run the following to set up symlinks:

```bash
# Clone repo and all submodules
git clone https://github.com/Nathan-Schwartz/dotfiles.git ~/dotfiles
cd ~/dotfiles
git submodule update --force --recursive --init --remote

# Install stow however you like.
# The install script (./scripts/install.sh) will install stow but also many other things.

# Set up symlinks
stow vim bash git ghostty mise tmux claude
```

2. To identify yourself with git, create a `~/.gitconfig.local` with the following structure:

```
[user]
  name = Replace Me
  email = replaceme@example.com
```

## Tearing down

To disable configs without removing the repo

```bash
# remove symlinks
stow --delete vim bash git ghostty mise tmux claude
```

Removing dependencies is distro specific.

## Feature tour

### Vim

- File Navigation
  - Fuzzy file search with CtrlP (using ripgrep)
  - Project search with Ack.vim (using ripgrep)
  - Browse directories with NERDTree
- Integrations
  - linter, typecheck, autocomplete, and autofix support with ALE
  - Seamless navigation between vim windows and tmux panes (vim-tmux-navigator)
- Editing
  - Multi-cursor editing with vim-multi-cursor
  - camelcase support, persistent undo, repeat, vim-surround, and more
- UI
  - Quick access to MRU files & sessions on startup with vim-startify
  - Solarized theme, lightline, polyglot syntax highlighting, inertia scroll

### Tmux

- Vi-style keybindings, Solarized dark theme, session resurrection
- Seamless navigation between vim splits and tmux panes (vim-tmux-navigator)
- Claude Code integration: per-window status indicators (●/○/?) and an interactive session dashboard
- Scratch terminal popup and `tmclaude` helper for quick Claude windows

### Bash

- aliases to quickly edit config files
- sets readline to vi mode and shows vi-mode in prompt.
- To support computer specific configs, the first thing `.bash_profile` will do is source `~/.env`, and the last thing is to source `~/.bash_profile.local`

### Scripts

- install.sh: idempotent script which will install the core elements of my toolchain
  - Packages include: python, stow, bash, vim, and tree (via OS packages); node, ripgrep, delta, biome, and more (via mise); linters (via pipx)
  - optionally install any available OS updates
  - Uses Brew on mac, and on linux distros it will use apt or yum if available
  - Automatically commits dependency upgrades (mise tools and vim plugin submodules) in two steps: a pre-upgrade snapshot and a post-upgrade commit. Set `SKIP_COMMITS=true` to disable (defaults to skipping in CI).
- test.sh: Runs linters against dotfiles

### Git

- My approach to .gitconfig is inspired by [nicksp's dotfiles](https://github.com/nicksp/dotfiles).
- I have a global gitignore and various git aliases

### Claude Code

The `claude/` stow module provides a structured AI development workflow built on composable skills, epistemic classification, and a personal knowledge management (PKM) system.

#### Skill Workflow

The workflow is a progression of formalization
```
intuition → clarity → plan → tickets → code implementation
```

Skills help move along this spectrum. Each transition increases structure and commitment. Not every step is required — enter wherever your starting point is, exit whenever you have what you need. Implementation planning and execution support multiple levels of supervision.

| Transition | Skill | Supervision | Input | Output |
|---|---|---|---|---|
| intuition → clarity | `/brainstorm` | interactive | fuzzy idea, spidey sense | understanding, defined problem |
| clarity → plan | `/brainstorm` (planning) | interactive | defined problem + approach | `.synth.md` plan via `/to-pkm` |
| plan → tickets | `/plan-to-tk` | interactive or autonomous | plan file or `.synth.md` | tk tickets with dependencies |
| tickets → code | `/execute` | interactive | tk tickets tagged `planned` | committed code |
| tickets → code | ralph | autonomous | tk tickets tagged `planned` | committed code |

`/to-pkm` is a general knowledge capture tool which generates files according to my PKM definitions.

`/tk-triage` audits stalled work — surfaces abandoned and in-progress tickets, reads ralph execution logs, classifies failure modes, and helps decide next steps.

#### Personal Knowledge Management (PKM)

Knowledge is captured in files with compound extensions which declare their type and verification cost.

| Type | Extension | Contents | Verification cost |
|---|---|---|---|
| **ref** | `.ref.md` | External facts, tool behaviors, source summaries | Low — every claim cites a verifiable source |
| **synth** | `.synth.md` | Analysis, decisions, designs, proposals | High — reasoning must be evaluated |
| **temp** | `.temp.md` | Questions, half-formed ideas, scratch notes | None |
| **index** | `.index.md` | Navigation and cross-references | None — no original content |

Separating facts from analysis is the core value proposition. This practice keeps individual files small and focused — easier to fact-check, cheaper to load into AI context, and less prone to polluting AI context.

All PKM files have enforced frontmatter schemas validated by a PostToolUse hook. PKM directories are indexed by [qmd](https://github.com/tobi/qmd) for keyword and semantic search across sessions.

#### Epistemic Classification

My configs do their best to ensure that every claim Claude produces is classified by how it can be verified:

- **Verified** — cites evidence the reader can confirm in one step (file:line, URL, command output)
- **Inferred** — states evidence, conclusion, and the reasoning connecting them
- **Guess** — explicitly marked as unverified

