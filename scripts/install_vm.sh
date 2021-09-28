#!/usr/bin/env bash

set -e
# Targetting Debian 11.0 VMs
# Available at https://bit.ly/39F1JVQ for an indefinite amount of time.
echo ">>>>>>>>>> Creating a script to be run manually as root, because executing a singular script across user changes is not supported."

echo "
set -e

apt-get update
apt-get upgrade -y
apt install sudo curl python3-pip git stow -y
pip3 install glances
usermod -aG sudo nathanschwartz
echo '>>>>>>>>>> Run "exit" to resume install'
" > ./install_as_root.sh
echo ">>>>>>>>>> login as root (and then run 'bash $(pwd)/install_as_root.sh'):"
su - root

git clone --recursive https://github.com/Nathan-Schwartz/dotfiles.git ~/dotfiles || true

cd ~/dotfiles

mv ~/.bashrc ~/.bash_profile.local
stow vim bash git iterm tmux --restow
sudo apt-get remove stow -y

source ~/.bashrc && bash ~/dotfiles/scripts/install.sh || true

# Finishing glances install

sudo pip3 install bottle

echo '
[Unit]
Description=Glances
After=network.target

[Service]
ExecStart=glances -w
Restart=on-abort
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target' | sudo tee '/etc/systemd/system/glances.service' > /dev/null

sudo systemctl enable glances
sudo systemctl daemon-reload
sudo service glances start
sudo service glances status
echo "VM Installation complete."
