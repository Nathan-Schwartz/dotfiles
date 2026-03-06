#!/usr/bin/env bash

# Inspired heavily by repos found in dotfiles.github.io, especially https://github.com/mathiasbynens/dotfiles/

# Load any environment-specific settings
if [ -a ~/.env ]; then
  source ~/.env
fi

# Load in my configs
source ~/.bash/settings.sh
source ~/.bash/functions.sh
source ~/.bash/aliases.sh
source ~/.bash/powerline.sh

# Create directories if they don't exist
mkdir -p "$PROJECTS_DIR"

#
# PATH extensions
#

# Homebrew locations: Apple Silicon = /opt/homebrew, Intel Mac = /usr/local. (Not using brew on linux.)
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

# Required by n/n-install (see http://git.io/n-install-repo).
export N_PREFIX="$HOME/n"
export PATH="$N_PREFIX/bin:$PATH"

# Standard python installation directory
export PATH="$(get_python_target_dir)/bin:$PATH"

if [[ "$(command_exists brew)" = true ]]; then
  # This is slow but it's the most robust option I've found so far
  export PATH="$(brew --prefix python)/libexec/bin:$PATH"
fi

# Debian's pip can install packages here
if [ -d "$HOME/.local/bin" ]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

## Load brew's shell completion, if installed and shell is interactive
if [ -n "$PS1" ] && [ "$(command_exists brew)" = 'true' ]; then
  if [ -f "$HOMEBREW_PREFIX/etc/bash_completion" ]; then
    source "$HOMEBREW_PREFIX/etc/bash_completion"
  fi
fi

# Load any environment-specific aliases, paths, etc
if [ -a ~/.bash_profile.local ]; then
  source ~/.bash_profile.local
fi
