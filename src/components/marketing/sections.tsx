import Link from "next/link";

import { AnchorButton, Card, Eyebrow, OpenInstaViewButton, ReviewAndMoreLogo, Section, SectionHeading, StepBadge } from "./primitives";
import { Reveal } from "./reveal";

/**
 * Review & More marketing sections.
 *
 * All copy below describes functionality that exists in this repository:
 * kiosk devices with activation and heartbeat, QR/public links, email-signature
 * ratings, employee and location attribution, analytics and corrective actions.
 * No customers, logos, awards, certifications or usage statistics are claimed.
 * Any illustrative data uses neutral, obviously fictional labels.
 *
 * These are server components; only the header, Reveal wrapper and the small
 * preview live on the client.
 */

/* ------------------------------------------------------------------ Hero */

export function HeroSection() {
  return (
    <section className="border-b border-[var(--rm-stone)] bg-[var(--rm-offwhite)]">
      <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 py-20 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:px-8">
        <div>
          <Eyebrow>Customer Feedback. Connected.</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-balance text-[var(--rm-charcoal)] sm:text-5xl lg:text-[3.4rem]">
            Turn every customer interaction into measurable improvement.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--rm-ink)]">
            Review &amp; More brings kiosk, QR-code and employee email-signature feedback into one secure
            platform. Every response can be connected to the right employee, location, survey and
            channel—giving management clear information they can act on.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <OpenInstaViewButton className="min-h-12" />
            <AnchorButton href="#product" className="min-h-12">
              Explore the Platform
            </AnchorButton>
          </div>
          <p className="mt-6 text-sm text-[var(--rm-stone-deep)]">
            InstaView is the secure workspace where your team signs in and runs the platform.
          </p>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

/**
 * Product preview.
 *
 * A composed, static representation of real dashboard concepts — not a
 * screenshot and not a fabricated 3D mockup. Values are illustrative and the
 * panel says so, so nothing here can be read as a real customer's data.
 */
