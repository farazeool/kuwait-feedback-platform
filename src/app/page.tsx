import { PLATFORM_FEATURES } from "@/lib/config/platform";
import { FeatureCard } from "@/components/feature-card";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.35fr_0.65fr] lg:px-8 lg:py-28">
          <div>
            <span className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-sm font-semibold text-brand">
              Milestone 4 foundation
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Better feedback for every location.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              A secure, multi-tenant platform for collecting customer feedback,
              comparing branches, and helping Kuwait businesses act on what
              customers say.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-muted">
              <span className="rounded-lg border border-border px-3 py-2">English</span>
              <span className="rounded-lg border border-border px-3 py-2" dir="rtl" lang="ar">
                العربية
              </span>
              <span className="rounded-lg border border-border px-3 py-2">Asia/Kuwait</span>
            </div>
          </div>

          <aside className="rounded-3xl bg-brand p-8 text-white shadow-xl shadow-emerald-950/10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">
              Platform status
            </p>
            <p className="mt-4 text-2xl font-bold">Secure workspace ready</p>
            <p className="mt-3 leading-7 text-emerald-50">
              Secure survey authoring, QR distribution, anonymous bilingual
              feedback, and the response inbox are ready for local validation.
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>
    </main>
  );
}
