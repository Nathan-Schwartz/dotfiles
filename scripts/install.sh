#!/usr/bin/env bash

# Exit if a command fails
set -e

function main() {
  set_global_vars
  prompt_for_admin_access_if_needed

  if [ "$isMac" = true ]; then
    mac_installs
  elif [ "$hasYum" = true ]; then
    redhat_installs
  elif [ "$hasApt" = true ]; then
    debian_installs
  fi

  node_installs
  python_installs
  dotfile_submodule_installs
  log "Good to go!"
}

##########################################################
#  The rest of the file defines functions used by main.  #
##########################################################

function set_global_vars() {
  if test ! "$(which brew)"; then
    isMissingBrew=true
  else
    isMissingBrew=false
  fi

  if test ! "$(which n)"; then
    isMissingN=true
  else
    isMissingN=false
  fi

  if test "$(which yum)"; then
    hasYum=true
  else
    hasYum=false
  fi

  if test "$(which apt)"; then
    hasApt=true
  else
    hasApt=false
  fi

  # Set SKIP_OS_UPDATE to false by default, false if passed false, and true if passed anything else.
  skip_os_update=${SKIP_OS_UPDATE:-false}
  if [ ! "$skip_os_update" = false ]; then
    skip_os_update=true
  fi

  case "$OSTYPE" in darwin*)
    isMac=true
    ;;
  *)
    isMac=false
    ;;
  esac
}

function prompt_for_admin_access_if_needed() {
  if [[ "$isMissingBrew" = true && "$isMac" = true ]]; then
    log "Requesting sudo access to install brew. It is safe to decline osx-keychain requests.\n"
    sudo -v
  elif [[ ! "$skip_os_update" = true && "$isMac" = true ]]; then
    log "Requesting sudo access to install OS updates. (To skip set SKIP_OS_UPDATE=true)\n"
    sudo -v
  elif [ "$isMac" = false ]; then
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
}
function brew_installs() {
  # Check for brew and install if it's missing
  if [ "$isMissingBrew" = true ]; then
    log "Installing Brew..."
    echo | /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"

    # Make not shallow, ignore exit code because it fails if the repo isn't shallow, which is the case for reinstallations.
    log "Getting full Brew repo"
    git -C "$(brew --repo homebrew/core)" fetch --unshallow || true

    if [[ "$isMac" = false ]]; then
      eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    fi
  fi

  # Make sure we’re using the latest version.
  log "Updating Brew"
  brew update

  # Upgrade any already-installed formulae.
  log "Upgrading Brew"
  brew upgrade

  log "Installing Brew packages"
  brew install git python3 bash stow vim tmux tree the_silver_searcher bash-completion reattach-to-user-namespace

  log "Cleaning up brew"
  brew cleanup
  brew completions link
}

function redhat_installs() {
  sudo yum --security update -y
  sudo yum install git stow python3 bash vim tmux tree the_silver_searcher
}

function debian_installs() {
  sudo apt update
  sudo apt upgrade -y
  sudo apt install git stow python3 python3-pip bash vim tmux tree silversearcher-ag -y
  sudo apt autoremove -y
}

function node_installs() {
  n_version_to_install="${PREFERRED_NODE_VERSION:-lts}"
  if [ "$isMissingN" = true ]; then
    log "Installing n-install, n, and Node $n_version_to_install"
    # -y automates installation, -n avoids modifying bash_profile
    curl -L https://git.io/n-install | bash -s -- -n -y
  else
    log "Updating n"
    n-update -y

    log "Installing Node $n_version_to_install"
    n "$n_version_to_install"
    unset n_version_to_install
  fi

  # Upgrade any already-installed packages.
  log "Updating Global NPM Packages"
  npm update -g

  log "Installing Global NPM Packages"

  npm_list=(
    yarn

    eslint
    prettier
    @babel/eslint-parser
    @babel/core
    prettier-eslint
  )
  for pkg in "${npm_list[@]}"; do
    install_node_module "$pkg"
  done
}
function install_node_module() {
  # Only installs if dep is missing.
  if ! npm list -g "$1" >/dev/null; then
    # force should be ok because the package was just determined not to exist
    npm i -g "$1" --force
  fi
}

function python_installs() {
  log "Installing PIP packages"
  python3 -m pip install glances pylint autopep8 vim-vint proselint yamllint jq shfmt-py shellcheck-py
}

function dotfile_submodule_installs() {
  log "Update dotfile git submodules"
  cd ~/dotfiles
  git submodule update --force --recursive --init --remote
  cd -
}

function log() {
  green='\033[0;32m'
  nocolor='\033[0m'
  printf "\n$green>>>>>  $nocolor$1\n"
  unset green
  unset nocolor
}

main "$@"
# exit

# To uninstall packages this is a good start:
# brew uninstall $(brew list) && n uninstall && n-uninstall && /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/uninstall.sh)" && rm /usr/local/bin/npm
