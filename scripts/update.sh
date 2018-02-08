#!/usr/bin/env bash

printf "\n>> Apple updates\n"
sudo softwareupdate -i -a

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