function ProductPreview() {
  const employees = [
    { name: "Employee A", rating: "4.6", responses: 128 },
    { name: "Employee B", rating: "4.3", responses: 96 },
    { name: "Employee C", rating: "4.1", responses: 74 },
  ];

  return (
    <div className="rounded-[var(--rm-radius-lg)] border border-[var(--rm-stone)] bg-[var(--rm-paper)] p-5 shadow-[var(--rm-shadow-lg)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--rm-stone)] pb-4">
        <div>
          <p className="text-[0.8125rem] font-medium text-[var(--rm-stone-deep)]">InstaView workspace</p>
          <p className="text-[0.9375rem] font-semibold text-[var(--rm-charcoal)]">Overview — Central Branch</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rm-maroon-soft)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--rm-maroon)]">
          <span className="rm-status-pulse size-1.5 rounded-full bg-[var(--rm-maroon)]" aria-hidden="true" />
          Online
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-3 py-4">
        {[
          { k: "Responses", v: "1,284" },
          { k: "Average rating", v: "4.4" },
          { k: "Open actions", v: "3" },
        ].map((s) => (
          <div key={s.k} className="rounded-[var(--rm-radius)] bg-[var(--rm-offwhite)] p-3">
            <dt className="text-[0.75rem] font-medium text-[var(--rm-stone-deep)]">{s.k}</dt>
            <dd className="mt-1 text-xl font-semibold text-[var(--rm-charcoal)]">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-[var(--rm-stone)] pt-4">
        <p className="text-[0.8125rem] font-semibold text-[var(--rm-charcoal)]">Employee ratings — Sample Survey</p>
        <ul className="mt-3 space-y-2.5">
          {employees.map((e) => (
            <li key={e.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[0.8125rem] text-[var(--rm-ink)]">{e.name}</span>
              {/* Bar is decorative; the numeric rating carries the meaning. */}
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--rm-stone)]" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-[var(--rm-maroon)]"
                  style={{ width: `${(Number(e.rating) / 5) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right text-[0.8125rem] font-semibold text-[var(--rm-charcoal)]">{e.rating}</span>
              <span className="w-14 text-right text-[0.75rem] text-[var(--rm-stone-deep)]">{e.responses}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 border-t border-[var(--rm-stone)] pt-3 text-[0.75rem] text-[var(--rm-stone-deep)]">
        Illustrative interface with sample data. Names and figures are fictional.
      </p>
    </div>
  );
}

/* -------------------------------------------------------- Capability strip */

export function CapabilityStrip() {
  const items = [
    "Kiosk Feedback",
    "QR & Public Links",
    "Email-Signature Ratings",
    "Employee Attribution",
    "Location Analytics",
    "Corrective Action",
  ];
  return (
    <section aria-label="Platform capabilities" className="border-b border-[var(--rm-stone)] bg-[var(--rm-paper)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-full border border-[var(--rm-stone)] bg-[var(--rm-offwhite)] px-4 py-2 text-[0.8125rem] font-medium text-[var(--rm-ink)]"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Problem */

export function ProblemSection() {
  const rows = [
    { p: "Feedback scattered across forms, links, devices and departments.", o: "One platform collecting every channel into a single record set." },
    { p: "Results disconnected from the employees and locations involved.", o: "Each response carries its employee, location, survey and channel." },
    { p: "Negative experiences discovered long after the visit.", o: "Low ratings surface for review and can be assigned for action." },
    { p: "Kiosk devices left unmanaged once installed.", o: "Device status, heartbeat and assigned survey managed centrally." },
    { p: "Reports that describe problems but assign no ownership.", o: "Corrective actions with an owner, due date and closure." },
  ];
  return (
    <Section id="problem" tone="offwhite" labelledBy="problem-title">
      <Reveal>
        <SectionHeading
          id="problem-title"
          eyebrow="The gap"
          title="Feedback is easy to collect. Making it useful is harder."
          lede="Most tools stop at the response. The value appears when a response is tied to the people and places behind it, and when someone owns the follow-up."
        />
      </Reveal>
      <Reveal className="mt-12">
        <ul className="grid gap-px overflow-hidden rounded-[var(--rm-radius-lg)] border border-[var(--rm-stone)] bg-[var(--rm-stone)]">
          {rows.map((row) => (
            <li key={row.p} className="grid gap-3 bg-[var(--rm-paper)] p-5 sm:grid-cols-2 sm:gap-8 sm:p-6">
              <p className="text-[0.9375rem] text-[var(--rm-stone-deep)]">{row.p}</p>
              <p className="flex gap-2.5 text-[0.9375rem] font-medium text-[var(--rm-charcoal)]">
                <svg viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" aria-hidden="true" fill="none">
                  <path d="M4 10.5l4 4 8-8" stroke="var(--rm-maroon)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {row.o}
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

/* -------------------------------------------------- Connected platform */

const FLOW = [
  { t: "Collect", d: "Kiosks, QR codes, public links and email-signature ratings feed one platform." },
  { t: "Attribute", d: "Each response records its employee, location, survey and channel." },
  { t: "Understand", d: "Ratings, volumes and trends are compared across teams and branches." },
  { t: "Assign", d: "Issues become corrective actions with a named owner and due date." },
  { t: "Improve", d: "Teams act, record what changed and attach supporting evidence." },
  { t: "Verify", d: "Actions are closed and later results show whether the change held." },
];

export function ConnectedPlatformSection() {
  return (
    <Section id="product" tone="paper" labelledBy="product-title">
      <Reveal>
        <SectionHeading
          id="product-title"
          eyebrow="How it works"
          title="One connected platform for every customer touchpoint."
          lede="Review & More is built around the path a single response takes—from the moment it is given to the moment someone confirms the problem is fixed."
        />
      </Reveal>
      <Reveal className="mt-12">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW.map((step, i) => (
            <li key={step.t}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <StepBadge n={i + 1} />
                  <h3 className="text-[1.0625rem] font-semibold text-[var(--rm-charcoal)]">{step.t}</h3>
                </div>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--rm-ink)]">{step.d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------ Channels */

const CHANNELS = [
  {
    name: "Kiosk and iPad feedback",
    lede: "A dedicated device in the space where the service happens.",
    points: [
      "Touch-friendly, full-screen interface",
      "English and Arabic support",
      "Loads the survey assigned to that device",
      "Welcome, survey and thank-you screens",
      "Returns to the welcome screen when idle",
      "Secure activation before any data is collected",
      "Responses attributed to device and location",
    ],
  },
  {
    name: "QR codes and public links",
    lede: "The customer uses their own phone—nothing to install.",
    points: [
      "No application download required",
      "Works on the customer's own device",
      "Survey and location attribution preserved",
      "Separate links for different placements",
      "Fast to deploy across a branch network",
    ],
  },
  {
    name: "Employee email-signature ratings",
    lede: "Feedback captured at the end of a real conversation.",
    points: [
      "Personalised signature per employee",
      "Rating buttons directly in the signature",
      "Responses attributed to that employee",
      "Opaque links that expose no internal identifiers",
      "Installation guidance for Gmail and Outlook",
      "Rich HTML copied ready to paste",
    ],
  },
];

export function ChannelsSection() {
  return (
    <Section id="channels" tone="offwhite" labelledBy="channels-title">
      <Reveal>
        <SectionHeading
          id="channels-title"
          eyebrow="Collection channels"
          title="Meet customers where the experience actually happens."
          lede="Three ways to collect feedback, each suited to a different moment—reporting into the same platform so results stay comparable."
        />
      </Reveal>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {CHANNELS.map((channel, i) => (
          <Reveal key={channel.name} delay={i * 70}>
            <Card className="h-full">
              <h3 className="text-lg font-semibold text-[var(--rm-charcoal)]">{channel.name}</h3>
              <p className="mt-2 text-[0.9375rem] text-[var(--rm-stone-deep)]">{channel.lede}</p>
              <ul className="mt-5 space-y-2.5">
                {channel.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-[var(--rm-ink)]">
                    <svg viewBox="0 0 20 20" className="mt-1.5 size-3.5 shrink-0" aria-hidden="true" fill="none">
                      <path d="M4 10.5l4 4 8-8" stroke="var(--rm-maroon)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-8">
        <p className="rounded-[var(--rm-radius)] border border-[var(--rm-stone)] bg-[var(--rm-paper)] p-5 text-center text-[0.9375rem] text-[var(--rm-ink)]">
          Every channel reports into the same platform, so a branch&apos;s kiosk results and its
          email-signature ratings sit side by side in one view.
        </p>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------- Accountability */

export function AccountabilitySection() {
  const questions = ["Which employee received the feedback", "Which location delivered the service", "Which survey was used", "Which channel produced the response", "When the interaction happened", "How performance changes over time"];
  const views = ["Average rating", "Rating distribution", "Response volume", "Employee comparison", "Location comparison", "Date, channel and survey filters"];
  return (
    <Section id="accountability" tone="paper" labelledBy="accountability-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <SectionHeading
            id="accountability-title"
            eyebrow="Employees and locations"
            title="Know exactly where each response came from."
            lede="Attribution is what separates a survey tool from a management system. When a rating arrives, the platform already knows the context around it."
          />
          <ul className="mt-8 space-y-3">
            {questions.map((q) => (
              <li key={q} className="flex gap-2.5 text-[0.9375rem] text-[var(--rm-ink)]">
                <svg viewBox="0 0 20 20" className="mt-1.5 size-3.5 shrink-0" aria-hidden="true" fill="none">
                  <path d="M4 10.5l4 4 8-8" stroke="var(--rm-maroon)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {q}
              </li>
            ))}
          </ul>
          <p className="mt-8 rounded-[var(--rm-radius)] border-s-2 border-[var(--rm-gold)] bg-[var(--rm-gold-soft)] p-4 text-[0.9375rem] leading-relaxed text-[var(--rm-ink)]">
            Attribution is intended to support coaching, recognition and training—identifying where
            help is needed, not building a case against staff.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <Card className="h-full">
            <h3 className="text-[1.0625rem] font-semibold text-[var(--rm-charcoal)]">Available to managers</h3>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {views.map((v) => (
                <li key={v} className="rounded-[var(--rm-radius)] bg-[var(--rm-offwhite)] p-3.5 text-[0.875rem] font-medium text-[var(--rm-charcoal)]">
                  {v}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------- Kiosk management */

const LIFECYCLE = [
  { t: "Register", d: "Add the device with a name and assign its location." },
  { t: "Assign", d: "Choose the survey the device should present." },
  { t: "Activate", d: "Device stays Pending Activation until a one-time code is used." },
  { t: "Monitor", d: "Heartbeat reporting drives Online/Offline and Last Seen." },
  { t: "Update", d: "Change the assigned survey remotely, without visiting the device." },
  { t: "Pause", d: "Take a device out of service for maintenance, then resume it." },
  { t: "Revoke", d: "Withdraw the device credential; a revoked device stops working." },
];

export function KioskManagementSection() {
  return (
    <Section id="instaview" tone="charcoal" labelledBy="kiosk-title">
      <Reveal>
        <SectionHeading
          id="kiosk-title"
          inverted
          eyebrow="Kiosk device management"
          title="Manage every device from the InstaView workspace."
          lede="Kiosks are often spread across branches. The full device lifecycle is handled centrally, so administrators are not reconfiguring hardware in person."
        />
      </Reveal>
      <Reveal className="mt-12">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LIFECYCLE.map((step, i) => (
            <li
              key={step.t}
              className="rounded-[var(--rm-radius-lg)] border border-[color-mix(in_srgb,var(--rm-offwhite)_16%,transparent)] bg-[color-mix(in_srgb,var(--rm-offwhite)_6%,transparent)] p-5"
            >
              <div className="flex items-center gap-3">
                <StepBadge n={i + 1} inverted />
                <h3 className="text-[1.0625rem] font-semibold text-[var(--rm-offwhite)]">{step.t}</h3>
              </div>
              <p className="mt-3 text-[0.875rem] leading-relaxed text-[color-mix(in_srgb,var(--rm-offwhite)_74%,transparent)]">
                {step.d}
              </p>
            </li>
          ))}
        </ol>
      </Reveal>
      <Reveal className="mt-10">
        <div className="flex flex-col gap-4 rounded-[var(--rm-radius-lg)] border border-[color-mix(in_srgb,var(--rm-offwhite)_16%,transparent)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.9375rem] text-[color-mix(in_srgb,var(--rm-offwhite)_82%,transparent)]">
            Device management, surveys, reporting and corrective actions all live in InstaView.
          </p>
          <OpenInstaViewButton variant="inverted" className="min-h-11 shrink-0">
            Login to InstaView
          </OpenInstaViewButton>
        </div>
      </Reveal>
    </Section>
  );
}

/* ----------------------------------------------------------- Analytics */

export function AnalyticsSection() {
  const groups = [
    { h: "Volume and rating", items: ["Total feedback volume", "Average rating", "Rating distribution", "Response trends over time"] },
    { h: "Performance views", items: ["Employee performance", "Location performance", "Survey performance", "Channel performance"] },
    { h: "Attention required", items: ["Recent feedback", "Negative-feedback alerts", "Unresolved actions", "Corrective-action progress"] },
  ];
  return (
    <Section id="analytics" tone="offwhite" labelledBy="analytics-title">
      <Reveal>
        <SectionHeading
          id="analytics-title"
          eyebrow="Analytics and reporting"
          title="Reporting that points to a decision."
          lede="The same views your team uses daily in InstaView—organised around what to look at, and what needs attention now."
        />
      </Reveal>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {groups.map((group, i) => (
          <Reveal key={group.h} delay={i * 70}>
            <Card className="h-full">
              <h3 className="text-[1.0625rem] font-semibold text-[var(--rm-charcoal)]">{group.h}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[0.9375rem] text-[var(--rm-ink)]">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--rm-maroon)]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------ Action workflow */

export function ActionWorkflowSection() {
  const stages = [
    { t: "Collect", d: "A response arrives and is stored with its full context." },
    { t: "Understand", d: "Negative feedback is reviewed against location and channel." },
    { t: "Assign", d: "An issue is raised, given an owner and a due date." },
    { t: "Improve", d: "The team investigates, acts and attaches evidence." },
    { t: "Verify", d: "The action is closed and later results confirm the change." },
  ];
  return (
    <Section id="actions" tone="paper" labelledBy="actions-title">
      <Reveal>
        <SectionHeading
          id="actions-title"
          eyebrow="From feedback to action"
          title="A response is only useful once something changes."
          lede="Corrective actions turn individual complaints into tracked work, with overdue monitoring so issues are not quietly forgotten."
        />
      </Reveal>
      <Reveal className="mt-12">
        <ol className="grid gap-4 md:grid-cols-5">
          {stages.map((stage, i) => (
            <li key={stage.t} className="relative">
              <Card className="h-full">
                <StepBadge n={i + 1} />
                <h3 className="mt-3 text-[1.0625rem] font-semibold text-[var(--rm-charcoal)]">{stage.t}</h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--rm-ink)]">{stage.d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------ Security */

export function SecuritySection() {
  const groups = [
    { h: "Trustworthy persistence", items: ["A thank-you screen is shown only after the response is stored", "Submissions are handled server-side", "Each response records the channel it came from"] },
    { h: "Separation and access", items: ["Organisation-level data isolation", "Row-level security in the database", "Role-based permissions", "Administrative operations restricted to authorised roles"] },
    { h: "Public links and devices", items: ["Opaque public tokens", "One-time kiosk activation codes", "Secure per-device credentials that can be revoked", "Rate limiting on public submissions", "No employee email or internal database identifier in a public link"] },
  ];
  return (
    <Section id="security" tone="offwhite" labelledBy="security-title">
      <Reveal>
        <SectionHeading
          id="security-title"
          eyebrow="Quality and security"
          title="Built for trustworthy feedback—not vanity metrics."
          lede="Review & More is designed so organisations can trust where feedback came from, whether it was successfully stored and who is responsible for acting on it."
        />
      </Reveal>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {groups.map((group, i) => (
          <Reveal key={group.h} delay={i * 70}>
            <Card className="h-full">
              <h3 className="text-[1.0625rem] font-semibold text-[var(--rm-charcoal)]">{group.h}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-[var(--rm-ink)]">
                    <svg viewBox="0 0 20 20" className="mt-1.5 size-3.5 shrink-0" aria-hidden="true" fill="none">
                      <path d="M10 2.5l6 2.5v5c0 3.6-2.5 6.6-6 7.5-3.5-.9-6-3.9-6-7.5V5l6-2.5z" stroke="var(--rm-maroon)" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------- Industries */

export function IndustriesSection() {
  const industries = ["Retail", "Restaurants and cafés", "Hotels and hospitality", "Clinics and reception areas", "Service centres", "Corporate offices", "Banks and branches", "Government service counters", "Training centres", "Events and exhibitions"];
  return (
    <Section id="industries" tone="paper" labelledBy="industries-title">
      <Reveal>
        <SectionHeading
          id="industries-title"
          eyebrow="Where it fits"
          title="Suited to any place where service quality matters."
          lede="These are environments the platform is designed for—counters, waiting areas and branch networks where feedback is tied to a specific person and place."
          align="center"
        />
      </Reveal>
      <Reveal className="mt-12">
        <ul className="flex flex-wrap justify-center gap-3">
          {industries.map((industry) => (
            <li
              key={industry}
              className="rounded-[var(--rm-radius)] border border-[var(--rm-stone)] bg-[var(--rm-offwhite)] px-4 py-2.5 text-[0.9375rem] font-medium text-[var(--rm-charcoal)]"
            >
              {industry}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------ Final CTA */

export function FinalCta() {
  return (
    <section className="border-b border-[var(--rm-stone)] bg-[var(--rm-maroon-deep)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 text-center sm:py-24 lg:px-8">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-[var(--rm-offwhite)] sm:text-4xl">
            Ready to turn feedback into better service?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[color-mix(in_srgb,var(--rm-offwhite)_82%,transparent)]">
            Bring every customer touchpoint into one connected platform and give your teams the
            insight needed to improve.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <OpenInstaViewButton variant="inverted" className="min-h-12" />
            <Link
              href="#product"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--rm-radius)] border border-[color-mix(in_srgb,var(--rm-offwhite)_32%,transparent)] px-6 text-[0.9375rem] font-semibold text-[var(--rm-offwhite)] transition-colors hover:bg-[color-mix(in_srgb,var(--rm-offwhite)_10%,transparent)]"
            >
              Review the platform
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Footer */

export function MarketingFooter() {
  const columns = [
    { h: "Product", links: [{ l: "Overview", h: "#product" }, { l: "Analytics", h: "#analytics" }, { l: "Corrective actions", h: "#actions" }] },
    { h: "Channels", links: [{ l: "Kiosk feedback", h: "#channels" }, { l: "QR & public links", h: "#channels" }, { l: "Email signatures", h: "#channels" }] },
    { h: "Company", links: [{ l: "Security", h: "#security" }, { l: "Privacy", h: "/privacy" }, { l: "Terms", h: "/terms" }] },
  ];
  return (
    <footer className="bg-[var(--rm-charcoal)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <ReviewAndMoreLogo inverted />
            <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-[color-mix(in_srgb,var(--rm-offwhite)_70%,transparent)]">
              Customer feedback and experience management. Collect through kiosks, QR codes and
              employee email signatures, and connect every response to the people and places behind it.
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.h} aria-label={column.h}>
              <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-[var(--rm-gold-soft)]">{column.h}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.l}>
                    <Link
                      href={link.h}
                      className="text-[0.9375rem] text-[color-mix(in_srgb,var(--rm-offwhite)_78%,transparent)] transition-colors hover:text-[var(--rm-offwhite)]"
                    >
                      {link.l}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[color-mix(in_srgb,var(--rm-offwhite)_16%,transparent)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.875rem] text-[color-mix(in_srgb,var(--rm-offwhite)_62%,transparent)]">
            © {new Date().getFullYear()} Review &amp; More. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[0.875rem] text-[color-mix(in_srgb,var(--rm-offwhite)_62%,transparent)]">
              InstaView workspace by Review &amp; More
            </span>
            <OpenInstaViewButton variant="inverted" className="min-h-10 text-[0.875rem]">
              Login
            </OpenInstaViewButton>
          </div>
        </div>
      </div>
    </footer>
  );
}
