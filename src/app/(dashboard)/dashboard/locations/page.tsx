import { EmptyState } from "@/components/dashboard/empty-state";
import { requireAppAccessContext } from "@/lib/auth/context";

export default async function LocationsPage() {
  const context = await requireAppAccessContext();
  return (
    <div className="grid gap-7">
      <h1 className="text-3xl font-bold">Locations</h1>
      {context.locations.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {context.locations.map((location) => (
            <article key={location.id} className="rounded-3xl border border-border bg-white p-6">
              <h2 className="font-bold">{location.nameEn}</h2>
              <p className="mt-1 text-sm text-muted">{location.area} · {location.governorate.replaceAll("_", " ")}</p>
              <p className="mt-4 text-sm" dir="rtl" lang="ar">{location.nameAr}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No permitted locations" description="Your role has not been assigned to an active location yet." />
      )}
    </div>
  );
}
