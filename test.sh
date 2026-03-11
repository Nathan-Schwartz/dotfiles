#!/usr/bin/env bash

set -e

source ~/.bash_profile

echo "Running yamllint..."
yamllint vim/.vintrc.yaml .github/workflows/ci.yml

echo "Running proselint..."
if proselint version &>/dev/null; then
  proselint check README.md
else
  proselint README.md
fi

echo "Running vint..."
vint vim/.vimrc

echo "Running shellcheck..."
shellcheck --severity=warning test.sh scripts/**.sh bash/.bash_profile bash/.bashrc bash/.bash/** vendor/tk-plugins/**

echo "Running jq..."
jq empty < iterm/darkProfile.json

assert "$(command_exists node)" "true" 'Node not installed'
assert "$(command_exists python3)" "true" 'Python 3 not installed'
assert "$(command_exists bash)" "true" 'Bash not installed'
assert "$(command_exists vim)" "true" 'Vim not installed'
assert "$(command_exists rg)" "true" 'ripgrep not installed'
assert "$(command_exists mise)" "true" 'mise not installed'
assert "$(command_exists delta)" "true" 'delta not installed'
assert "$(command_exists biome)" "true" 'biome not installed'
assert "$(command_exists stow)" "true" 'Stow not installed'
assert "$(command_exists shfmt)" "true" 'shfmt not installed'
assert "$(command_exists jq)" "true" 'jq not installed'
assert "$(command_exists jc)" "true" 'jc not installed'
assert "$(command_exists tree)" "true" 'tree not installed'
assert "$(command_exists pipx)" "true" 'pipx not installed'
assert "$(command_exists tk)" "true" 'tk not installed'

echo "Everything looks good!"
