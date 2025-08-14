#!/bin/bash

if [[ $# -eq 0 ]] ; then
    echo 'You need to provide one argument: "up", "down", "start", "stop" or "restart"'
    exit 1
fi

docker compose -f docker-maintenance.yml $1 $2

