#!/usr/bin/env bash

set -x

# Apple updates
sudo softwareupdate -i -a

# Brew updates
brew update
brew upgrade
brew cleanup
brew prune

# n update
n-update -y

# Node update
n lts

# Npm update
npm install npm -g
npm update -g;
