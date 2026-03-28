#!/usr/bin/env bash

# Easily fix git conflicts
alias conflicts="git exec vim -p \$(git conflicts)"

# Conveniently edit config files
alias evim='$EDITOR ~/.vimrc'
alias ebash='$EDITOR ~/.bash_profile'
alias ebashl='$EDITOR ~/.bash_profile.local'
alias ebashh='$EDITOR ~/.bash_history'
alias egit='$EDITOR ~/.gitconfig'
alias etmux='$EDITOR ~/.tmux.conf'
alias einstall='$EDITOR ~/dotfiles/scripts/install.sh'

# Tmux
alias tma='tmux new-session -A -s mainsession'
alias tmk='tmux kill-server'
alias tmc='tmclaude'

# Start a named Claude Code window in tmux
# Usage: tmclaude [name]  (defaults to current directory basename)
tmclaude() {
    local name="${1:-$(basename "$PWD")}"
    name="${name%"${name##*[![:space:]]}"}" # strip trailing whitespace
    if [[ -z "$TMUX" ]]; then
        # Outside tmux: create session if needed, add claude window, then attach.
        # Uses -d (detached) so we can set up the window before attaching.
        if tmux has-session -t mainsession 2>/dev/null; then
            tmux new-window -t mainsession -n "$name" -c "$PWD" "claude"
        else
            tmux new-session -d -s mainsession -n "$name" -c "$PWD" "claude"
        fi
        tmux set-option -t mainsession -w automatic-rename off
        tmux attach -t mainsession
    elif [[ -n "$IN_POPUP" ]]; then
        # In a popup (set via -e IN_POPUP=1 on display-popup in tmux.conf):
        # create a new window and exit to dismiss the popup.
        tmux new-window -n "$name" -c "$PWD" "claude"
        tmux set-option -w automatic-rename off
        exit
    else
        # In a regular tmux window: take over the current window.
        # exec replaces the shell so the window closes when claude exits.
        tmux rename-window "$name"
        tmux set-option -w automatic-rename off
        exec claude
    fi
}

# Axe — resolve agents from dotfiles for commands that support it
axe() {
  case "$1" in
    run) command axe --agents-dir ~/dotfiles/axe/agents --timeout 300 "$@" ;;
    agents|gc) command axe --agents-dir ~/dotfiles/axe/agents "$@" ;;
    *) command axe "$@" ;;
  esac
}

# Common typos
alias vmi='vim'
alias g="git"
alias gti='git'
alias sl='ls'

# Print out directory tree, but omit node_modules
alias lst='tree -a -I "node_modules|.git|.next|dist|__generated__"'

# Print each PATH entry on a separate line
alias path='echo -e ${PATH//:/\\n}'

# Shortcuts to custom dirs
alias dotfiles="cd ~/dotfiles"
alias projects="cd $PROJECTS_DIR"

# Reload the shell (i.e. invoke as a login shell)
alias reload="exec $SHELL -l"

# Get macOS Software Updates, and update installed Homebrew and npm packages
alias update_global_deps='~/dotfiles/scripts/install.sh'

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Detect which `ls` flavor is in use
if [[ "$(command_exists gls)" = true ]]; then # GNU `ls` via Homebrew coreutils
  eval "$(gdircolors ~/.dir_colors)"
  ls() { command gls -a --color "$@"; }
elif command ls --color >/dev/null 2>&1; then # GNU `ls` (Linux)
  if [[ "$(command_exists dircolors)" = true ]]; then
    eval "$(dircolors ~/.dir_colors)"
  fi
  ls() { command ls -a --color "$@"; }
else # macOS BSD `ls`
  ls() { command ls -a -G "$@"; }
fi
