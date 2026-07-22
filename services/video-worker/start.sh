#!/bin/sh
set -eu

pot_pid=""
warp_pids=""
worker_pid=""

stop_children() {
  for pid in "$worker_pid" $warp_pids "$pot_pid"; do
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
  && [ -z "${WARP_POOL_URLS:-}" ] \
  && [ -z "${WARP_PROXY_HOST:-}" ]; then
  pool_size="${WARP_POOL_SIZE:-1}"
  proxy_port="${WARP_POOL_BASE_PORT:-${EMBEDDED_WARP_PROXY_PORT:-8080}}"
  start_timeout="${EMBEDDED_WARP_START_TIMEOUT_SECONDS:-60}"
  data_dir="${EMBEDDED_WARP_DATA_DIR:-/tmp/vidrial-warp}"

  case "$pool_size" in
    1|2|3|4) ;;
    *) echo "proxy=failed tier=embedded_warp reason=invalid_pool_size" >&2; exit 1 ;;
  esac

  mkdir -p "$data_dir"
  chmod 0700 "$data_dir"
  pool_urls=""
  member=0
  while [ "$member" -lt "$pool_size" ]; do
    member_dir="${data_dir}/member-${member}"
    member_port=$((proxy_port + member))
    mkdir -p "$member_dir"
    chmod 0700 "$member_dir"
    if [ ! -s "$member_dir/reg.json" ]; then
      warp generate --data-dir "$member_dir" --loglevel error >/dev/null
    fi
    warp run --data-dir "$member_dir" --loglevel info --4 \
      --http-addr "127.0.0.1:${member_port}" &
    member_pid=$!
    warp_pids="$warp_pids $member_pid"

    elapsed=0
    until trace="$(curl -fsS --max-time 5 -x "http://127.0.0.1:${member_port}" \
      https://cloudflare.com/cdn-cgi/trace/)" \
      && printf '%s\n' "$trace" | grep -Eq '^warp=(on|plus)$'; do
      if ! kill -0 "$member_pid" 2>/dev/null; then
        echo "proxy=failed tier=embedded_warp member=${member} reason=warp_process_exited" >&2
        exit 1
      fi
      if [ "$elapsed" -ge "$start_timeout" ]; then
        echo "proxy=failed tier=embedded_warp member=${member} reason=warp_connect_timeout" >&2
        exit 1
      fi
      sleep 1
      elapsed=$((elapsed + 1))
    done
    member_url="http://127.0.0.1:${member_port}"
    pool_urls="${pool_urls}${pool_urls:+,}${member_url}"
    member=$((member + 1))
  done

  export WARP_POOL_URLS="$pool_urls"
  export WARP_PROXY_URL="http://127.0.0.1:${proxy_port}"
  echo "proxy=ok tier=embedded_warp configured_members=${pool_size}"
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
