-- This isolated fixture has no events. It tests the real dispatcher ACL and
-- execution boundary without claiming to exercise managed pgmq transport.
begin;
do $$ begin
  if has_function_privilege('anon','public.dispatch_clip_outbox(integer)','execute')
    or has_function_privilege('authenticated','public.dispatch_clip_outbox(integer)','execute') then
    raise exception 'Queue dispatcher is exposed to non-worker roles';
  end if;
  if not has_function_privilege('service_role','public.dispatch_clip_outbox(integer)','execute') then
    raise exception 'Worker lost dispatcher access';
  end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.dispatch_clip_outbox(1);
    raise exception 'Anonymous queue dispatch succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.dispatch_clip_outbox(1);
    raise exception 'Browser queue dispatch succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  if public.dispatch_clip_outbox(1) <> 0 then
    raise exception 'Unexpected events in empty dispatch fixture';
  end if;
end $$;
reset role;
rollback;
