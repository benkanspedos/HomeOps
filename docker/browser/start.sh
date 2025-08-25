#!/bin/bash

# Create necessary directories
mkdir -p /home/browser/.vnc
mkdir -p /home/browser/Downloads
mkdir -p /home/browser/logs

# Set display
export DISPLAY=:1

# Start supervisor with user-writable log location
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf