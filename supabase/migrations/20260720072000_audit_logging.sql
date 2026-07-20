-- Append-only audit support for administrative mutations.

create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_new jsonb;
  v_organization_id uuid;
  v_record_id uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
  else
    v_old := to_jsonb(old);
    v_row := v_old;
  end if;

  if tg_table_name = 'organizations' then
    v_organization_id := nullif(v_row ->> 'id', '')::uuid;
  else
    v_organization_id := nullif(v_row ->> 'organization_id', '')::uuid;
  end if;

  v_record_id := nullif(v_row ->> 'id', '')::uuid;

  -- External billing identifiers and arbitrary metadata are intentionally
  -- excluded from audit snapshots. Audit rows contain no survey free text.
  v_old := coalesce(v_old, '{}'::jsonb)
    - 'provider_customer_id'
    - 'provider_subscription_id'
    - 'metadata';
  v_new := coalesce(v_new, '{}'::jsonb)
    - 'provider_customer_id'
    - 'provider_subscription_id'
    - 'metadata';

  insert into public.audit_logs (
    organization_id,
    actor_id,
    actor_database_role,
    action,
    table_name,
    record_id,
    request_id,
    changed_data
  ) values (
    v_organization_id,
    auth.uid(),
    current_user,
    tg_op,
    tg_table_name,
    v_record_id,
    nullif(current_setting('request.headers', true)::jsonb ->> 'x-request-id', ''),
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  return coalesce(new, old);
exception
  when invalid_text_representation then
    -- Request headers are optional in direct SQL and local seed sessions.
    insert into public.audit_logs (
      organization_id,
      actor_id,
      actor_database_role,
      action,
      table_name,
      record_id,
      changed_data
    ) values (
      v_organization_id,
      auth.uid(),
      current_user,
      tg_op,
      tg_table_name,
      v_record_id,
      jsonb_build_object('old', v_old, 'new', v_new)
    );

    return coalesce(new, old);
end;
$$;

create function public.reject_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit logs are append-only' using errcode = '55000';
end;
$$;

create trigger audit_logs_reject_update
before update on public.audit_logs
for each row execute function public.reject_audit_log_mutation();

create trigger audit_logs_reject_delete
before delete on public.audit_logs
for each row execute function public.reject_audit_log_mutation();

create trigger organizations_audit
after insert or update or delete on public.organizations
for each row execute function public.write_audit_log();
create trigger organization_memberships_audit
after insert or update or delete on public.organization_memberships
for each row execute function public.write_audit_log();
create trigger locations_audit
after insert or update or delete on public.locations
for each row execute function public.write_audit_log();
create trigger location_memberships_audit
after insert or update or delete on public.location_memberships
for each row execute function public.write_audit_log();
create trigger surveys_audit
after insert or update or delete on public.surveys
for each row execute function public.write_audit_log();
create trigger survey_questions_audit
after insert or update or delete on public.survey_questions
for each row execute function public.write_audit_log();
create trigger survey_question_options_audit
after insert or update or delete on public.survey_question_options
for each row execute function public.write_audit_log();
create trigger survey_responses_delete_audit
after delete on public.survey_responses
for each row execute function public.write_audit_log();
create trigger alerts_audit
after insert or update or delete on public.alerts
for each row execute function public.write_audit_log();
create trigger subscriptions_audit
after insert or update or delete on public.subscriptions
for each row execute function public.write_audit_log();

comment on table public.audit_logs is
  'Append-only administrative audit records. Never store response free text or secrets.';
