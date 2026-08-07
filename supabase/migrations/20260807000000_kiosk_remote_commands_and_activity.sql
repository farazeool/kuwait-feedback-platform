-- Migration for kiosk remote commands and activity history
BEGIN;

-- 1. Create kiosk_remote_commands table
CREATE TABLE IF NOT EXISTS public.kiosk_remote_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    kiosk_device_id UUID NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
    command_type TEXT NOT NULL,
    command_payload JSONB,
    desired_config_version INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'acknowledged', 'failed', 'expired', 'cancelled')),
    issued_by UUID NOT NULL REFERENCES public.profiles(id),
    idempotency_key TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create kiosk_activity_history table
CREATE TABLE IF NOT EXISTS public.kiosk_activity_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    kiosk_device_id UUID NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_user_id UUID REFERENCES public.profiles(id),
    metadata JSONB,
    occurred_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add RLS
ALTER TABLE public.kiosk_remote_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_activity_history ENABLE ROW LEVEL SECURITY;

-- 4. Create policies (Simplified for now, will refine)
-- Admin can manage commands
CREATE POLICY "Admin can manage commands" ON public.kiosk_remote_commands
    FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.organization_memberships WHERE organization_id = kiosk_remote_commands.organization_id AND role = 'organization_admin' AND status = 'active'));

-- Kiosk can read commands
CREATE POLICY "Kiosk can read commands" ON public.kiosk_remote_commands
    FOR SELECT USING (auth.uid() = kiosk_device_id::text::uuid);

-- Admin can read activity
CREATE POLICY "Admin can read activity" ON public.kiosk_activity_history
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.organization_memberships WHERE organization_id = kiosk_activity_history.organization_id AND role = 'organization_admin' AND status = 'active'));

COMMIT;
