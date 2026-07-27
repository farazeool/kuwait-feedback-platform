-- Fix get_signature_subject_report: guard subject_id::uuid casts with CASE
-- to avoid "invalid input syntax for type uuid" when subject_id is a non-UUID
-- generic string (e.g. "branch-a"). Postgres evaluates JOIN ON expressions
-- before the type-guard condition filters rows, so the cast must be inside CASE.

create or replace function public.get_signature_subject_report(
  p_organization_id uuid,
  p_start_at        timestamptz,
  p_end_at          timestamptz,
  p_subject_type    text    default null,
  p_template_id     uuid    default null,
  p_location_id     uuid    default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);

  select jsonb_build_object(
    'subjects', coalesce(jsonb_agg(s order by s->>'avg_rating' desc nulls last), '[]'::jsonb),
    'totals', jsonb_build_object(
      'count',      sum((s->>'count')::integer),
      'avg_rating', round(avg((s->>'avg_rating')::numeric), 2)
    )
  )
  into v_result
  from (
    select jsonb_build_object(
      'subject_type',  da.subject_type,
      'subject_id',    da.subject_id,
      'label',         coalesce(
                         da.metadata->>'label',
                         p.display_name,
                         loc.name_en,
                         tp.name_en,
                         da.subject_id
                       ),
      'template_id',   da.template_id,
      'count',         count(re.id),
      'avg_rating',    round(avg(re.rating), 2),
      'distribution',  jsonb_object_agg(re.rating::text, cnt),
      'trend',         jsonb_agg(
                         jsonb_build_object('date', day, 'avg', day_avg, 'count', day_cnt)
                         order by day
                       )
    ) as s
    from public.distribution_assignments da
    join public.rating_events re
      on re.assignment_id = da.id
     and re.created_at >= p_start_at
     and re.created_at <  p_end_at
    -- Guard casts with CASE: only cast to uuid when subject_type matches,
    -- otherwise the cast fires on non-UUID generic subject_ids and throws.
    left join public.profiles p
      on p.id = case when da.subject_type = 'employee'
                     then da.subject_id::uuid end
    left join public.locations loc
      on loc.id = case when da.subject_type = 'location'
                       then da.subject_id::uuid end
    left join public.touchpoints tp
      on tp.id = case when da.subject_type = 'touchpoint'
                      then da.subject_id::uuid end
    -- per-rating distribution sub-agg
    join lateral (
      select re2.rating, count(*) as cnt
      from public.rating_events re2
      where re2.assignment_id = da.id
        and re2.created_at >= p_start_at
        and re2.created_at <  p_end_at
      group by re2.rating
    ) dist on true
    -- daily trend sub-agg
    join lateral (
      select
        date_trunc('day', re3.created_at) as day,
        round(avg(re3.rating), 2)         as day_avg,
        count(*)                          as day_cnt
      from public.rating_events re3
      where re3.assignment_id = da.id
        and re3.created_at >= p_start_at
        and re3.created_at <  p_end_at
      group by 1
    ) trend on true
    where da.organization_id = p_organization_id
      and (p_subject_type is null or da.subject_type = p_subject_type)
      and (p_template_id  is null or da.template_id  = p_template_id)
      and (
        p_location_id is null
        or da.assigned_location_id = p_location_id
        or (da.subject_type = 'location' and da.subject_id = p_location_id::text)
      )
    group by da.subject_type, da.subject_id, da.metadata, da.template_id,
             p.display_name, loc.name_en, tp.name_en,
             dist.rating, dist.cnt,
             trend.day, trend.day_avg, trend.day_cnt
  ) sub(s);

  return coalesce(v_result, jsonb_build_object('subjects', '[]'::jsonb, 'totals', '{}'::jsonb));
end;
$$;
