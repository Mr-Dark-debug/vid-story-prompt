#!/bin/sh

if /usr/local/bin/healthcheck.sh >/dev/null 2>&1; then
  status='200 OK'
  body="{\"status\":\"ok\",\"warp_enabled\":true,\"configured_members\":${WARP_POOL_SIZE:-1}}"
else
  status='503 Service Unavailable'
  body="{\"status\":\"blocked\",\"warp_enabled\":false,\"configured_members\":${WARP_POOL_SIZE:-1}}"
fi

printf 'HTTP/1.1 %s\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: %s\r\nConnection: close\r\n\r\n%s' \
  "$status" "${#body}" "$body"
