import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";


import { buildLoginUrl } from "@/lib/config/domains";

/**
 * Shared marketing primitives.
 *
 * These are plain server components: one spacing scale, one set of radii and
 * shadows, one type ramp, all driven by the `--rm-*` tokens in globals.css.
 * Sections compose these rather than re-inventing padding and heading sizes,
 * which is what keeps the site from drifting into several competing styles.
 */

/**
 * The official Review & More lockup.
 *
 * The artwork is the supplied brand file — it is never re-drawn in code, so the
 * emblem, lettering and official ink colours stay exactly as the brand owner
 * provided them. Two variants exist because the lockup is navy + red and would
 * lose contrast on a dark surface:
 *
 *  - default   transparent lockup, for light surfaces
 *  - inverted  the same lockup on its own white plate, for dark surfaces
 *
 * Intrinsic size is 600x157 (aspect 3.83); `next/image` reserves that ratio so
 * there is no layout shift while the asset loads.
 */
export function ReviewAndMoreLogo({
  className = "",
  inverted = false,
  priority = false,
}: {
  className?: string;
  inverted?: boolean;
  priority?: boolean;
}) {
  return (
    <Image
      src={inverted ? "/brand/review-and-more-logo-on-dark.png" : "/brand/review-and-more-logo.png"}
      alt="Review & More"
      width={600}
      height={157}
      priority={priority}
      sizes="(max-width: 640px) 150px, 190px"
      className={`h-9 w-auto sm:h-10 ${inverted ? "rounded-md bg-white" : ""} ${className}`}
    />
  );
}


/** Consistent section container: one max width, one horizontal rhythm. */
export function Section({
  id,
  children,
  className = "",
  tone = "paper",
  labelledBy,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "paper" | "offwhite" | "charcoal" | "maroon";
  labelledBy?: string;
}) {
  const tones: Record<string, string> = {
    paper: "bg-[var(--rm-paper)]",
    offwhite: "bg-[var(--rm-offwhite)]",
    charcoal: "bg-[var(--rm-charcoal)]",
    maroon: "bg-[var(--rm-maroon-deep)]",
  };
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      // scroll-mt keeps anchored headings clear of the sticky header.
      className={`scroll-mt-24 border-b border-[var(--rm-stone)] ${tones[tone]} ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24 lg:px-8">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
  return (
    <p
      className="text-[0.8125rem] font-semibold uppercase tracking-[0.14em]"
      style={{ color: inverted ? "var(--rm-gold-soft)" : "var(--rm-gold)" }}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  inverted = false,
  align = "start",
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  inverted?: boolean;
  align?: "start" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? <Eyebrow inverted={inverted}>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        style={{ color: inverted ? "var(--rm-offwhite)" : "var(--rm-charcoal)" }}
      >
        {title}
      </h2>
      {lede ? (
        <p
          className="mt-5 text-lg leading-relaxed"
          style={{ color: inverted ? "color-mix(in srgb, var(--rm-offwhite) 78%, transparent)" : "var(--rm-ink)" }}
        >
          {lede}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The single canonical "into the product" control. Every Login / Open InstaView
 * CTA on the marketing site routes through here, so the absolute InstaView URL
 * is defined in exactly one place.
 */
export function OpenInstaViewButton({
  children = "Open InstaView",
  variant = "primary",
  className = "",
}: {
  children?: ReactNode;
  variant?: "primary" | "inverted" | "quiet";
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-[var(--rm-maroon)] text-white hover:bg-[var(--rm-maroon-deep)] shadow-[var(--rm-shadow)]",
    inverted: "bg-[var(--rm-offwhite)] text-[var(--rm-maroon-deep)] hover:bg-white shadow-[var(--rm-shadow)]",
    quiet: "border border-[var(--rm-stone)] bg-[var(--rm-paper)] text-[var(--rm-charcoal)] hover:border-[var(--rm-maroon)] hover:text-[var(--rm-maroon)]",
  };
  return (
    <a
      href={buildLoginUrl()}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--rm-radius)] px-6 text-[0.9375rem] font-semibold transition-colors duration-200 ${variants[variant]} ${className}`}
    >
      {children}
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none">
        <path d="M5 12h13m-5-6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/** Internal anchor styled as a secondary action. */
export function AnchorButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--rm-radius)] border border-[var(--rm-stone)] bg-[var(--rm-paper)] px-6 text-[0.9375rem] font-semibold text-[var(--rm-charcoal)] transition-colors duration-200 hover:border-[var(--rm-maroon)] hover:text-[var(--rm-maroon)] ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--rm-radius-lg)] border border-[var(--rm-stone)] bg-[var(--rm-paper)] p-6 shadow-[var(--rm-shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--rm-shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Numbered process step. The number is rendered as text rather than conveyed by
 * colour alone, so ordering survives both greyscale and screen readers.
 */
export function StepBadge({ n, inverted = false }: { n: number; inverted?: boolean }) {
  return (
    <span
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold"
      style={
        inverted
          ? { background: "color-mix(in srgb, var(--rm-offwhite) 16%, transparent)", color: "var(--rm-offwhite)" }
          : { background: "var(--rm-maroon-soft)", color: "var(--rm-maroon)" }
      }
    >
      {n}
    </span>
  );
}
