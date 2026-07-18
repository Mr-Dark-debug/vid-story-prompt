#!/bin/sh
set -eu

pot_pid=""
warp_pid=""
worker_pid=""

stop_children() {
  for pid in "$worker_pid" "$warp_pid" "$pot_pid"; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap stop_children EXIT INT TERM

node /opt/bgutil-ytdlp-pot-provider/server/build/main.js --port 4416 &
pot_pid=$!

if [ "${ENABLE_EMBEDDED_WARP:-false}" = "true" ] \
  && [ -z "${YTDLP_PROXY_URL:-}" ] \
  && [ -z "${WARP_PROXY_URL:-}" ] \
  && [ -z "${WARP_PROXY_HOST:-}" ]; then
  proxy_port="${EMBEDDED_WARP_PROXY_PORT:-8080}"
  start_timeout="${EMBEDDED_WARP_START_TIMEOUT_SECONDS:-60}"
  data_dir="${EMBEDDED_WARP_DATA_DIR:-/tmp/vidrial-warp}"

  mkdir -p "$data_dir"
  chmod 0700 "$data_dir"
  if [ ! -s "$data_dir/reg.json" ]; then
    warp generate --data-dir "$data_dir" --loglevel error >/dev/null
  fi
  warp run --data-dir "$data_dir" --loglevel info --4 \
    --http-addr "127.0.0.1:${proxy_port}" &
  warp_pid=$!

  elapsed=0
  until trace="$(curl -fsS --max-time 5 -x "http://127.0.0.1:${proxy_port}" \
    https://cloudflare.com/cdn-cgi/trace/)" \
    && printf '%s\n' "$trace" | grep -Eq '^warp=(on|plus)$'; do
    if ! kill -0 "$warp_pid" 2>/dev/null; then
      echo "proxy=failed tier=embedded_warp reason=warp_process_exited" >&2
      exit 1
    fi
    if [ "$elapsed" -ge "$start_timeout" ]; then
      echo "proxy=failed tier=embedded_warp reason=warp_connect_timeout" >&2
      exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  export WARP_PROXY_URL="http://127.0.0.1:${proxy_port}"
  echo "proxy=ok tier=embedded_warp"
fi

node dist/index.js &
worker_pid=$!
if wait "$worker_pid"; then
  status=0
else
  status=$?
fi
stop_children
wait 2>/dev/null || true
exit "$status"
