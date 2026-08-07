-- Fix: get_signature_subject_report emitted duplicate subject rows and inflated totals.
--
-- The previous version cross-joined two lateral sub-aggregates (per-rating `dist`
-- and per-day `trend`) into the main aggregation AND listed their columns in the
-- GROUP BY. That turned one subject into (distinct-rating-values × distinct-days)
-- group rows: a subject with 5 ratings spanning 3 distinct values over 2 days was
-- emitted as 6 identical "subjects" and its rows were counted 6× in totals.count
-- (e.g. count=30 for 5 ratings). The distribution/trend payloads were also garbled
-- because `cnt`/`day` were fixed per group. The single-row regression test never
-- caught it because 1 value × 1 day = 1 (no multiplication).
--
-- Fix: compute `distribution` and `trend` as scalar correlated subqueries (each
-- returns one jsonb value), so the main query groups strictly one row per subject.
-- A unique index on (template_id, subject_type, subject_id) guarantees at most one
-- assignment per subject+template, so grouping by da.id preserves per-subject
-- semantics while keeping the subqueries simple.
--
-- NOTE: avg_rating is the plain average of the normalized 1–5 integer.
-- Cross-scale blending is intentionally unsupported: averaging yes_no (1/5)
-- with three_option (1/2/3) or full 5-point ratings produces a meaningless
-- number. Always filter by p_template_id when a single rating scale is
-- required. Do not remove this constraint without adding per-scale
-- normalization (e.g. 0–1 percentage) or segmented columns first.

create or replace function public.get_signature_subject_report(
  p_organization_id uuid,
  p_start_at        timestamptz,
  p_end_at          timestamptz,
  p_subject_type    text default null,
  p_template_id     uuid default null,
  p_location_id     uuid default null
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
    'subjects', coalesce(jsonb_agg(s order by (s->>'avg_rating')::numeric desc nulls last), '[]'::jsonb),
    'totals', jsonb_build_object(
      'count',      coalesce(sum((s->>'count')::integer), 0),
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
      -- Plain avg of the normalized 1–5 rating. Callers MUST filter by
      -- p_template_id to keep a single rating scale; cross-scale blending is
      -- intentionally unsupported (see migration header).
      'avg_rating',    round(avg(re.rating), 2),
      -- per-rating distribution as a scalar subquery (no cross join)
      'distribution',  (
        select coalesce(jsonb_object_agg(rating::text, c), '{}'::jsonb)
        from (
          select re2.rating, count(*) as c
          from public.rating_events re2
          where re2.assignment_id = da.id
            and re2.created_at >= p_start_at
            and re2.created_at <  p_end_at
          group by re2.rating
        ) d
      ),
      -- daily trend as a scalar subquery (no cross join)
      'trend',         (
        select coalesce(
                 jsonb_agg(
                   jsonb_build_object('date', day, 'avg', day_avg, 'count', day_cnt)
                   order by day
                 ),
                 '[]'::jsonb
               )
        from (
          select
            date_trunc('day', re3.created_at) as day,
            round(avg(re3.rating), 2)         as day_avg,
            count(*)                          as day_cnt
          from public.rating_events re3
          where re3.assignment_id = da.id
            and re3.created_at >= p_start_at
            and re3.created_at <  p_end_at
          group by 1
        ) t
      )
    ) as s
    from public.distribution_assignments da
    join public.rating_events re
      on re.assignment_id = da.id
     and re.created_at >= p_start_at
     and re.created_at <  p_end_at
    left join public.profiles p
      on p.id = case when da.subject_type = 'employee'
                     then da.subject_id::uuid end
    left join public.locations loc
      on loc.id = case when da.subject_type = 'location'
                       then da.subject_id::uuid end
    left join public.touchpoints tp
      on tp.id = case when da.subject_type = 'touchpoint'
                      then da.subject_id::uuid end
    where da.organization_id = p_organization_id
      and (p_subject_type is null or da.subject_type = p_subject_type)
      and (p_template_id  is null or da.template_id  = p_template_id)
      and (
        p_location_id is null
        or da.assigned_location_id = p_location_id
        or (da.subject_type = 'location' and da.subject_id = p_location_id::text)
      )
    -- one row per subject: da.id is unique per (template, subject_type, subject_id)
    group by da.id, da.subject_type, da.subject_id, da.metadata, da.template_id,
             p.display_name, loc.name_en, tp.name_en
  ) sub(s);

  return coalesce(v_result, jsonb_build_object('subjects', '[]'::jsonb, 'totals', '{}'::jsonb));
end;
$$;
