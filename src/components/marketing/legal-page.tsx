import type { ReactNode } from "react";

import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./sections";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="rm-scope flex flex-1 flex-col bg-[var(--rm-paper)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[60] focus:rounded-[var(--rm-radius)] focus:bg-[var(--rm-maroon)] focus:px-4 focus:py-2.5 focus:text-[0.9375rem] focus:font-semibold focus:text-white">
        Skip to main content
      </a>
      <MarketingHeader />
      <main id="main" className="flex flex-1 flex-col">
        <div className="border-b border-[var(--rm-stone)] bg-[var(--rm-offwhite)]">
          <div className="mx-auto w-full max-w-3xl px-6 py-16 lg:px-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--rm-charcoal)] sm:text-4xl">{title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-[var(--rm-ink)]">{intro}</p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl px-6 py-14 lg:px-8">
          <div className="space-y-10">{children}</div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-[var(--rm-charcoal)]">{heading}</h2>
      <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-[var(--rm-ink)]">{children}</div>
    </section>
  );
}
