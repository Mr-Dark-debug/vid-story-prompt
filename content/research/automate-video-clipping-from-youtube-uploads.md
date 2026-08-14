# Research notes: Automate video clipping from YouTube uploads

Checked 2026-07-31. Backlog ID 57. Official YouTube sources cover push notifications, Data API resources, server OAuth, developer policies, and resumable uploads. Key fact: notifications contain identifiers/metadata, not source media; duplicate upload/metadata events require idempotency.

The article adds a staged state model, source-recovery boundary, and permission separation. It avoids cookie/circumvention advice and never equates channel connection with media-download or publishing permission.

Vidrial truth from `docs/AUTOMATIONS.md` and `docs/YOUTUBE_CLIPPER.md`: YouTube channel upload trigger is the only executable automation now. Detected uploads remain awaiting source unless an authorised original/matching Vidrial-published asset exists. Publishing scope is incremental.

Review webhook renewal, current YouTube policy, source recovery, and production verification before publication.

