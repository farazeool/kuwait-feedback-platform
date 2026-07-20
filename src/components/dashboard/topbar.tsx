import { signOut } from "@/features/auth/actions";

export function DashboardTopbar({
  displayName,
  organizationName,
  locationName,
  role,
}: {
  displayName: string;
  organizationName: string;
  locationName: string;
  role: string;
}) {
  return (
    <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-5 py-4 sm:px-8">
      <div>
        <p className="font-bold">{organizationName}</p>
        <p className="text-sm text-muted">{locationName}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-end sm:block">
          <p className="text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-muted">{role.replaceAll("_", " ")}</p>
        </div>
        <form action={signOut}>
          <button className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
