#!/bin/sh
set -e

trap 'kill $node_pid; kill $nginx_pid; wait $node_pid; wait $nginx_pid' TERM INT

nginx -g 'daemon off;' &
nginx_pid=$!

su-exec node node /app/server.js &
node_pid=$!

wait $node_pid $nginx_pid
