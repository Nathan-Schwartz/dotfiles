# This file should be run as the user created in setup1.sh

#
# Random
#
sudo apt install htop

# This is necessary for watchman to work
echo 999999 | sudo tee -a /proc/sys/fs/inotify/max_user_watches
echo 999999 | sudo tee -a /proc/sys/fs/inotify/max_queued_events
echo 999999 | sudo tee -a /proc/sys/fs/inotify/max_user_instances



#
# Lock it down
#

# IMPORTANT NOTE: Set this in /etc/ssh/sshd_config
sudo vim /etc/ssh/sshd_config

# PermitRootLogin no

# listen only on ip4
echo 'AddressFamily inet' | sudo tee -a /etc/ssh/sshd_config

# Restart to make changes active
sudo systemctl restart sshd

sudo systemctl enable ssh

# Install Fail2Ban
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install fail2ban -y

# http://articles.slicehost.com/2010/4/30/ubuntu-lucid-setup-part-1
# https://major.io/2009/11/16/automatically-loading-iptables-on-debianubuntu/
sudo systemctl enable ssh

# Configure Fail2Ban
fail2ban="[ssh]

enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 6

# \`bantime\` is the number of seconds that a host is banned.
bantime  = 300

# A host is banned if it has generated \`maxretry\` during the last \`findtime\` seconds.
findtime = 300
"

echo "$fail2ban" > /etc/fail2ban/jail.local

sudo systemctl enable fail2ban.service



#
# Iptable config
#

iptableconf="
# Source: https://blog.donnex.net/docker-and-iptables-filtering/

*filter
:INPUT ACCEPT [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]
:DOCKER-USER - [0:0]

##
# INPUT
##

# Allow localhost
-A INPUT -i lo -j ACCEPT

# Allow established connections
-A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

# Allow ICMP ping
-A INPUT -p icmp -m icmp --icmp-type 8 -j ACCEPT

# SSH
-A INPUT -p tcp -m tcp --dport 22 -j ACCEPT

# Mosh
-A INPUT -p udp --match multiport --dports 60000:61000 -j ACCEPT

# INPUT default DROP
-A INPUT -j DROP

##
# DOCKER-USER rules
##

# Allow established connections
-A DOCKER-USER -i eth0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

# SMTP
-A DOCKER-USER -i eth0 -p tcp -m tcp --dport 25 -j ACCEPT

# http
-A DOCKER-USER -i eth0 -p tcp -m tcp --dport 80 -j ACCEPT
# https
-A DOCKER-USER -i eth0 -p tcp -m tcp --dport 443 -j ACCEPT

# DOCKER-USER default DROP
-A DOCKER-USER -i eth0 -j DROP

COMMIT
"

# http://articles.slicehost.com/assets/2007/9/4/iptables.txt
echo "$iptableconf" > ./iptables.conf

sudo mv ./iptables.conf /etc/

sudo iptables -F

sudo iptables-restore < /etc/iptables.conf

# Install iptables-persistent and keep ipv4 firewall
sudo apt-get install -y iptables-persistent


#
# Git
#
sudo apt-get install git -y

sudo apt-get install stow -y

git clone --recursive https://github.com/Nathan-Schwartz/dotfiles.git ~/dotfiles

stow -t ~ -d ~/dotfiles tmux vim bash git --ignore bashrc

cat ~/dotfiles/bash/.bashrc >> ~/.bashrc

path='$PATH'
echo "alias mysudo='sudo -E env \"PATH=$path\"'" >> ~/.bash_profile.local
unset path

source ~/.bash_profile

bash ~/dotfiles/scripts/install.sh

gitconfig="
[user]
  name = Nathan Schwartz
  email = nathan.schwartz95@gmail.com
"
echo "$gitconfig" > ~/.gitconfig.local



#
# Docker install
#

# https://www.itzgeek.com/how-tos/linux/debian/how-to-install-docker-on-debian-9.html

# Install the below packages to have “apt” get the support of https method.
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates wget software-properties-common

# Add the GPG key for Docker repository on your system.
wget https://download.docker.com/linux/debian/gpg
sudo apt-key add gpg

# Add the official Docker repository to the system by running below command in the terminal.
echo "deb [arch=amd64] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee -a /etc/apt/sources.list.d/docker.list

# Update the apt database.
sudo apt-get update

# Make sure you are installing Docker from the official repository, not from the default Debian repository.
sudo apt-cache policy docker-ce

# Install Docker using the “apt-get” command.
sudo apt-get -y install docker-ce

# To start Docker service:
sudo systemctl start docker

echo "You may want to log in to npm and git"
echo "NOTE: Mosh won't work correctly if ~/.bashrc exits immediately for non-interactive prompts."
