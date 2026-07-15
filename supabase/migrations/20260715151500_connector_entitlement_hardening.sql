begin;

-- Connection limits are enforced in PostgreSQL because OAuth callbacks and future
-- service integrations use elevated server credentials that bypass table RLS.
create or replace function public.enforce_connector_connection_entitlement()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_plan public.plans%rowtype;
  v_connected integer;
begin
  if new.status <> 'connected' then return new; end if;
  select p.* into v_plan
  from public.profiles pr join public.plans p on p.key=pr.plan_key
  where pr.id=new.user_id and p.active;
  if not found then raise exception 'active_plan_required' using errcode='P0001'; end if;
  if new.connector_id='s3' and not v_plan.s3_connector_enabled then
    raise exception 's3_requires_pro' using errcode='P0001';
  end if;
  select count(*) into v_connected from public.oauth_connections c
  where c.workspace_id=new.workspace_id and c.status='connected' and c.id<>new.id;
  if v_connected >= v_plan.max_connector_connections then
    raise exception 'connector_connection_limit' using errcode='P0001';
  end if;
  return new;
end;$$;

drop trigger if exists enforce_connector_connection_entitlement on public.oauth_connections;
create trigger enforce_connector_connection_entitlement
before insert or update of status,connector_id on public.oauth_connections
for each row execute function public.enforce_connector_connection_entitlement();

create or replace function public.enforce_automation_rule_entitlement()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_plan public.plans%rowtype;
  v_rules integer;
begin
  select p.* into v_plan
  from public.profiles pr join public.plans p on p.key=pr.plan_key
  where pr.id=new.user_id and p.active;
  if not found then raise exception 'active_plan_required' using errcode='P0001'; end if;
  select count(*) into v_rules from public.automation_rules r
  where r.workspace_id=new.workspace_id and r.id<>new.id;
  if v_rules >= v_plan.max_automation_rules then
    raise exception 'automation_rule_limit' using errcode='P0001';
  end if;
  return new;
end;$$;

drop trigger if exists enforce_automation_rule_entitlement on public.automation_rules;
create trigger enforce_automation_rule_entitlement
before insert on public.automation_rules
for each row execute function public.enforce_automation_rule_entitlement();

-- Remote source URLs and queue task input may contain expiring provider
-- references. They are only read through authenticated server functions.
revoke select on public.connector_imports,public.connector_tasks from authenticated;

revoke all on function public.enforce_connector_connection_entitlement(),
 public.enforce_automation_rule_entitlement() from public,anon,authenticated;

commit;
