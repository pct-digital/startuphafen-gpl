#!/bin/bash
set -e
set -o xtrace

/opt/keycloak/bin/kc.sh start --optimized --log-console-color=false
