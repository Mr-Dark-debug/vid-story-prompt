# Privacy model

Private media is never placed in public buckets. Signed URLs expire after five minutes by default. Workspace RLS controls database and Storage access. The worker uses service credentials only in its server environment and redacts secrets.

Rights attestations retain the user/workspace/job, source identifier, statement/policy versions and acceptance time. Feature-specific plain IP retention is not used; the anonymous metadata limiter hashes an address in process memory and does not persist it. Product analytics receives consented event names and coarse duration/size buckets, never source media, transcripts, filenames or private URLs.

Media retention is seven, thirty or ninety days by plan. Immediate deletion cancels work and queues private-object removal. Legally necessary billing and audit records may remain without media content.
