import Link from "next/link";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/messages";

export default async function SettingsPage() {
  const context = await requireOrganizationManagementContext();
  const messages = getMessages(context.profile.locale);
  const cards = [["organization", "settings.organization"], ["branding", "settings.branding"], ["security", "settings.security"], ["alerts", "settings.alerts"], ["departments", "settings.departments"], ["touchpoints", "settings.touchpoints"], ["rating-scales", "settings.ratingScales"]] as const;
  return <div className="grid gap-6"><h1 className="text-2xl font-bold tracking-tight text-foreground">{messages["settings.title"]}</h1><div className="grid gap-4 md:grid-cols-3">{cards.map(([href, key]) => <Link key={href} className="rounded-xl border border-border bg-white p-6 text-base font-semibold text-brand" href={`/dashboard/settings/${href}`}>{messages[key]}</Link>)}</div></div>;
}
