# Internal Python acquisition API

This loopback-only FastAPI process is the YouTube media execution engine for the Vidrial video worker. The Node worker remains responsible for authorization, plan lookup, durable queue leases, retry tiers, storage, and media validation.

The API never returns video bytes. `POST /v1/downloads` returns HTTP 202, `GET /v1/downloads/{id}` reports state and final local artifact metadata, and `DELETE` requests cancellation. The shared file is accepted only beneath `VIDRIAL_ACQUISITION_ROOT` and is validated again by Node before upload.

Run tests from this directory with:

```sh
python -m pytest tests -q
```

This service is intentionally not deployed to Vercel or exposed publicly. It is packaged into the existing Render worker image so it shares the protected WARP egress and avoids an additional sleeping service.
