#!/usr/bin/env bash

# To uninstall (untested):
# rm /Applications/Alacritty.app
# rustup self uninstall
# rm -rf ~/dotfiles/alacritty

# This takes maybe 15 minutes

if test ! $(which rustup)
then
  printf "\n>> Installing Rustup... Hit '1'\n"

  curl https://sh.rustup.rs -sSf | sh
fi


printf "\n>> Updating Rustup...\n"
rustup override set stable
rustup update stable

if ! [ -a ~/dotfiles/alacritty ]; then
  printf "\n>> Cloning Alacritty\n"
  git clone https://github.com/jwilm/alacritty.git ~/dotfiles/alacritty
fi

cd ~/dotfiles/alacritty

printf "\n>> Building Alacritty\n"
cargo build --release

make app

printf "\n>> Exposing Alacritty\n"
cp -r target/release/osx/Alacritty.app /Applications/Alacritty.app
