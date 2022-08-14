#!/usr/bin/env bash

set -e

source ~/.bash_profile

echo "Running yamllint..."
yamllint vim/.vintrc.yaml .github/workflows/ci.yml

echo "Running proselint..."
proselint README.md

echo "Running vint..."
vint vim/.vimrc

echo "Running shellcheck..."
shellcheck --severity=warning test.sh scripts/** bash/.bash_profile bash/.bashrc bash/.bash/**

echo "Running jq..."
jq empty < iterm/darkProfile.json

assert "$(command_exists tmux)" "true" 'Tmux not installed'
assert "$(command_exists node)" "true" 'Node not installed'
assert "$(command_exists python3)" "true" 'Python 3 not installed'
assert "$(command_exists bash)" "true" 'Bash not installed'
assert "$(command_exists vim)" "true" 'Vim not installed'
assert "$(command_exists ag)" "true" 'Ag not installed'
assert "$(command_exists stow)" "true" 'Stow not installed'

echo "Everything looks good!"
