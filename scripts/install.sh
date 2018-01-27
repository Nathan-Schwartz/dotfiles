#!/usr/bin/env bash

set -x

# Ask for the administrator password upfront
sudo -v

# Check for Homebrew and install it if missing
if test ! $(which brew)
then
  echo "Installing Homebrew..."
  /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
fi

# Make sure we’re using the latest Homebrew.
brew update

# Upgrade any already-installed formulae.
brew upgrade

# Install more recent versions of some macOS tools.
brew install vim --with-override-system-vi
brew install screen

# Install other useful binaries.
brew install ack
brew install git
brew install imagemagick --with-webp
brew install tree

# things I actually care about installing
brew install bash-completion
brew install macvim
brew install node
brew install stow
brew install the_silver_searcher
brew install thefuck
brew install watchman
brew install docker
brew install docker-compose

git -C "$(brew --repo homebrew/core)" fetch --unshallow

brew install awscli

# Install n for managing Node versions (using npm)
npm i -g n

# upgrade node
n lts

# remove unused versions of node
n prune

# remove brew installed node
brew uninstall --force node

# Install some global packages
npm i -g pult-cli yarn nodemon commitizen flow-bin eslint babel-eslint eslint-plugin-flowtype

# # DB installs
# brew install mongodb
# brew install postgresql

# Remove outdated versions from the cellar.
brew cleanup


