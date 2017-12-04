# dotfiles

This repo manages most of my dotfiles. GNU `stow` is used to manage the symlinks and installation.

These instructions assume you are on a mac (only tested on high sierra), have iterm2 installed, and have brew installed.

## Replication
```bash
# clone repo and all submodules to home directory
git clone --recursive https://github.com/Nathan-Schwartz/dotfiles.git ~/dotfiles

cd ~/dotfiles

brew install stow

# Use configurations, this can be done individually by folder.
stow vim bash git iterm
```

### Scripts
- install-brew.sh: install brew, update brew, upgrade all packages, install some packages.
- install-npm.sh: install n and use it to get latest lts release. Then install some global packages.
- configure-macosx.sh: Set some OS defaults.
- uninstall-node.sh: Works, but don't use it. Checked in for my convenience.

### Teardown
```bash
# remove symlinks
stow --delete vim bash git iterm
```
