FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && curl -sSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb \
    && apt-get -y install /tmp/chrome.deb

RUN apt-get update && apt-get -y install xvfb
RUN mkdir /home/node/.vnc && chown -R node:node /home/node/.vnc/ && echo "SecurityTypes=None" > /home/node/.vnc/config
RUN echo 'alias ll="ls -alF"' >> /home/node/.bashrc