# Original motion examples

`prompts.json` contains twenty Vidrial-authored briefs: two for every category in the domain registry. Exact wording, fictional examples and disclosures are original. The examples do not claim that Claude or another provider generated them.

The renderer writes verified local demo files to `public/motion-demos/{slug}.mp4` and `.jpg`, then writes `assets.json` as a map of slug to `{ videoUrl, posterUrl, width, height, durationSeconds }`. A missing entry displays “Preview not yet rendered”; the UI never invents a completed film or VideoObject.

Run `node scripts/seed-motion-gallery.mjs` to validate the complete manifest against actual files and FFprobe. It checks H.264/yuv420p, dimensions, duration and size before any external write. Set `FFPROBE_PATH` if FFprobe is not on PATH.

For an explicitly intended deployed environment, `node scripts/seed-motion-gallery.mjs --publish` uses `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. It inserts pending official rows, uploads immutable UUID assets to the dedicated public gallery bucket, and invokes the service-only approval RPC that checks object existence. An upload does not itself publish a prompt. Approved existing rows are preserved, including their real counters; a provenance/content collision fails closed. Failed uploads can leave unlisted objects for operational cleanup, never a fabricated approved preview.

All counters start at zero. Community submissions follow their own license and moderation path; this seed tool cannot adopt or overwrite community slugs. Running a local manifest validation does not establish production provider or worker verification.
