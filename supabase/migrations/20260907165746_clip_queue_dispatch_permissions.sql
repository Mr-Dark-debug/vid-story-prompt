begin;

-- Dispatch is an internal worker operation, not a browser or anonymous RPC.
-- The original queue migration inherited PostgreSQL's PUBLIC execute default.
-- claim_clip_task continues to dispatch as its definer; direct service callers
-- retain access. No queue data, leases or task scheduling behavior changes.
revoke all on function public.dispatch_clip_outbox(integer)
  from public, anon, authenticated;
grant execute on function public.dispatch_clip_outbox(integer) to service_role;

commit;
