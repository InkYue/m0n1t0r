#!/bin/sh
set -e

nginx

exec /app/m0n1t0r-server \
    --key /app/certs/end.key \
    --cert /app/certs/end.crt \
    --conn-addr 0.0.0.0:27853 \
    --api-addr 0.0.0.0:10801 \
    --log-level info
