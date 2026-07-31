-- Kiosk survey assignment: enforce tenant isolation declaratively.
--
-- Context
-- -------
-- `create_kiosk_device` and `update_kiosk_device` already verify that an
-- assigned survey belongs to the device's organization and is active. Those
-- checks are procedural: they only run when the RPC is the write path. A
-- service-role statement, a future migration, or a new code path that writes
-- `kiosk_devices.survey_id` directly bypasses them entirely, and nothing in
-- the schema would reject a survey belonging to another tenant.
--
-- `location_id` already solved this problem with a composite foreign key:
--   kiosk_devices_location_fk (location_id, organization_id)
--     -> locations (id, organization_id)
-- This migration applies that established pattern to `survey_id`, so the
-- database itself refuses cross-tenant survey assignment regardless of the
-- write path. `surveys_id_organization_key UNIQUE (id, organization_id)`
-- already exists, so no new unique constraint is required.
--
-- Delete behaviour
-- ----------------
-- The single-column FK used ON DELETE SET NULL, meaning a deleted survey
-- detached itself from its kiosks and left the devices intact. Preserving
-- that contract with a composite FK requires a column-specific action:
--   ON DELETE SET NULL (survey_id)
-- Without the column list, PostgreSQL nulls *every* referencing column,
-- which would null `organization_id` — a NOT NULL column that also anchors
-- the location FK and all RLS predicates. That would either error or, worse,
-- orphan a device from its tenant. The column-specific form requires
-- PostgreSQL 15+; local and target servers run 17.6.
--
-- `survey_id` remains nullable: an unassigned kiosk is a valid state, and
-- survey deletion continues to produce exactly that state.
--
-- Historical responses are unaffected. Response attribution is copied onto
-- the response row when feedback is recorded; it is not resolved by joining
-- back through `kiosk_devices.survey_id`, so detaching or reassigning a
-- survey never rewrites past attribution.

-- Drop the single-column FK, using its default upstream-generated name.
-- `if exists` keeps this migration re-runnable. Should that name ever change
-- upstream, this drop silently no-ops -- but the ADD CONSTRAINT below would
-- then fail on the leftover single-column FK, so the mismatch still surfaces
-- rather than passing quietly.
alter table public.kiosk_devices
  drop constraint if exists kiosk_devices_survey_id_fkey;


alter table public.kiosk_devices
  add constraint kiosk_devices_survey_fk
  foreign key (survey_id, organization_id)
  references public.surveys (id, organization_id)
  on delete set null (survey_id);

-- Supports the composite FK's referential integrity checks. The pre-existing
-- kiosk_devices_survey_id_idx covers survey_id alone and stays in place for
-- single-column lookups.
create index if not exists kiosk_devices_survey_org_idx
  on public.kiosk_devices (survey_id, organization_id);

comment on constraint kiosk_devices_survey_fk on public.kiosk_devices is
  'Composite FK enforcing that an assigned survey belongs to the same organization as the kiosk device. Mirrors kiosk_devices_location_fk. ON DELETE SET NULL is scoped to survey_id so survey deletion never nulls organization_id.';
