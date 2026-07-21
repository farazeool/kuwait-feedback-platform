import { LocationForm } from "@/components/locations/location-form";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/messages";

export default async function NewLocationPage() { const context = await requireOrganizationManagementContext(); const m = getMessages(context.profile.locale); return <div className="grid gap-6"><h1 className="text-2xl font-bold tracking-tight text-foreground">{m["location.new"]}</h1><LocationForm organizationId={context.organization!.id} locale={context.profile.locale} /></div>; }
