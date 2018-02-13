#!/bin/bash

verify_tmux_version () {
  tmux_home=~/.tmux

  case "$OSTYPE" in
    darwin*) isMac=true ;;
    *) isMac=false ;;
  esac

  if [ "$isMac" = true ] ; then
    tmux source-file "$tmux_home/.tmux.mac.conf"
    exit
  else
    tmux source-file "$tmux_home/.tmux.linux.conf"
    exit
  fi
}

verify_tmux_version
