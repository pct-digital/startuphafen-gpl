#!/bin/bash
set -e
set -o xtrace

# SPI flags disable theme caching. This results in worse performance, but themes can be edited on-the-fly.
# This is useful for work on themes inside the dev container and for quick fixes in staging.
/opt/keycloak/bin/kc.sh start --verbose --optimized --import-realm --spi-theme-static-max-age=-1 --spi-theme-cache-themes=false --spi-theme-cache-templates=false --log-console-color=false
