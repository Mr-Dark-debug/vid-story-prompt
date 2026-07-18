#!/bin/sh
set -eu

HTTP_PROXY_PORT="${HTTP_PROXY_PORT:-8080}"
WARP_START_TIMEOUT_SECONDS="${WARP_START_TIMEOUT_SECONDS:-45}"
WARP_DATA_DIR="${WARP_DATA_DIR:-/var/lib/cloudflare-warp}"

mkdir -p "$WARP_DATA_DIR"
chmod 0700 "$WARP_DATA_DIR"

if [ ! -s "$WARP_DATA_DIR/reg.json" ]; then
  warp generate --data-dir "$WARP_DATA_DIR" --loglevel error >/dev/null
fi

warp run --data-dir "$WARP_DATA_DIR" --loglevel info --4 \
  --http-addr "0.0.0.0:${HTTP_PROXY_PORT}" &
warp_pid=$!

cleanup() {
  kill "${health_pid:-}" "$warp_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

elapsed=0
until curl -fsS --max-time 5 -x "http://127.0.0.1:${HTTP_PROXY_PORT}" \
  https://cloudflare.com/cdn-cgi/trace/ | grep -Eq '^warp=(on|plus)$'; do
  if ! kill -0 "$warp_pid" 2>/dev/null; then
    echo "proxy=failed reason=warp_process_exited" >&2
    exit 1
  fi
  if [ "$elapsed" -ge "$WARP_START_TIMEOUT_SECONDS" ]; then
    echo "proxy=failed reason=warp_connect_timeout" >&2
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

socat "TCP-LISTEN:${PORT:-8081},fork,reuseaddr" EXEC:/usr/local/bin/health-response.sh &
health_pid=$!

trace="$(curl -fsS --max-time 5 -x "http://127.0.0.1:${HTTP_PROXY_PORT}" https://cloudflare.com/cdn-cgi/trace/)"
egress_ip="$(printf '%s\n' "$trace" | awk -F= '$1 == "ip" { print $2; exit }')"
case "$egress_ip" in
  *:*) redacted_ip="ipv6" ;;
  *.*) redacted_ip="$(printf '%s' "$egress_ip" | awk -F. '{print $1"."$2".x.x"}')" ;;
  *) redacted_ip="unknown" ;;
esac
echo "proxy=ok egress_ip=${redacted_ip}"

wait "$warp_pid"
