#!/bin/bash
set -e
set -o xtrace

# SPI flags disable theme caching to save memory. Themes can be edited on-the-fly.
# This is useful for quick fixes in staging.
export JAVA_OPTS='-Xms256m -Xmx512m'
/opt/keycloak/bin/kc.sh start --optimized --spi-theme-static-max-age=-1 --spi-theme-cache-themes=false --spi-theme-cache-templates=false --log-console-color=false
