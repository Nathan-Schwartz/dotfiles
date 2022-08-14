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
mkdir -p "$NOTES_DIR"
mkdir -p "$PROJECTS_DIR"

#
# PATH extensions
#
# Required by n/n-install (see http://git.io/n-install-repo).
export N_PREFIX="$HOME/n"
export PATH="$N_PREFIX/bin:$PATH"

# Homebrew can install commands here
export PATH="/usr/local/sbin:$PATH"

# Homebrew's pip can install packages here
if [ -d "/usr/local/opt/python@3.9/Frameworks/Python.framework/Versions/3.9/bin" ]; then
  export PATH="/usr/local/opt/python@3.9/Frameworks/Python.framework/Versions/3.9/bin:$PATH"
fi

# Debian's pip can install packages here
if [ -d "$HOME/.local/bin" ]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

# Load linuxbrew, if applicable (deprecated)
if [ "$IS_MAC" != 'true' ] && [ -f /home/linuxbrew/.linuxbrew/bin/brew ]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

## Load brew's shell completion, if installed and shell is interactive
if [ -n "$PS1" ] && [ "$(command_exists brew)" = 'true' ]; then
  brewdir=$(brew --prefix)
  if [ -f "$brewdir/etc/bash_completion" ]; then
    source "$brewdir/etc/bash_completion"
  fi
  unset brewdir
fi

# Used by tmux to load the desired bash executable
export BASH_PATH="$(which bash)"

# Load any environment-specific aliases, paths, etc
if [ -a ~/.bash_profile.local ]; then
  source ~/.bash_profile.local
fi
