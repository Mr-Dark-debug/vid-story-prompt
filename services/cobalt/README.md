# Optional Cobalt acquisition adapter

Vidrial can use a self-hosted Cobalt API as an optional extractor-level second opinion after the measured WARP paths are exhausted. It is not a guarantee against YouTube network blocks: a Cobalt instance still uses the network where it is deployed.

The image is pinned to the official `imputnet/cobalt` 11.7.1 image by digest. No Cobalt source is copied into the Vidrial worker and no modified Cobalt build is distributed. Cobalt remains a separate HTTP service under AGPL-3.0; see `THIRD_PARTY_NOTICES.md`.

## Security

The wrapper requires `COBALT_API_KEY` to be a newly generated UUIDv4. At startup it writes the upstream key-file schema to a private temporary file, limits the key to YouTube and the Vidrial worker user agent, enables `API_AUTH_REQUIRED=1`, removes the raw key from the child process environment, and starts the unmodified upstream server. Never commit the key.

Configure the same secret as `COBALT_API_KEY` on the video worker. Set `COBALT_API_URL` to the instance URL. The adapter rejects credentials in URLs, only accepts HTTPS returned media URLs, and sends downloads through the worker's existing SSRF, redirect, timeout, and size controls.

For Render, `render.example.yaml` shows a free, public web service protected by the API key. Render documents that free web services sleep and are not intended for production, so this service is deliberately optional and is not part of the root production Blueprint. A production operator can use paid/private compute or deploy the same image elsewhere without changing the worker.

Generate a key with `node -e "console.log(crypto.randomUUID())"` and run the local contract smoke test with:

```sh
docker compose -f services/cobalt/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from smoke
```

The test verifies the current `GET /` health contract and that unauthenticated `POST /` requests are rejected. It does not depend on a live YouTube response.
