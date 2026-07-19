# Vidrial local acquisition helper

The helper is the free recovery path for a rights-attested YouTube job when every cloud egress is blocked. It runs `yt-dlp` and FFmpeg on the user's device, uploads only the resulting job-scoped media file through a short-lived signed URL, and resumes the same Vidrial job asynchronously.

Requirements: Node.js 22+, current yt-dlp, and FFmpeg on `PATH`. Build with `npm install && npm run helper:build` from the repository root.

1. In the blocked job, choose **Continue on this device** and create a pairing token.
2. Pair once: `node services/acquisition-helper/dist/index.js pair --server https://vidrial.vercel.app --token CODE.CHALLENGE`
3. Keep the helper online: `node services/acquisition-helper/dist/index.js run`

Credentials are stored with owner-only permissions under `~/.vidrial/relay.json`. Set `VIDRIAL_RELAY_CONFIG` to choose another path. The helper polls one device-scoped lease, heartbeats throughout both download and upload, obeys exact clip sections and size bounds, enforces MP4 output, uses idempotent callbacks, and deletes temporary media after completion or failure. Each acquisition and upload has a 30-minute safety timeout.

The default is cookie-free. Advanced users may pass `--cookies /path/to/cookies.txt`; the cookie file stays on the local device and is supplied only to local yt-dlp. Browser cookies are full account credentials and authenticated downloads can trigger account restrictions, so use this only when necessary. Private, paid, DRM, age-restricted, and region-restricted content remains unsupported.
