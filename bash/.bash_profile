# Inspired heavily by repos found in dotfiles.github.io, specifically https://github.com/mathiasbynens/dotfiles/

# Load this computer's env vars
if [ -a ~/.env ]; then
  source ~/.env
fi

# Determine if we are in OSX (Linux is assumed otherwise)
case "$OSTYPE" in
  darwin*) isMac=true ;;
  *) isMac=false ;;
esac

# Put readline in vi mode
set -o vi

#
# Exports
#

# Set directory env vars
if [ "$isMac" = true ] ; then
  export NOTES_DIR="$HOME/Documents/notes"
  export PROJECTS_DIR="$HOME/Documents/projects"
else
  export NOTES_DIR="$HOME/notes"
  export PROJECTS_DIR="$HOME/projects"
fi

export GIT_EDITOR=vim
export EDITOR=vim

# Highlight section titles in manual pages.
export LESS_TERMCAP_md="${yellow}";

# Prefer US English and use UTF-8.
export LANG='en_US.UTF-8';
export LC_ALL='en_US.UTF-8';

# Enable persistent REPL history for `node`.
export NODE_REPL_HISTORY=~/.node_history;
# Allow 32³ entries; the default is 1000.
export NODE_REPL_HISTORY_SIZE='32768';
# Use sloppy mode by default, matching web browsers.
export NODE_REPL_MODE='sloppy';

# Increase Bash history size. Allow 32³ entries; the default is 500.
export HISTSIZE='32768';
export HISTFILESIZE="${HISTSIZE}";
# Omit duplicates and commands that begin with a space from history.
export HISTCONTROL='ignoreboth';

#
# PATH extensions
#
# Added by n-install (see http://git.io/n-install-repo).
export N_PREFIX="$HOME/n"; [[ :$PATH: == *":$N_PREFIX/bin:"* ]] || PATH+=":$N_PREFIX/bin"

if [ "$isMac" = true ] ; then
  export PATH="/usr/local/opt/sqlite/bin:$PATH"
  export PATH="/usr/local/opt/python/libexec/bin:$PATH"
else
  export MANPATH="/home/linuxbrew/.linuxbrew/share/man:$MANPATH"
  export INFOPATH="/home/linuxbrew/.linuxbrew/share/info:$INFOPATH"
  export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
fi

#
# Aliases
#

# Easily fix git conflicts
alias conflicts="vim -p \$(git conflicts)"

# Conveniently edit config files
alias evim='vim ~/.vimrc'
alias ebash='vim ~/.bash_profile'
alias egit='vim ~/.gitconfig'
alias etmux='vim ~/.tmux.conf'

# Common typos
alias vmi='vim'
alias g="git"
alias gti='git'
alias sl='ls'

# Print out directory tree, but omit node_modules
alias lst='tree -a -I "node_modules|.git|.next|dist|__generated__"'

# Print each PATH entry on a separate line
alias path='echo -e ${PATH//:/\\n}'

# Easier navigation
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."
alias ~="cd ~"
alias -- -="cd -"

# Create directories if they don't exist
mkdir ${NOTES_DIR} 2> /dev/null
mkdir ${PROJECTS_DIR} 2> /dev/null

# Shortcuts to custom dirs
alias dotfiles="cd ~/dotfiles"
alias notes="cd $NOTES_DIR"
alias projects="cd $PROJECTS_DIR"

# Utility to making a new note (takes a file name)
note () {
  vim "${NOTES_DIR}/$1"
}

# Kill all the tabs in Chrome to free up memory
# [C] explained: http://www.commandlinefu.com/commands/view/402/exclude-grep-from-your-grepped-output-of-ps-alias-included-in-description
alias chromekill="ps ux | grep '[C]hrome Helper --type=renderer' | grep -v extension-process | tr -s ' ' | cut -d ' ' -f2 | xargs kill"

# Lock the screen (when going AFK)
alias afk="/System/Library/CoreServices/Menu\ Extras/User.menu/Contents/Resources/CGSession -suspend"

# Reload the shell (i.e. invoke as a login shell)
alias reload="exec ${SHELL} -l"

# Recursively delete `.DS_Store` files
alias cleanup="find . -type f -name '*.DS_Store' -ls -delete"

# Get macOS Software Updates, and update installed Homebrew and npm packages
alias update='bash ~/dotfiles/scripts/update.sh'

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Detect which `ls` flavor is in use
if ls --color > /dev/null 2>&1; then # GNU `ls`
  eval `dircolors ~/.dir_colors`
  colorflag="--color"
else # macOS `ls`
  colorflag="-G"
fi

# Always use color output for `ls`
alias ls="command ls -a ${colorflag}"

#
# MISC
#

# Add tab completion for many Bash commands
if test $(which brew)
then
  brewdir=`brew --prefix`
  if [ -f "$brewdir/etc/bash_completion" ]; then
    source "$brewdir/etc/bash_completion"
  fi;
  unset brewdir
fi

source ~/.bash-powerline.sh

# Load this computer's additional configurations
if [ -a ~/.bash_profile.local ]; then
  source ~/.bash_profile.local
fi
