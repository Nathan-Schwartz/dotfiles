![Build](https://github.com/Nathan-Schwartz/dotfiles/actions/workflows/ci.yml/badge.svg)

# dotfiles

- Configurations and workflows for vim, bash, git, and tmux
- Tmux and Vim plugins are included as git submodules, but other deps are installed using `scripts/install.sh`
- Currently in use on Mac OSX, Raspbian, Centos, Ubuntu, and Debian 11 (CI only runs on Ubuntu and Mac though)

<!-- vim-markdown-toc GFM -->
# Outline
- [Setting up](#setting-up)
- [Tearing down](#tearing-down)
- [Feature tour](#feature-tour)
  - [Vim](#vim)
  - [Tmux](#tmux)
  - [Bash](#bash)
  - [Scripts](#scripts)
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
stow vim bash git iterm tmux
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
stow --delete vim bash git iterm tmux
```

Removing dependencies is distro specific.

## Feature tour

### Vim

- File Navigation
  - Fuzzy file search with CtrlP (using ag)
  - Project search with Ack.vim (using ag)
  - Browse directories with NERDTree
- Integrations
  - linter, typecheck, autocomplete, and autofix support with ALE
  - Tmux panes and vim windows share key binding (vim-tmux-navigator)
- Editing
  - Multi-cursor editing with vim-multi-cursor
  - camelcase support, persistent undo, repeat, vim-surround, and more
- UI
  - Quick access to MRU files & sessions on startup with vim-startify
  - Solarized theme, lightline, polyglot syntax highlighting, inertia scroll

### Tmux

- Tmux and Tmate support for Mac and Linux
- Can resurrect tmux sessions
- Vim inspired key bindings
- Solarized dark theme to match vim

### Bash

- aliases to quickly edit config files
- sets readline to vi mode and shows vi-mode in prompt.
- To support computer specific configs, the first thing `.bash_profile` will do is source `~/.env`, and the last thing is to source `~/.bash_profile.local`

### Scripts

- install.sh: idempotent script which will install the core elements of my toolchain
  - Packages include: tmux, python, node, stow, bash, AgFn and linters
  - optionally install any available OS updates
  - Uses Brew on mac, and on linux distros it will use apt or yum if available
- test.sh: Runs linters against dotfiles

### Git

- My approach to .gitconfig is inspired by [nicksp's dotfiles](https://github.com/nicksp/dotfiles).
- I have a global gitignore and various git aliases
