FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

# Install Chrome/Chromium based on architecture
# - x86_64 (amd64): Install Google Chrome
# - ARM64 (Apple Silicon Macs): Install Chromium (Chrome not available for ARM64 Linux)
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "amd64" ]; then \
        curl -sSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb \
        && apt-get -y install /tmp/chrome.deb \
        && rm /tmp/chrome.deb; \
    elif [ "$ARCH" = "arm64" ]; then \
        apt-get -y install chromium \
        && ln -sf /usr/bin/chromium /usr/bin/google-chrome; \
    fi

RUN apt-get update && apt-get -y install xvfb
RUN mkdir /home/node/.vnc && chown -R node:node /home/node/.vnc/ && echo "SecurityTypes=None" > /home/node/.vnc/config
RUN echo 'alias ll="ls -alF"' >> /home/node/.bashrc