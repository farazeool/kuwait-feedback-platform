import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { requireAppAccessContext } from "@/lib/auth/context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAppAccessContext();
  const role = context.profile.platformRole ?? context.membership?.role ?? "analyst";
  const isArabic = context.profile.locale === "ar";
  const organizationName = context.organization
    ? isArabic
      ? context.organization.nameAr
      : context.organization.nameEn
    : "Platform administration";
  const locationName = context.locations[0]
    ? isArabic
      ? context.locations[0].nameAr
      : context.locations[0].nameEn
    : "All permitted locations";

  return (
    <div dir={isArabic ? "rtl" : "ltr"} lang={context.profile.locale} className="min-h-screen lg:ps-64 print:ps-0">
      <DashboardSidebar role={role} locale={context.profile.locale} />
      <div className="min-w-0 flex-1">
        <DashboardTopbar
          displayName={context.profile.displayName}
          organizationName={organizationName}
          locationName={locationName}
          role={role}
          locale={context.profile.locale}
          logoUrl={context.organization?.logoUrl ?? null}
        />
        <main className="px-5 py-8 sm:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
