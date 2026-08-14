# Optional Cobalt acquisition adapter

Vidrial can use a self-hosted Cobalt API as an optional extractor-level second opinion after the measured WARP paths are exhausted. It is not a guarantee against YouTube network blocks: a Cobalt instance still uses the network where it is deployed.

The image is pinned to the official `imputnet/cobalt` 11.7.1 image by digest. No Cobalt source is copied into the Vidrial worker and no modified Cobalt build is distributed. Cobalt remains a separate HTTP service under AGPL-3.0; see `THIRD_PARTY_NOTICES.md`.

## Security

The wrapper requires `COBALT_API_KEY` to be a newly generated UUIDv4. At startup it writes the upstream key-file schema to a private temporary file, limits the key to YouTube and the Vidrial worker user agent, enables `API_AUTH_REQUIRED=1`, removes the raw key from the child process environment, and starts the unmodified upstream server. Never commit the key.

Configure the same secret as `COBALT_API_KEY` on the video worker. Set `COBALT_API_URL` to the instance URL. The adapter rejects credentials in URLs, only accepts HTTPS returned media URLs, and sends downloads through the worker's existing SSRF, redirect, timeout, and size controls.

For Render, the root Blueprint and `render.example.yaml` show a free, public web service protected by the API key. The worker receives both the Render-managed external URL and the Cobalt service's key through `fromService`, so the secret is not duplicated in Git or copied into the browser environment. Render prompts for the new `sync: false` UUIDv4 only when the service is first created; for an existing Blueprint, add it to the new Cobalt service before syncing because Render ignores newly added `sync: false` values on an existing Blueprint.

On managed hosts such as Render, the wrapper binds Cobalt to the injected `PORT`; `API_PORT` remains the local/self-hosted fallback.

Render documents that free web services sleep and are not intended for production. A cold Cobalt service may take long enough to exceed the first worker request; the worker treats that as a bounded retryable fallback failure. Cobalt also uses its host's datacenter network and is extractor diversity, not a guarantee against provider blocking. A production operator can move the same service to paid/private compute without changing the worker adapter.

Generate a key with `node -e "console.log(crypto.randomUUID())"` and run the local contract smoke test with:

```sh
docker compose -f services/cobalt/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from smoke
```

The test verifies the current `GET /` health contract and that unauthenticated `POST /` requests are rejected. It does not depend on a live YouTube response.

After deployment, verify without printing the key:

1. `GET /` returns HTTP 200 from the Cobalt service.
2. The worker's bearer-protected `GET /health/proxy` returns `tiers.cobalt.state=ready`.
3. An unauthenticated `POST /` returns an authorization failure.
4. The worker event log records a sanitized `cobalt` source tier only after all bounded protected-path attempts are exhausted.
