#!/usr/bin/env bash

set -e

echo "Running yamllint..."
yamllint vim/.vintrc.yaml

echo "Running proselint..."
proselint README.md

echo "Running vint..."
vint vim/.vimrc

echo "Running shellcheck..."
shellcheck --severity=warning test.sh scripts/** bash/.bash_profile bash/.bashrc bash/.bash-powerline.sh

echo "Running jq..."
jq empty < iterm/darkProfile.json

echo "Everything looks good!"
