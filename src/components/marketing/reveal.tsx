"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper.
 *
 * Deliberately conservative: content is visible by default and is only hidden
 * once we know an IntersectionObserver is available and the user has not asked
 * for reduced motion. If JavaScript never runs, or the API is missing, the
 * content simply renders — motion is never required to read the page.
 *
 * The reveal state is written straight to a data attribute rather than held in
 * React state. The value is only ever consumed by CSS, so routing it through a
 * re-render would buy nothing and would trigger cascading renders on scroll.
 * No animation library: one keyframe in globals.css does the work.
 */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") return;

    // Already on screen at mount (above the fold): leave it visible rather than
    // hiding and re-showing, which would flash on first paint.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    node.dataset.revealed = "false";
    if (delay) node.style.animationDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.dataset.revealed = "true";
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`rm-reveal ${className}`}>
      {children}
    </div>
  );
}
