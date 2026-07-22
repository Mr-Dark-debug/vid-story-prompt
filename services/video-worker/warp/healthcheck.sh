#!/bin/sh
set -eu

base_port="${WARP_POOL_BASE_PORT:-${HTTP_PROXY_PORT:-8080}}"
pool_size="${WARP_POOL_SIZE:-1}"
member=0
while [ "$member" -lt "$pool_size" ]; do
  port=$((base_port + member))
  curl -fsS --max-time 5 -x "http://127.0.0.1:${port}" \
    https://cloudflare.com/cdn-cgi/trace/ | grep -Eq '^warp=(on|plus)$'
  member=$((member + 1))
done
