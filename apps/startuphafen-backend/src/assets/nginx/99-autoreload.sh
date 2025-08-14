#!/bin/sh

#https://stackoverflow.com/a/72529595

while :; do
    sleep 6h
    nginx -t && nginx -s reload
done &