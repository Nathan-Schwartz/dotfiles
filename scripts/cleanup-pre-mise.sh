#!/usr/bin/env bash

# Cleanup script for removing old package manager installs that are now handled by mise.
# Run this once on each machine after migrating to mise.
#
# What moved to mise:
#   n (node)        -> mise: node
#   the_silver_searcher (ag) -> mise: ripgrep
#   jq (brew/apt)   -> mise: jq
#   shellcheck-py   -> mise: shellcheck
#   shfmt-py        -> mise: shfmt
#   jc (pipx)       -> mise: jc

set -e

cleaned=false

#
# 1. Remove n / n-install (old Node.js version manager)
#
echo "Checking for n-install..."
if command -v n-uninstall &>/dev/null; then
  echo "  Found n-uninstall, running it..."
  n-uninstall -y
  cleaned=true
elif [ -d "$HOME/n" ]; then
  echo "  Removing ~/n directory..."
  rm -rf "$HOME/n"
  cleaned=true
else
  echo "  Not found, skipping."
fi

# Warn about stale N_PREFIX references
for f in "$HOME/.env" "$HOME/.bash_profile.local"; do
  if [ -f "$f" ] && grep -q 'N_PREFIX' "$f"; then
    echo "  Warning: $f still references N_PREFIX — edit it manually."
  fi
done

#
# 2. Remove pipx packages now managed by mise
#
echo "Checking for pipx packages to remove..."
pipx_to_remove=(shellcheck-py shfmt-py jc)
for pkg in "${pipx_to_remove[@]}"; do
  if pipx list --short 2>/dev/null | grep -q "^${pkg} "; then
    echo "  Removing pipx package: $pkg"
    pipx uninstall "$pkg"
    cleaned=true
  else
    echo "  $pkg not installed via pipx, skipping."
  fi
done

#
# 3. Remove brew packages now managed by mise (macOS only)
#
if command -v brew &>/dev/null; then
  echo "Checking for brew packages to remove..."
  brew_to_remove=(the_silver_searcher jq)
  for pkg in "${brew_to_remove[@]}"; do
    if brew list "$pkg" &>/dev/null; then
      echo "  Removing brew package: $pkg"
      brew uninstall "$pkg"
      cleaned=true
    else
      echo "  $pkg not installed via brew, skipping."
    fi
  done
fi

#
# 4. Pre-pipx pip packages (manual)
#
# Older machines may have CLI tools installed with raw `pip install --user` before
# the pipx migration. These live in ~/.local/lib/pythonX.Y/site-packages and their
# scripts in ~/.local/bin. pip doesn't track which packages were intentionally
# installed vs pulled in as dependencies, so automated removal is risky.
#
# To check what's there:
#   pip3 list --user
#
# To remove a specific package:
#   pip3 uninstall <package>
#
# Common candidates (now installed via pipx or mise):
#   pylint, autopep8, yamllint, proselint, vim-vint, shellcheck-py, shfmt-py, jc
#
# If ~/.local/lib contains only pip remnants and pipx/mise now own everything,
# you can nuke it:
#   rm -rf ~/.local/lib/python*/site-packages
#
# But check `pip3 list --user` first to make sure nothing important remains.
#
echo ""
echo "NOTE: If this machine had tools installed via raw 'pip install --user'"
echo "  before the pipx migration, you may want to clean those up manually."
echo "  Run 'pip3 list --user' to see what's left."

if [ "$cleaned" = true ]; then
  echo ""
  echo "Done. Open a new shell to pick up the changes."
else
  echo ""
  echo "Nothing else to clean up."
fi
