#!/usr/bin/env bash

case "$OSTYPE" in
  darwin*) isMac=true ;;
  *) isMac=false ;;
esac

# Check for brew and install it if missing
if [ "$isMac" = true ] ; then
  printf "\n>> Apple updates\n"
  sudo softwareupdate -i -a
else
  printf "\n>> Debian updates\n"
  sudo apt-get update
  sudo apt-get upgrade
fi

printf "\n>> Brew updates\n"
brew update
brew upgrade
brew cleanup
brew prune

printf "\n>> n update\n"
n-update -y

printf "\n>> Node update\n"
n lts

printf "\n>> Npm update\n"
npm install npm -g
npm update -g;

unset isMac
