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
  update_git_submodules
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
    xcode-select --install 2>/dev/null || true
  elif [ -f /etc/redhat-release ]; then
    sudo yum --security update
  elif [ -f /etc/lsb-release ]; then
    sudo apt-get update
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

function update_git_submodules() {
  log "Update dotfile git submodules"
  cd ~/dotfiles
  git submodule update --force --recursive --init --remote
  cd -
}

function install_node_ecosystem() {
  n_version_to_install="${PREFERRED_NODE_VERSION:-lts}"
  if [ "$isMissingN" = true ]; then
    log "Installing n-install, n, and Node $n_version_to_install"
    # -y automates installation, -n avoids modifying bash_profile
    curl -L https://git.io/n-install | bash -s -- -n -y
  else
    log "Updating n"
    n-update -y

    log "Installing Node $n_version_to_install"
    n $n_version_to_install
    unset n_version_to_install
  fi

  # Upgrade any already-installed packages.
  log "Updating Global NPM Packages"
  npm update -g

  log "Installing Global NPM Packages"
  # Only installs if they are missing.
  npm_list=(
    yarn
    nodemon
    serve
    eslint
    babel-eslint
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
  brew install bash
  brew install shellcheck
  brew install shfmt
  brew install stow
  brew install vim
  brew install tmux
  brew install tree
  brew install the_silver_searcher
  brew install watchman
  brew install yamllint
  brew install icu4c
  brew install jsonlint

  if [ "$isMac" = true ]; then
    # This package is a copy-paste integration between tmux and osx
    brew install reattach-to-user-namespace
    brew install bash-completion
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
  python3 -m pip install pylint autopep8 glances
}

main "$@"
exit

# To uninstall packages this is a good start:
# brew uninstall $(brew list) && n uninstall && n-uninstall && /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/uninstall.sh)" && rm /usr/local/bin/npm
