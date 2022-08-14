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

  node_installs
  python_installs
  dotfile_submodule_installs
  log "Good to go!"
}

##########################################################
#  The rest of the file defines functions used by main.  #
##########################################################

function set_global_vars() {
  isMissingBrew="$(missing_command brew)"
  isMissingNode="$(missing_command node)"
  isMissingN="$(missing_command n)"
  isMissingNUpdate="$(missing_command n-update)"
  hasYum="$(command_exists yum)"
  hasApt="$(command_exists apt)"

  # Set SKIP_OS_UPDATE to false by default, false if passed false, and true if passed anything else.
  skip_os_update=${SKIP_OS_UPDATE:-false}
  if [ ! "$skip_os_update" = false ]; then
    skip_os_update=true
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
}
function brew_installs() {
  # Check for brew and install if it's missing
  if [ "$isMissingBrew" = true ]; then
    log "Installing Brew..."
    echo | /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"

    # Make not shallow, ignore exit code because it fails if the repo isn't shallow, which is the case for reinstallations.
    log "Getting full Brew repo"
    git -C "$(brew --repo homebrew/core)" fetch --unshallow || true

    if [[ "$IS_MAC" = false ]]; then
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
  brew install git python3 bash stow vim tmux tree the_silver_searcher bash-completion reattach-to-user-namespace rsync coreutils jq

  log "Cleaning up brew"
  brew cleanup
  brew completions link
}

function redhat_installs() {
  sudo yum --security update -y
  sudo yum install stow bash vim tmux tree the_silver_searcher -y

  if [ "$(missing_command git)" = 'true' ]; then
    sudo yum install git -y
  fi

  if [ "$(missing_command python3)" = 'true' ]; then
    sudo yum install python3 -y
  fi

  sudo python3 -m pip install --upgrade pip
}

function debian_installs() {
  sudo apt update
  sudo apt upgrade -y
  sudo apt install git stow python3 python3-pip bash vim tmux tree silversearcher-ag nfs-common rsync iotop jq -y
  sudo python3 -m pip install --upgrade pip
  sudo apt autoremove -y
}

function node_installs() {
  n_version_to_install="${PREFERRED_NODE_VERSION:-lts}"

  if [[ "$isMissingN" = true && "$isMissingNode" = false ]]; then
    log "Node was not installed with N. Skipping N install."
  else
    if [ "$isMissingN" = true ]; then
      log "Installing n-install, n, and Node $n_version_to_install"
      # -y automates installation, -n avoids modifying bash_profile
      curl -L https://git.io/n-install | bash -s -- -n -y
    else
      if [ "$isMissingNUpdate" != true ]; then
        log "Updating n"
        n-update -y
      fi

      log "Installing Node $n_version_to_install"
      n "$n_version_to_install"
      unset n_version_to_install
    fi
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
  if [ "$IS_MAC" = true ]; then
    # Specify target directory on mac to avoid conflicting/non-standard locations. .bash_profile ensures `get_python_target_dir` is in $PATH
    python3 -m pip install glances pylint autopep8 vim-vint proselint yamllint shfmt-py shellcheck-py jc --upgrade -t "$(get_python_target_dir)"
  else
    python3 -m pip install glances pylint autopep8 vim-vint proselint yamllint shfmt-py shellcheck-py jc --upgrade
  fi
}

function dotfile_submodule_installs() {
  log "Update dotfile git submodules"

  if [ "$CI" != 'true' ]; then
    cd ~/dotfiles
  fi

  git submodule update --force --recursive --init --remote

  if [ "$CI" != 'true' ]; then
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
