#!/usr/bin/env bash

# Ask for the administrator password upfront
sudo -v

# Determine if we are in OSX (Linux is assumed otherwise)
case "$OSTYPE" in
  darwin*) isMac=true ;;
  *) isMac=false ;;
esac

# Check for brew and install it if missing
if test ! $(which brew)
then
  if [ "$isMac" = true ] ; then
    printf "\n>> Installing Homebrew...\n"
    yes | /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  else
    printf "\n>> Installing Linuxbrew...\n"
    sudo apt-get install build-essential curl file git python-setuptools
    yes | sh -c "$(curl -fsSL https://raw.githubusercontent.com/Linuxbrew/install/master/install.sh)"
  fi
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
brew install bash
brew install bash-completion
brew install git
brew install stow
brew install vim --with-override-system-vi
brew install mosh
brew install tmux
brew install tmate
brew install tree
brew install the_silver_searcher
brew install watchman
brew install docker
brew install docker-compose
brew install yamllint
brew install jsonlint --ignore-dependencies node

if [ "$isMac" = true ] ; then
  brew install reattach-to-user-namespace
fi

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
npm i -g yarn nodemon flow-bin eslint babel-eslint eslint-plugin-flowtype jest flow-language-server prettier

# Remove outdated versions from the cellar.
printf "\n>> Cleanup brew\n"
brew cleanup

printf "\n>> Check Brew health\n"
brew doctor

unset isMac
