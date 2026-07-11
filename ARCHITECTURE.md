# Architecture

TanStack Start serves the marketing and authenticated application on Vercel/Lovable-compatible Nitro output. Supabase provides Auth, PostgreSQL, Realtime, private Storage and PGMQ. Cookie-backed server clients verify users; service-role clients exist only in trusted server/worker modules.

Job creation atomically checks workspace, plan, usage and concurrency; records rights; reserves usage; creates a task; and writes an outbox event. PGMQ wakes a portable worker while `job_tasks` remains authoritative for leases, retries, recovery and idempotency. The worker streams immutable artifacts through isolated temp directories and executes FFmpeg with argument arrays.

See `docs/adr/0001-external-video-worker.md` for the worker placement decision.
