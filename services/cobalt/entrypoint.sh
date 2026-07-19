#!/bin/sh
set -eu

if [ -z "${COBALT_API_KEY:-}" ]; then
  echo "cobalt=failed reason=missing_api_key" >&2
  exit 1
fi

node -e '
const { writeFileSync } = require("node:fs");
const key = process.env.COBALT_API_KEY;
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key ?? "")) {
  process.stderr.write("cobalt=failed reason=api_key_must_be_uuid_v4\n");
  process.exit(1);
}
writeFileSync(
  "/tmp/vidrial-cobalt-keys.json",
  JSON.stringify({
    [key]: {
      name: "vidrial-video-worker",
      limit: "unlimited",
      userAgents: ["Vidrial-Video-Worker/*"],
      allowedServices: ["youtube"]
    }
  }),
  { mode: 0o600 }
);
'

export API_KEY_URL="file:///tmp/vidrial-cobalt-keys.json"
export API_AUTH_REQUIRED=1
unset COBALT_API_KEY

exec "$@"
