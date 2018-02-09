# dotfiles

This repo manages most of my dotfiles. GNU `stow` is used to manage the symlinks and installation.

These instructions assume you are on a mac (only tested on high sierra) and have iterm2 installed.


### Getting started
To start using my dotfiles on a new computer run the following:
```bash
# clone repo and all submodules to home directory
git clone --recursive https://github.com/Nathan-Schwartz/dotfiles.git ~/dotfiles

cd ~/dotfiles

brew install stow

# Specify configurations to by used
stow vim bash git
```


#### Vim

To get vim-fugitive to work you may need to run the following after cloning.
```bash
vim -u NONE -c "helptags vim-fugitive/doc" -c q
```

Don't forget to generate helptags with `:Helptags`.


#### Git

Gitconfig strategy is borrowed from: [nicksp's dotfiles](https://github.com/nicksp/dotfiles).

If the `~/.gitconfig.local` file exists, it will be automatically be included after the configurations from `~/.gitconfig`. This allows its content to overwrite or add to the existing git configurations.

Example contents of `~/.gitconfig.local`:
```
[user]
  name = Nick Plekhanov
  email = nick@example.com
```

#### Bash
My bash profile automatically sources environment variables from `~/.env` right away (if it exists).

At the end of my bash profile `~/.bash_profile.local` is sourced (if it exists).

This makes it easy to use computer-specific configurations and keep credentials private.


### Scripts
I have scripts to manage the installation of my most commonly used packages and tools:
- install.sh: install brew, n, node, npm packages, and brew formulae
- update.sh: update osx, brew, n, node, npm; install packages/formulae
- uninstall.sh: Unstow configs; remove brew formulae, n, node, and brew
- configure-macosx.sh: Set some OS defaults

### Removing dotfile configurations
To remove this repos configurations:

```bash
# remove symlinks
stow --delete vim bash git iterm
```

After this, the repo can be safely deleted.
