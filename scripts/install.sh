#!/usr/bin/env bash

set -e # Exit if a command fails

function main() {
  set_global_vars
  prompt_for_admin_access_if_needed

  if [ ! "$skip_os_update" = true ]; then
    update_os
  fi

  install_node_ecosystem
  install_brew_and_formulae
  install_pip_packages
  unset_global_vars
  print_final_message
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
function unset_global_vars() {
  unset isMissingBrew
  unset skip_os_update
  unset isMac
  unset isMissingN
}

function log() {
  green='\033[0;32m'
  nocolor='\033[0m'
  printf "\n$green>>>>>  $nocolor$1\n"
  unset green
  unset nocolor
}

function update_os() {
  # Check for brew and install it if missing
  if [ "$isMac" = true ]; then
    log "Installing OSX updates"
    sudo softwareupdate -i -a
  else
    log "Skipping OS updates (only supported for OSX)"
    #   printf "\n>> Debian updates\n"
    #   sudo apt-get update
    #   sudo apt-get upgrade -y
  fi
}

function prompt_for_admin_access_if_needed() {
  if [ "$isMissingBrew" = true ]; then
    log "May request admin access to install brew. It is safe to decline osx-keychain requests.\n"
    sudo -v
  fi

  if [ ! "$skip_os_update" = true ]; then
    log "May request admin access to run OS updates. Rerun with SKIP_OS_UPDATE=true to skip os updates.\n"
    sudo -v
  fi
}

function install_node_ecosystem() {
  if [ "$isMissingN" = true ]; then
    log "Installing n-install, n, and Node LTS"
    # -y automates installation, -n avoids modifying bash_profile
    curl -L https://git.io/n-install | bash -s -- -n -y
  else
    log "Updating n"
    n-update -y

    log "Installing Node LTS"
    n lts
  fi

  # Upgrade any already-installed packages.
  log "Updating Global NPM Packages"
  npm update -g

  log "Installing Global NPM Packages"
  # Only installs if they are missing.
  npm_list=(
    yarn
    nodemon
    flow-bin
    eslint
    babel-eslint
    eslint-plugin-flowtype
    jest
    flow-language-server
    prettier
  )
  for pkg in "${npm_list[@]}"; do
    if ! npm list -g "$pkg" >/dev/null; then
      npm i -g "$pkg"
    fi
  done
}

function install_brew_and_formulae() {
  # Check for brew and install if it's missing
  if [ "$isMissingBrew" = true ]; then
    log "Installing Brew..."
    echo | /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"

    # Make not shallow, ignore exit code because it fails if the repo isn't shallow, which is the case for reinstallations.
    log "Getting full Brew repo"
    git -C "$(brew --repo homebrew/core)" fetch --unshallow || true
  fi

  # Make sure we’re using the latest version.
  log "Updating Brew"
  brew update

  # Upgrade any already-installed formulae.
  log "Upgrading Brew"
  brew upgrade

  log "Installing Brew packages"
  brew install bash
  brew install bash-completion
  brew install shellcheck
  brew install shfmt
  brew install git
  brew install stow
  brew install vim
  brew install mosh
  brew install tmux
  brew install tmate
  brew install tree
  brew install the_silver_searcher
  brew install watchman
  brew install yamllint
  brew install icu4c
  brew install python@3.8
  brew install jsonlint

  # Explicitly ignoring installation success for these because they may unsuccessfully link due to docker desktop installs
  brew install docker || true
  brew install docker-compose || true

  if [ "$isMac" = true ]; then
    # This package is a copy-paste integration between tmux and osx
    brew install reattach-to-user-namespace
  fi

  # jsonlint unfortunately has a node dependency specified with Brew, and Brew doesn't respect the ignore-dependencies flag for installations.
  # Adding || true because removal isn't idempotent
  brew uninstall --ignore-dependencies node || true

  # Remove outdated versions from the cellar.
  log "Cleaning up brew"
  brew cleanup

  log "Checking Brew health"
  brew doctor || true
}

function print_final_message() {
  log "Looks like everything ran successfully, but you may want to double check brew health just to be sure :)"
  log "NOTE: It's ok for node to be a missing brew dependency because it is installed through n."
}

function install_pip_packages() {
  log "Installing PIP packages"
  python3 -m pip install pylint autopep8
}

main "$@"
exit

# To uninstall packages this is a good start:
# brew uninstall $(brew list) && n uninstall && n-uninstall && /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/uninstall.sh)" && rm /usr/local/bin/npm
