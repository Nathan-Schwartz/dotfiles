# dotfiles

<!-- vim-markdown-toc GFM -->

* [Overview](#overview)
* [Setting up](#setting-up)
* [Tearing down](#tearing-down)
* [Feature tour](#feature-tour)
  * [Vim](#vim)
  * [Tmux](#tmux)
  * [Bash](#bash)
  * [Scripts](#scripts)
  * [Git](#git)
    * [Working with git submodules](#working-with-git-submodules)
    * [Install additional plugins with:](#install-additional-plugins-with)
    * [Update all submodules with:](#update-all-submodules-with)
    * [Update one submodule](#update-one-submodule)

<!-- vim-markdown-toc -->


## Overview
- Repo primarily concerns itself with vim, bash, git, and tmux on Mac OSX using iTerm2
- GNU `stow` is used to manage the symlinks and installation.
- Packages can be installed using `install.sh`, which should work on mac or linux
- Other dependencies, such as vim plugins, are managed using git submodules


## Setting up
1. Run the following to set up symlinks:
```bash
# Clone repo and all submodules
git clone --recursive https://github.com/Nathan-Schwartz/dotfiles.git ~/dotfiles

cd ~/dotfiles

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
- install.sh: idempotent script which will:
  - optionally install any available OSX updates
  - install (or update if already installed): brew, n, Node.js LTS, global npm packages, pip packages, and brew formulae
- configure-macosx.sh: Set some OS defaults (inpsired by [mathiasbynens dotfiles](https://github.com/mathiasbynens/dotfiles/blob/main/.macos))

### Git
- My approach to .gitconfig is inspired by [nicksp's dotfiles](https://github.com/nicksp/dotfiles).
- I have a global gitignore and various git aliases

#### Working with git submodules
Documented here for my convenience.

#### Install additional plugins with:
```bash
git submodule add -f https://github.com/foo/bar.git ./vim/.vim/bundle/bar
```

#### Update all submodules with:
```bash
git submodule foreach --recursive git pull --rebase origin master
```

#### Update one submodule
```bash
cd mySubmodule
git pull --rebase origin master
```

