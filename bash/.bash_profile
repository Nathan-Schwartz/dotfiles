# Inspired heavily by repos found in dotfiles.github.io, specifically https://github.com/mathiasbynens/dotfiles/

# Load this computer's env vars
if [ -a ~/.env ]; then
  source ~/.env
fi

#
# Exports
#
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
# Aliases
#

# Print out directory tree, but omit node_modules
alias lst='tree -I node_modules'

# Repeat a command a specified number of times.
# Ex: repeat 5 ls
repeat() {
n=$1
shift
while [ $(( n -= 1 )) -ge 0 ]
do
    "$@"
done
}

# Use mvim, even in the terminal
alias vim='mvim -v'

# Print each PATH entry on a separate line
alias path='echo -e ${PATH//:/\\n}'

# Easier navigation: .., ..., ...., ....., ~ and -
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."
alias ~="cd ~" # `cd` is probably faster to type though
alias -- -="cd -"

# Shortcuts
alias downloads="cd ~/Downloads"
alias desktop="cd ~/Desktop"
alias projects="cd ~/Documents/projects"
alias dotfiles="cd ~/dotfiles"
alias g="git"

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
alias update='sudo softwareupdate -i -a; brew update; brew upgrade; brew cleanup; npm install npm -g; npm update -g;'

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Detect which `ls` flavor is in use
if ls --color > /dev/null 2>&1; then # GNU `ls`
	colorflag="--color"
else # macOS `ls`
	colorflag="-G"
fi

# Always use color output for `ls`
alias ls="command ls ${colorflag}"

#
# MISC
#

# Correct failed commands using `pls`
eval $(thefuck --alias pls)


# Add tab completion for many Bash commands
brewdir=`brew --prefix`
if [ -f "$brewdir/etc/bash_completion" ]; then
  source "$brewdir/etc/bash_completion"
fi;
unset brewdir

source ~/.bash-powerline.sh

# Load this computer's additional configurations
if [ -a ~/.custom_bash_profile ]; then
  source ~/.custom_bash_profile
fi

# cd ~

