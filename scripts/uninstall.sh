#!/usr/bin/env bash

# NOTE: Does not uninstall global npm packages.

# Ask for the administrator password upfront
sudo -v

cd ~/dotfiles

printf "\n>> Removing stowed dotfiles\n"
stow --delete vim git bash iterm

# This may be necessary as a fallback since iterm will replace the config file instead of modifying it
# stow --delete --ignore com.googlecode.iterm2.plist vim git bash iterm

printf "\n>> Uninstall n\n"
n-uninstall

printf "\n>> Uninstall HomeBrew Packages\n"
brew remove --force $(brew list) --ignore-dependencies
brew cleanup
brew prune

printf "\n>> Uninstall HomeBrew\n"
echo "y" | /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/uninstall)"

