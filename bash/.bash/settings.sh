#!/usr/bin/env bash

#
# Standard configs
#

# Put readline in vi mode
set -o vi

# Set my preferred editor
export GIT_EDITOR=vim
export EDITOR=vim

# shopt -s globstar
shopt -s checkwinsize
shopt -s histappend


# Don't show zsh warning on Catalina
export BASH_SILENCE_DEPRECATION_WARNING=1

# Bash history, don't store dupes
export HISTCONTROL=ignoredups:erasedups

# Prefer US English and use UTF-8.
export LANG='en_US.UTF-8'
export LC_ALL='en_US.UTF-8'

# Enable persistent REPL history for `node`.
export NODE_REPL_HISTORY=~/.node_history
# Allow 32³ entries; the default is 1000.
export NODE_REPL_HISTORY_SIZE='32768'
# Use sloppy mode by default, matching web browsers.
export NODE_REPL_MODE='sloppy'

# Increase Bash history size. Allow 32³ entries; the default is 500.
export HISTSIZE='32768'
export HISTFILESIZE="${HISTSIZE}"
# Omit duplicates and commands that begin with a space from history.
export HISTCONTROL='erasedups:ignoredups:ignorespace'


#
# dotfile configs
#

# Set directory env vars
if [ "$IS_MAC" = true ]; then
  export NOTES_DIR="$HOME/Documents/notes"
  defaultProjectsDir="$HOME/Documents/projects"
  export PROJECTS_DIR="${PROJECTS_DIR:-$defaultProjectsDir}"
  unset defaultProjectsDir
else
  export NOTES_DIR="$HOME/notes"
  defaultProjectsDir="$HOME/projects"
  export PROJECTS_DIR="${PROJECTS_DIR:-$defaultProjectsDir}"
  unset defaultProjectsDir
fi

# Used to control the shell depth prompt value
export SHELL_DEPTH_OFFSET="${SHELL_DEPTH_OFFSET:-1}"

# Used to optionally disable git status info in the prompt due to performance implications
export SKIP_GIT_PROMPT="${SKIP_GIT_PROMPT:-false}"

# While not truly a setting, it fits this file best
case "$OSTYPE" in darwin*)
  export IS_MAC=true
  ;;
*)
  export IS_MAC=false
  ;;
esac

