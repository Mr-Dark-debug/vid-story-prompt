#!/bin/sh
set -eu

member=0
while [ "$member" -lt 3 ]; do
  port=$((8080 + member))
  trace="$(curl -fsS --max-time 10 -x "http://warp-proxy:${port}" https://cloudflare.com/cdn-cgi/trace/)"
  printf '%s\n' "$trace" | grep -Eq '^warp=(on|plus)$'
  echo "proxy=ok member=${member}"
  member=$((member + 1))
done
