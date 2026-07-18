# Vidrial WARP proxy

This private service runs a pinned, MIT-licensed user-space WARP client and exposes its HTTP CONNECT proxy on port `8080`. A separate private health listener on port `8081` lets Render verify actual WARP egress.

## Why a user-space implementation

Cloudflare's official Linux daemon and the referenced `cmj2002/warp-docker` pattern require the `NET_ADMIN` container capability. Render Blueprints do not expose a capability-grant field, so that image cannot be made reliable on Render's unprivileged service runtime. The referenced repository is also GPL-3.0, not MIT.

This image instead builds [shahradelahi/cloudflare-warp](https://github.com/shahradelahi/cloudflare-warp) at the immutable commit recorded in the Dockerfile. That implementation is MIT-licensed, performs WireGuard networking entirely in user space, and exposes HTTP and SOCKS proxies without a TUN device or elevated kernel capabilities. No source code is copied into this repository; the pinned source is compiled in an isolated build stage and only the static binary enters the Alpine runtime image.

Proxy mode limits WARP routing to callers that explicitly select this proxy and avoids routing Supabase, storage, transcription, and AI-provider traffic through WARP.

## Local smoke test

```sh
docker compose -f services/video-worker/warp/docker-compose.test.yml up \
  --build --abort-on-container-exit --exit-code-from smoke
```

Success ends with `proxy=ok egress_ip=<redacted-prefix>` and exit code 0. The egress IP is deliberately redacted in logs.

This test requires Docker and outbound access to Cloudflare. The current Windows development host did not have a Docker executable during implementation, so production health must not be inferred from the image build alone.

## Render

The Blueprint deploys `vidrial-warp-proxy` as a private service in Frankfurt and persists `/var/lib/cloudflare-warp` to avoid a new consumer registration on every revision. Render private services require a paid instance plan even though WARP access and this implementation are free.

The worker receives the service's Render-managed private hostname and connects to port `8080`. If WARP registration or the user-space tunnel fails, the container fails health and the worker fails closed instead of silently using direct egress.

## Operations and limits

- Review and accept Cloudflare's applicable terms before deploying this image for an organization.
- Do not automate registration rotation or use WARP to evade service limits.
- WARP can be blocked, limited, or changed without notice and is not a production SLA.
- `YTDLP_PROXY_URL` remains the operator override for an approved alternative proxy.
- Private, age-restricted, region-locked, removed, or unauthorized media remains unsupported.
