#!/bin/bash

# Run as root.
# once! to setup a server to run our docker-compose based deploys
# Setup:
# docker
# docker compose
# timezone
# initial letsencrypt certificate
# the .. alias for cd .., because I lose so many seconds on just writing ..
# a psql alias which connects to the app-database-1 container and runs psql on the app database in it.
# firewall (ufw, which actually just let's through everything to docker networking...)

if [[ $# -eq 0 ]] ; then
    echo 'You need to provide one argument: The domain for which to prepare ssl via letsencrypt'
    exit 1
fi

# Domain for which to obtain certificate
DOMAIN=$1

hostnamectl set-hostname $DOMAIN

apt-get -y remove docker docker-engine docker.io containerd runc
apt-get -y update
apt-get -y install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -

add-apt-repository -y \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin


apt-get install -y rename

timedatectl set-timezone Europe/Berlin


echo "alias ..='cd ..'" >> ~/.bashrc
echo "alias ...='cd ...'" >> ~/.bashrc
echo "alias ....='cd ....'" >> ~/.bashrc
echo "alias .....='cd .....'" >> ~/.bashrc
source ~/.bashrc


echo "Getting letsencrypt certificate for $DOMAIN"

mkdir -p /opt/startuphafen/

echo "Including www.$DOMAIN in certificate"
DOMAIN_ARGS="-d $DOMAIN -d www.$DOMAIN"

docker run --rm --name certbot \
    -p 80:80 -p 443:443 \
    -v "/opt/startuphafen/certbot/conf/:/etc/letsencrypt" \
    certbot/certbot certonly \
    $DOMAIN_ARGS \
    --non-interactive \
    --standalone \
    --agree-tos \
    --email c.clausen@pct-digital.de

chmod -R +r /opt/startuphafen/certbot/conf
chmod +x /opt/startuphafen/certbot/conf/archive
chmod +x /opt/startuphafen/certbot/conf/live


# remember: right now ufw does not block any access at all to docker containers... !
# still write the correct rules out, just in case it starts working for it...

ufw default allow outgoing
ufw default deny incoming
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp