#!/bin/sh
set -eu

trace="$(curl -fsS --max-time 10 -x http://warp-proxy:8080 https://cloudflare.com/cdn-cgi/trace/)"
printf '%s\n' "$trace" | grep -Eq '^warp=(on|plus)$'
egress_ip="$(printf '%s\n' "$trace" | awk -F= '$1 == "ip" { print $2; exit }')"
case "$egress_ip" in
  *:*) redacted_ip='ipv6' ;;
  *.*) redacted_ip="$(printf '%s' "$egress_ip" | awk -F. '{print $1"."$2".x.x"}')" ;;
  *) redacted_ip='unknown' ;;
esac
echo "proxy=ok egress_ip=${redacted_ip}"
