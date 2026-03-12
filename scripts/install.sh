#!/usr/bin/env bash

# Exit if a command fails
set -e

# This is mostly for CI, but we just want to make sure the functions are available
source ~/.bash_profile

function main() {
  set_global_vars
  prompt_for_admin_access_if_needed

  if [ "$IS_MAC" = true ]; then
    mac_installs
  elif [ "$hasYum" = true ]; then
    redhat_installs
  elif [ "$hasApt" = true ]; then
    debian_installs
  fi

  mise_installs
  python_installs
  upgrade_dependencies
  log "Good to go!"
}

##########################################################
#  The rest of the file defines functions used by main.  #
##########################################################

function set_global_vars() {
  # ~/dotfiles is the expected location. DOTFILES_DIR can be overridden for
  # environments where the repo lives elsewhere (e.g. CI runners).
  # Other locations are not explicitly supported.
  DOTFILES_DIR="${DOTFILES_DIR:-$HOME/dotfiles}"

  isMissingBrew="$(missing_command brew)"
  isMissingMise="$(missing_command mise)"
  hasYum="$(command_exists yum)"
  hasApt="$(command_exists apt)"

  # Set SKIP_OS_UPDATE to false by default, false if passed false, and true if passed anything else.
  skip_os_update=${SKIP_OS_UPDATE:-false}
  if [ ! "$skip_os_update" = false ]; then
    skip_os_update=true
  fi

  # Set SKIP_COMMITS to CI by default (skips in CI, commits locally)
  skip_commits=${SKIP_COMMITS:-${CI:-false}}
  if [ ! "$skip_commits" = false ]; then
    skip_commits=true
  fi

}

function prompt_for_admin_access_if_needed() {
  if [[ "$isMissingBrew" = true && "$IS_MAC" = true ]]; then
    log "Requesting sudo access to install brew. It is safe to decline osx-keychain requests.\n"
    sudo -v
  elif [[ ! "$skip_os_update" = true && "$IS_MAC" = true ]]; then
    log "Requesting sudo access to install OS updates. (To skip set SKIP_OS_UPDATE=true)\n"
    sudo -v
  elif [ "$IS_MAC" = false ]; then
    log "Requesting sudo access to update deps.\n"
    sudo -v
  fi
}

function mac_installs() {
  log "Installing OSX updates"

  if [ ! "$skip_os_update" = true ]; then
    sudo softwareupdate -i -a
  fi

  xcode-select --install 2>/dev/null || true
  brew_installs

  log "Configuring macOS credential helper"
  git config -f ~/.gitconfig.mac credential.helper osxkeychain
}
function brew_installs() {
  # Check for brew and install if it's missing
  if [ "$isMissingBrew" = true ]; then
    log "Installing Brew..."
    echo | /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi

  # Make sure we’re using the latest version.
  log "Updating Brew"
  brew update

  # Upgrade any already-installed formulae.
  log "Upgrading Brew"
  brew upgrade

  log "Installing Brew packages"
  brew install git python3 pipx bash stow vim tree mise bash-completion rsync coreutils

  log "Cleaning up brew"
  brew cleanup
  brew completions link
}

function redhat_installs() {
  sudo yum --security update -y
  sudo yum install -y epel-release
  sudo yum install -y stow bash vim tree glibc-langpack-en xz

  if [ "$(missing_command git)" = 'true' ]; then
    sudo yum install git -y
  fi

  if [ "$(missing_command python3)" = 'true' ]; then
    sudo yum install python3 -y
  fi

  sudo yum install -y python3-pip
  sudo python3 -m pip install pipx
}

function debian_installs() {
  sudo apt update
  sudo apt upgrade -y
  sudo apt install git stow python3 pipx bash vim tree nfs-common rsync iotop -y
  sudo apt autoremove -y
}

function mise_installs() {
  if [ "$isMissingMise" = true ]; then
    if [ "$IS_MAC" = true ]; then
      log "mise will be installed via brew"
    else
      log "Installing mise"
      curl https://mise.run | sh
    fi
  fi

  log "Trusting global tool-versions"
  mise trust ~/.tool-versions

  log "Installing mise tools"
  eval "$(mise activate bash)"
  mise install --yes -C ~
}

function python_installs() {
  log "Installing Python CLI tools via pipx"
  pipx ensurepath

  pipx_list=(
    pylint
    autopep8
    vim-vint
    proselint
    yamllint
  )
  for pkg in "${pipx_list[@]}"; do
    pipx install "$pkg" --force || { pipx uninstall "$pkg" && pipx install "$pkg"; }
  done

  # glances has a broken platform_version marker for psutil on macOS,
  # so we pass psutil as an extra pip arg to ensure it gets installed
  pipx install glances --pip-args="psutil" --force || { pipx uninstall glances 2>/dev/null; pipx install glances --pip-args="psutil"; }

  # vim-vint uses pkg_resources which requires setuptools in its virtualenv
  pipx inject vim-vint 'setuptools<82' --force
}

function upgrade_dependencies() {
  if [ ! "$skip_commits" = true ]; then
    cd "$DOTFILES_DIR"
    if [ -n "$(git diff --name-only -- mise/.tool-versions vim/.vim/bundle vendor/ticket tmux/.tmux/plugins)" ]; then
      log "Committing pre-upgrade state"
      git add -f mise/.tool-versions vim/.vim/bundle vendor/ticket tmux/.tmux/plugins
      git commit -m "install: pre-upgrade state at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fi
    cd -
  fi

  log "Upgrading mise tools"
  mise upgrade

  log "Updating git submodules"
  git -C "$DOTFILES_DIR" submodule update --force --recursive --init --remote

  log "Symlinking vendor tools"
  mkdir -p "$HOME/.local/bin"
  ln -sf "$DOTFILES_DIR/vendor/ticket/ticket" "$HOME/.local/bin/tk"
  for plugin in "$DOTFILES_DIR"/vendor/tk-plugins/ticket-*; do
    [ -f "$plugin" ] && ln -sf "$plugin" "$HOME/.local/bin/$(basename "$plugin")"
  done

  if [ ! "$skip_commits" = true ]; then
    cd "$DOTFILES_DIR"
    if [ -n "$(git diff --name-only -- mise/.tool-versions vim/.vim/bundle vendor/ticket tmux/.tmux/plugins)" ]; then
      log "Committing upgraded dependencies"
      git add -f mise/.tool-versions vim/.vim/bundle vendor/ticket tmux/.tmux/plugins
      git commit -m "install: upgraded on $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fi
    cd -
  fi
}

function log() {
  green='\033[0;32m'
  nocolor='\033[0m'
  printf "\n$green>>>>>  $nocolor$1\n"
  unset green
  unset nocolor
}

main "$@"
