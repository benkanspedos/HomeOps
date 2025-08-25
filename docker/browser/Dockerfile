FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/New_York

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg2 \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    lsb-release \
    sudo \
    xvfb \
    x11vnc \
    fluxbox \
    novnc \
    websockify \
    supervisor \
    xterm \
    dbus-x11 \
    netcat \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    fonts-noto-color-emoji \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium as base (Comet is Chromium-based)
RUN apt-get update && apt-get install -y \
    chromium-browser \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create user for running browser
RUN useradd -m -s /bin/bash browser && \
    echo "browser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Setup VNC and noVNC
RUN mkdir -p /home/browser/.vnc /home/browser/.config/fluxbox /var/log/supervisor

# VNC password (change this in production)
RUN x11vnc -storepasswd homeops /home/browser/.vnc/passwd

# Fluxbox configuration for minimal desktop
RUN echo '[begin] (fluxbox)\n\
[encoding] {UTF-8}\n\
[exec] (Terminal) {xterm}\n\
[exec] (Browser) {/usr/bin/chromium-browser --no-sandbox --disable-dev-shm-usage}\n\
[separator]\n\
[exit] (Exit)\n\
[end]' > /home/browser/.config/fluxbox/menu

# Supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create startup script
COPY start.sh /home/browser/start.sh
RUN chmod +x /home/browser/start.sh

# Set ownership
RUN chown -R browser:browser /home/browser

# Expose ports
EXPOSE 5900 6080

# Switch to browser user
USER browser
WORKDIR /home/browser

# Start supervisor
CMD ["/home/browser/start.sh"]