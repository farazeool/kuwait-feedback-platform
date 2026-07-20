import { LocationForm } from "@/components/locations/location-form";
import { getLocationSettings } from "@/features/settings/server";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/messages";

export default async function EditLocationPage({ params, searchParams }: { params: Promise<{ locationId: string }>; searchParams: Promise<Record<string, string | undefined>> }) { const [{ locationId }, notice] = await Promise.all([params, searchParams]); const manage = await requireOrganizationManagementContext(); const { location } = await getLocationSettings(locationId); const m = getMessages(manage.profile.locale); return <div className="grid gap-7"><h1 className="text-3xl font-bold">{m["location.edit"]}</h1>{notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4">{m["common.error"]}</p> : null}<LocationForm organizationId={manage.organization!.id} locale={manage.profile.locale} location={location ?? {}} /></div>; }
