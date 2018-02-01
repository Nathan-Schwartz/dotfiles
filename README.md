# dotfiles

This repo manages most of my dotfiles. GNU `stow` is used to manage the symlinks and installation.

These instructions assume you are on a mac (only tested on high sierra), have iterm2 installed, and have brew installed.

Gitconfig strategy is borrowed from: [nicksp's dotfiles](https://github.com/nicksp/dotfiles).


### Vim
To get vim-fugitive to work you may need to run the following after cloning.
```bash
vim -u NONE -c "helptags vim-fugitive/doc" -c q
```

Don't forget to generate helptags with `:Helptags`.


### ~/.gitconfig.local
If the ~/.gitconfig.local file exists, it will be automatically included after the configurations from ~/.gitconfig, thus, allowing its content to overwrite or add to the existing git configurations.

Note: Use ~/.gitconfig.local to store sensitive information such as the git user credentials, e.g.:
```
[user]
  name = Nick Plekhanov
  email = nick@example.com
```

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
- install.sh: install brew and node, update brew and node, upgrade all packages, install some packages.
- configure-macosx.sh: Set some OS defaults.
- uninstall-node.sh: Works, but don't use it. Checked in for my convenience.

### Teardown
```bash
# remove symlinks
stow --delete vim bash git iterm
```
