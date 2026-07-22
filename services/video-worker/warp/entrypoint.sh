#!/bin/sh
set -eu

HTTP_PROXY_PORT="${WARP_POOL_BASE_PORT:-${HTTP_PROXY_PORT:-8080}}"
WARP_POOL_SIZE="${WARP_POOL_SIZE:-1}"
WARP_START_TIMEOUT_SECONDS="${WARP_START_TIMEOUT_SECONDS:-45}"
WARP_DATA_DIR="${WARP_DATA_DIR:-/var/lib/cloudflare-warp}"

case "$WARP_POOL_SIZE" in
  1|2|3|4) ;;
  *) echo "proxy=failed reason=invalid_pool_size" >&2; exit 1 ;;
esac

mkdir -p "$WARP_DATA_DIR"
chmod 0700 "$WARP_DATA_DIR"

warp_pids=""

cleanup() {
  for pid in "${health_pid:-}" $warp_pids; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

member=0
while [ "$member" -lt "$WARP_POOL_SIZE" ]; do
  member_dir="${WARP_DATA_DIR}/member-${member}"
  member_port=$((HTTP_PROXY_PORT + member))
  mkdir -p "$member_dir"
  chmod 0700 "$member_dir"
  if [ ! -s "$member_dir/reg.json" ]; then
    warp generate --data-dir "$member_dir" --loglevel error >/dev/null
  fi
  warp run --data-dir "$member_dir" --loglevel info --4 \
    --http-addr "0.0.0.0:${member_port}" &
  member_pid=$!
  warp_pids="$warp_pids $member_pid"
  elapsed=0
  until curl -fsS --max-time 5 -x "http://127.0.0.1:${member_port}" \
    https://cloudflare.com/cdn-cgi/trace/ | grep -Eq '^warp=(on|plus)$'; do
    if ! kill -0 "$member_pid" 2>/dev/null; then
      echo "proxy=failed member=${member} reason=warp_process_exited" >&2
      exit 1
    fi
    if [ "$elapsed" -ge "$WARP_START_TIMEOUT_SECONDS" ]; then
      echo "proxy=failed member=${member} reason=warp_connect_timeout" >&2
      exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  member=$((member + 1))
done

socat "TCP-LISTEN:${PORT:-8081},fork,reuseaddr" EXEC:/usr/local/bin/health-response.sh &
health_pid=$!

echo "proxy=ok configured_members=${WARP_POOL_SIZE}"

wait $(printf '%s' "$warp_pids" | awk '{print $1}')
