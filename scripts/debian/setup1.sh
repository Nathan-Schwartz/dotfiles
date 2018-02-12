[ -z "$DESIRED_ACCOUNT_NAME" ] && echo "Need to set DESIRED_ACCOUNT_NAME" && exit 1;

# This file is intended to be run as root

# General updates
apt-get update && apt-get upgrade -y

# Set timezone
dpkg-reconfigure tzdata

# Configure user
apt install sudo

# This will prompt for password and contact info
adduser $DESIRED_ACCOUNT_NAME

adduser $DESIRED_ACCOUNT_NAME sudo

echo "Exit and login as the new user before running the next script"
