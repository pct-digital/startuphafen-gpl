#!/bin/bash

set -o xtrace

# necessary so that if any command errors the bash script will stop and return an error to the CI runner
set -e


# It is a clean build
rm -rf dist

echo "npm version:"
npm --version

echo "which node:"
which node

echo "Node version:"
node --version

echo "Node path:"
which node

echo "User:"
id

echo "Typescript version:"

tsc --version

nx run startuphafen-frontend:build:production
nx run startuphafen-backend:build:production

echo "Running npm ci to install dependencies of the server applications. If this hangs forever check if disabling ivp6 on your machine helps. See google npm install vs ipv6"
npm ci --prefix ./dist/apps/startuphafen-backend --loglevel error
