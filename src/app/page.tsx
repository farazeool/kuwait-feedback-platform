import { PLATFORM_FEATURES } from "@/lib/config/platform";
import Link from "next/link";
import { FeatureCard } from "@/components/feature-card";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-[#f0f5ef] via-white to-white">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 -right-40 size-96 rounded-full bg-brand/3 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-emerald-400/5 blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.3fr_0.7fr] lg:px-8 lg:py-28">
          <div className="animate-kiosk-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-1.5 text-sm font-medium text-brand shadow-sm">
              <span className="grid size-2 rounded-full bg-brand" />
              v1.0 — Production Ready
            </span>

            <h1 className="mt-8 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Better feedback for{" "}
              <span className="text-brand">every location</span>.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              A secure, bilingual feedback platform for Kuwait businesses.
              Collect customer insights via iPad kiosks, QR codes, and web links.
              Compare branches, track satisfaction, and act on what customers say.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-brand px-8 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-brand-dark hover:shadow-xl active:scale-[0.98]"
              >
                Sign in
                <svg viewBox="0 0 24 24" fill="none" className="size-4">
                  <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/signup"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-border bg-white px-8 text-base font-semibold text-foreground transition-all duration-200 hover:border-brand/30 hover:bg-brand-light/20"
              >
                Create account
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5">
                <span className="text-brand">✓</span> English
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5" dir="rtl" lang="ar">
                <span className="text-brand">✓</span> العربية
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5">
                <span className="text-brand">✓</span> Asia/Kuwait
              </span>
            </div>
          </div>

          {/* Hero visual — mobile-friendly */}
          <aside className="relative flex items-center lg:justify-end">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-2xl sm:p-8">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-white/15">
                  <svg viewBox="0 0 24 24" fill="none" className="size-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Platform status</p>
                  <p className="text-sm font-bold">Secure workspace ready</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span className="text-sm text-emerald-100">Average rating</span>
                  <span className="text-lg font-bold">4.2 ★</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span className="text-sm text-emerald-100">Responses today</span>
                  <span className="text-lg font-bold">47</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span className="text-sm text-emerald-100">Active branches</span>
                  <span className="text-lg font-bold">3</span>
                </div>
              </div>

              <p className="mt-6 text-sm leading-relaxed text-emerald-100">
                Bilingual surveys, QR distribution, anonymous feedback, and
                real-time analytics — ready for pilot deployment.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-1.5 text-sm font-medium text-brand">
            Everything you need
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
            Complete feedback management
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            From iPad kiosks to detailed analytics — collect, analyze, and act
            on customer feedback across all your locations.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-10 text-center text-sm text-muted">
        <p className="font-semibold text-foreground">Kuwait Feedback Platform</p>
        <p className="mt-1">Multi-tenant customer feedback for Kuwait businesses</p>
        <p className="mt-6 text-xs text-muted/60" dir="rtl" lang="ar">
          منصة آراء الكويت — ملاحظات العملاء للشركات في الكويت
        </p>
      </footer>
    </main>
  );
}
