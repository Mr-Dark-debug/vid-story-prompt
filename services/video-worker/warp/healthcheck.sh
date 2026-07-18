#!/bin/sh
set -eu

curl -fsS --max-time 5 -x "http://127.0.0.1:${HTTP_PROXY_PORT:-8080}" \
  https://cloudflare.com/cdn-cgi/trace/ | grep -Eq '^warp=(on|plus)$'
