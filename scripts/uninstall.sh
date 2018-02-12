#!/usr/bin/env bash

# NOTE: Does not uninstall global npm packages.

# Ask for the administrator password upfront
sudo -v

printf "\n>> Removing stowed dotfiles\n"
stow --delete -t ~ -d ~/dotfiles tmux vim bash git iterm

printf "\n>> Uninstall n\n"
n-uninstall

printf "\n>> Uninstall HomeBrew Packages\n"
brew remove --force $(brew list) --ignore-dependencies
brew cleanup
brew prune

printf "\n>> Uninstall HomeBrew\n"
yes | /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/uninstall)"

