import type { Metadata } from "next";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import {
  AccountabilitySection,
  ActionWorkflowSection,
  AnalyticsSection,
  CapabilityStrip,
  ChannelsSection,
  ConnectedPlatformSection,
  FinalCta,
  HeroSection,
  IndustriesSection,
  KioskManagementSection,
  MarketingFooter,
  ProblemSection,
  SecuritySection,
} from "@/components/marketing/sections";
import { getMarketingUrl } from "@/lib/config/domains";

/**
 * Review & More public marketing homepage (www.reviewandmore.tech).
 *
 * Every section is a server component; the only client code on this route is
 * the header's mobile menu and the scroll-reveal wrapper. Nothing here reads
 * from Supabase or requires authentication, so the marketing domain performs no
 * application data fetching.
 */
export const metadata: Metadata = {
  title: "Review & More | Customer Feedback and Experience Management",
  description:
    "Collect and manage customer feedback through kiosks, QR codes and employee email signatures. Connect every response to the right employee, location, survey and channel.",
  alternates: { canonical: getMarketingUrl() },
  openGraph: {
    type: "website",
    siteName: "Review & More",
    url: getMarketingUrl(),
    title: "Review & More | Customer Feedback and Experience Management",
    description:
      "Collect and manage customer feedback through kiosks, QR codes and employee email signatures. Connect every response to the right employee, location, survey and channel.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Review & More | Customer Feedback and Experience Management",
    description:
      "Collect and manage customer feedback through kiosks, QR codes and employee email signatures.",
  },
  robots: { index: true, follow: true },
};

/**
 * Structured data. Deliberately limited to facts that are verifiable from the
 * product itself — name, description, category and platform. No ratings,
 * review counts, pricing or awards are asserted.
 */
function StructuredData() {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Review & More",
        url: getMarketingUrl(),
        description:
          "Customer feedback and experience management platform for kiosk, QR-code and email-signature feedback.",
      },
      {
        "@type": "SoftwareApplication",
        name: "Review & More",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: getMarketingUrl(),
        description:
          "Collect and manage customer feedback through kiosks, QR codes and employee email signatures, with employee, location, survey and channel attribution.",
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // Static, developer-authored object with no user input, so there is no
      // injection surface here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

export default function Home() {
  return (
    <div className="rm-scope flex flex-1 flex-col bg-[var(--rm-paper)]">
      <StructuredData />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[60] focus:rounded-[var(--rm-radius)] focus:bg-[var(--rm-maroon)] focus:px-4 focus:py-2.5 focus:text-[0.9375rem] focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <MarketingHeader />

      <main id="main" className="flex flex-1 flex-col">
        <HeroSection />
        <CapabilityStrip />
        <ProblemSection />
        <ConnectedPlatformSection />
        <ChannelsSection />
        <AccountabilitySection />
        <KioskManagementSection />
        <AnalyticsSection />
        <ActionWorkflowSection />
        <SecuritySection />
        <IndustriesSection />
        <FinalCta />
      </main>

      <MarketingFooter />
    </div>
  );
}
