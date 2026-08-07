"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buildLoginUrl } from "@/lib/config/domains";

import { OpenInstaViewButton, ReviewAndMoreLogo } from "./primitives";

const NAV = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#industries" },
  { label: "Channels", href: "#channels" },
  { label: "InstaView", href: "#instaview" },
  { label: "Security", href: "#security" },
] as const;

/**
 * Sticky marketing header with an accessible mobile panel.
 *
 * This is a client component because the mobile menu needs open/closed state,
 * focus management and Escape handling. The desktop navigation is plain anchor
 * links, so it works with JavaScript unavailable.
 */
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes the panel and returns focus to the control that opened it,
  // so keyboard users are never stranded inside the menu.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--rm-stone)] bg-[color-mix(in_srgb,var(--rm-paper)_92%,transparent)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6 lg:px-8">
        <Link href="/" aria-label="Review & More home" className="rounded-md">
          {/* Above the fold on every marketing page — eager-load so it is not
              discovered late by the lazy-loading heuristic. */}
          <ReviewAndMoreLogo priority />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-9 items-center rounded-[var(--rm-radius)] px-3 text-[0.9375rem] font-medium text-[var(--rm-ink)] transition-colors hover:bg-[var(--rm-maroon-soft)] hover:text-[var(--rm-maroon)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={buildLoginUrl()}
            className="inline-flex min-h-9 items-center rounded-[var(--rm-radius)] px-3 text-[0.9375rem] font-medium text-[var(--rm-ink)] transition-colors hover:text-[var(--rm-maroon)]"
          >
            Login
          </a>
          <OpenInstaViewButton className="min-h-10 px-5" />
        </div>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex size-11 items-center justify-center rounded-[var(--rm-radius)] border border-[var(--rm-stone)] text-[var(--rm-charcoal)] lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Rendered only when open so its links are not reachable by keyboard
          while the panel is visually hidden. */}
      {open ? (
        <div
          id="marketing-mobile-nav"
          ref={panelRef}
          className="border-t border-[var(--rm-stone)] bg-[var(--rm-paper)] lg:hidden"
        >
          <nav aria-label="Main (mobile)" className="mx-auto w-full max-w-6xl px-6 py-4">
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center rounded-[var(--rm-radius)] px-3 text-base font-medium text-[var(--rm-charcoal)] hover:bg-[var(--rm-maroon-soft)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 flex flex-col gap-2 border-t border-[var(--rm-stone)] pt-3">
                <a
                  href={buildLoginUrl()}
                  className="flex min-h-12 items-center rounded-[var(--rm-radius)] px-3 text-base font-medium text-[var(--rm-charcoal)] hover:bg-[var(--rm-maroon-soft)]"
                >
                  Login
                </a>
                <OpenInstaViewButton className="min-h-12 w-full" />
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
