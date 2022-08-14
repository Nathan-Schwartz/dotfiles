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
alias tma='tmux attach || tmux'
alias tmk='tmux kill-server'

# Common typos
alias vmi='vim'
alias g="git"
alias gti='git'
alias sl='ls'

# Print out directory tree, but omit node_modules
alias lst='tree -a -I "node_modules|.git|.next|dist|__generated__"'
alias agi='ag --ignore node_modules --ignore dist --ignore coverage --ignore test --ignore tests --ignore __test__ --ignore __mocks__'

# Print each PATH entry on a separate line
alias path='echo -e ${PATH//:/\\n}'

# Easier navigation
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."

# Shortcuts to custom dirs
alias dotfiles="cd ~/dotfiles"
alias notes="cd $NOTES_DIR"
alias projects="cd $PROJECTS_DIR"

# Reload the shell (i.e. invoke as a login shell)
alias reload="exec $SHELL -l"

# Get macOS Software Updates, and update installed Homebrew and npm packages
alias update_global_deps='~/dotfiles/scripts/install.sh'

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Detect which `ls` flavor is in use
if ls --color >/dev/null 2>&1; then # GNU `ls`
  if [[ "$(command_exists gdircolors)" = true ]]; then
    eval "$(gdircolors ~/.dir_colors)"
  fi

  if [[ "$(command_exists dircolors)" = true ]]; then
    eval "$(dircolors ~/.dir_colors)"
  fi
  colorflag="--color"
else # macOS `ls`
  colorflag="-G"
fi

# Always use color output for `ls`
alias ls="command ls -a ${colorflag}"
