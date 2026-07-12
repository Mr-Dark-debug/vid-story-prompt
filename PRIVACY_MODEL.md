# Vidrial Privacy Model

## Principles

1. **Minimum viable data.** We collect only what the product needs to
   function.
2. **User owns the source.** All processing is scoped to workspaces the
   user belongs to; RLS enforces this at the database.
3. **Transparent processing.** Every AI operation is logged as an
   explainable plan the user can review.
4. **Retention with intent.** Sources and renders expire on a documented
   schedule per plan.

## Data categories

| Category | Examples | Storage | Retention |
| --- | --- | --- | --- |
| Account | email, name, workspace membership | Supabase `auth.users`, `profiles` | Until account deletion |
| Source media | authorised uploads, owner-controlled URLs | Supabase Storage (private) | Per plan (7–90 days) |
| Transcripts | Whisper output, edited captions | Postgres (workspace-scoped) | With clip job |
| Renders | exported clips | Supabase Storage (signed URLs) | Per plan |
| Usage | job counts, minutes processed | Postgres | 24 months rolling |
| Billing | plan, invoices (via Stripe) | Stripe + Postgres pointers | As required by law |
| Analytics | pageviews, feature events | Aggregate only | 12 months |

## What we never store

- Raw YouTube video bytes we did not receive from an authorised source
- Third-party OAuth refresh tokens outside encrypted secret storage
- Model provider prompts/responses beyond what the user sees in-product

## Access controls

- Row-Level Security on every user-owned table (workspace scoped)
- Private Storage buckets; access only via signed URLs from server functions
- Service-role credentials only in server/worker runtimes
- Least-privilege GRANTs on Data API roles (`anon`, `authenticated`)

## Object path convention

`{workspace_id}/{user_id}/{job_id}/{asset_type}/{uuid}.{extension}` — immutable.

## Sharing

- Signed URLs are short-lived (default 15 min) and single-purpose.
- No public buckets. Public marketing assets ship with the app bundle.

## Third parties

| Service | Purpose | Data shared |
| --- | --- | --- |
| Supabase | Auth, DB, Storage | All product data |
| Cloudflare | Edge runtime, Turnstile | Request metadata |
| Groq / OpenAI | Whisper transcription | Audio extracted from user source |
| OpenRouter | Plan generation | Transcript excerpts, prompts |
| Stripe | Payments | Billing identifiers only |
| YouTube Data API | Metadata only | Public video IDs |

## User rights

- Export all workspace data on request
- Delete account → cascade delete of user-owned rows and storage objects
- Withdraw analytics consent via cookie banner

## Incident response

See `docs/RUNBOOK.md`. Notify affected users within 72 hours of confirmed
breach involving personal data.
# Privacy model

Private media is never placed in public buckets. Signed URLs expire after five minutes by default. Workspace RLS controls database and Storage access. The worker uses service credentials only in its server environment and redacts secrets.

Rights attestations retain the user/workspace/job, source identifier, statement/policy versions and acceptance time. Feature-specific plain IP retention is not used; the anonymous metadata limiter hashes an address in process memory and does not persist it. Product analytics receives consented event names and coarse duration/size buckets, never source media, transcripts, filenames or private URLs.

Media retention is seven, thirty or ninety days by plan. Immediate deletion cancels work and queues private-object removal. Legally necessary billing and audit records may remain without media content.
