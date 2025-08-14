#!/bin/bash

if [[ $# -eq 0 ]] ; then
    echo 'You need to provide one argument: "up", "down", "start", "stop" or "restart"'
    exit 1
fi

docker compose -f docker-compose.yml -f docker-compose-staging.yml -f docker-compose-db.yml  $1 $2

