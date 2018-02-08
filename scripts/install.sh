#!/usr/bin/env bash

# Ask for the administrator password upfront
sudo -v

# Check for Homebrew and install it if missing
if test ! $(which brew)
then
  printf "\n>> Installing Homebrew...\n"
  echo 'y' | /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
fi

# Make sure we’re using the latest Homebrew.
printf "\n>> Update Brew\n"
brew update

# Upgrade any already-installed formulae.
printf "\n>> Upgrade Brew\n"
brew upgrade

# Make not shallow
printf "\n>> Make homebrew not shallow\n"
git -C "$(brew --repo homebrew/core)" fetch --unshallow

printf "\n>> Install brew packages\n"
brew install vim --with-override-system-vi
brew install tmux
brew install git
brew install tree
brew install bash-completion
brew install macvim
brew install stow
brew install the_silver_searcher
brew install thefuck
brew install watchman
brew install docker
brew install docker-compose

# Install n for managing Node versions (using npm)
printf "\n>> Install n\n"
# -y automates installation, -n avoids modifying bash_profile
curl -L https://git.io/n-install | bash -s -- -n -y

# n requires resourcing or reloading before first use
source ~/.bash_profile

# Upgrade node
printf "\n>> Install Node LTS using n\n"
n lts

# Remove unused versions of node
n prune

# Install some global packages
printf "\n>> Install global npm packages\n"
npm i -g pult-cli yarn nodemon commitizen flow-bin eslint babel-eslint eslint-plugin-flowtype

# # Skip least used installs
# brew install mongodb
# brew install postgresql
# brew install awscli
# brew install imagemagick --with-webp

# Remove outdated versions from the cellar.
printf "\n>> Cleanup brew\n"
brew cleanup

printf "\n>> Check Brew health\n"
brew doctor
