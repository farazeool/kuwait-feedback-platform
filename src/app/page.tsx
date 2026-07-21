import { PLATFORM_FEATURES } from "@/lib/config/platform";
import { FeatureCard } from "@/components/feature-card";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[1.4fr_0.6fr] lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-brand">
              Milestone 4 foundation
            </span>
            <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Better feedback for every location.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              A secure, multi-tenant platform for collecting customer feedback,
              comparing branches, and helping Kuwait businesses act on what
              customers say.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-medium text-muted">
              <span className="rounded-md border border-border px-2.5 py-1.5">English</span>
              <span className="rounded-md border border-border px-2.5 py-1.5" dir="rtl" lang="ar">
                العربية
              </span>
              <span className="rounded-md border border-border px-2.5 py-1.5">Asia/Kuwait</span>
            </div>
          </div>

          <aside className="rounded-xl bg-brand p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">
              Platform status
            </p>
            <p className="mt-3 text-xl font-bold">Secure workspace ready</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100">
              Secure survey authoring, QR distribution, anonymous bilingual
              feedback, and the response inbox are ready for local validation.
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-14 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>
    </main>
  );
}
