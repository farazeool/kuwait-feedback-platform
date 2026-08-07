/**
 * @vitest-environment jsdom
 *
 * Scoped to this file so the rest of the suite keeps running in the faster
 * `node` environment configured in vitest.config.ts.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MarketingHeader } from "./marketing-header";


/**
 * The header is the only interactive element on the marketing homepage that a
 * visitor must use to reach the product, so its links are asserted against the
 * real InstaView hostname rather than a mock.
 */
const APP_ORIGIN = "https://instaview.reviewandmore.tech";

describe("MarketingHeader", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP_ORIGIN;
    process.env.NEXT_PUBLIC_MARKETING_URL = "https://www.reviewandmore.tech";
  });

  afterEach(() => {
    cleanup();
  });


  it("sends both desktop sign-in affordances to the InstaView login route", () => {
    render(<MarketingHeader />);

    const desktopNav = screen.getByRole("navigation", { name: "Main" });
    expect(desktopNav).toBeTruthy();

    // Every "log in" style control must be an absolute InstaView URL: a relative
    // /login on the marketing host would depend on a middleware hop. Matched on
    // the origin rather than the word "instaview", which also appears as an
    // in-page anchor (#instaview) in the nav.
    const loginLinks = screen
      .getAllByRole("link")
      .filter((link) => (link.getAttribute("href") ?? "").startsWith(APP_ORIGIN));


    expect(loginLinks.length).toBeGreaterThan(0);
    for (const link of loginLinks) {
      expect(link.getAttribute("href")).toBe(`${APP_ORIGIN}/login`);
    }
  });

  it("exposes the mobile menu as a labelled, collapsed toggle before interaction", () => {
    render(<MarketingHeader />);

    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("marketing-mobile-nav");

    // Collapsed means absent, not merely visually hidden, so assistive
    // technology cannot tab into a closed menu.
    expect(screen.queryByRole("navigation", { name: "Main (mobile)" })).toBeNull();
  });

  it("opens and closes the mobile menu, keeping aria-expanded in sync", async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const mobileNav = screen.getByRole("navigation", { name: "Main (mobile)" });
    const toggle = screen.getByRole("button", { name: "Close menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    // The mobile menu must carry its own working login link; a menu that only
    // scrolls the page would leave phone visitors with no way into the product.
    const mobileLogin = within(mobileNav)
      .getAllByRole("link")
      .find((link: HTMLElement) => (link.getAttribute("href") ?? "").startsWith(APP_ORIGIN));
    expect(mobileLogin?.getAttribute("href")).toBe(`${APP_ORIGIN}/login`);


    await user.click(toggle);
    expect(screen.queryByRole("navigation", { name: "Main (mobile)" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("closes the mobile menu when a section link is chosen", async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Main (mobile)" });

    const anchorLink = within(mobileNav)
      .getAllByRole("link")
      .find((link: HTMLElement) => (link.getAttribute("href") ?? "").startsWith("#"));

    expect(anchorLink).toBeTruthy();

    await user.click(anchorLink!);

    // Leaving the overlay open would cover the section the visitor just asked for.
    expect(screen.queryByRole("navigation", { name: "Main (mobile)" })).toBeNull();
  });

  it("keeps in-page navigation as real anchors so it works without JavaScript", () => {
    render(<MarketingHeader />);

    const desktopNav = screen.getByRole("navigation", { name: "Main" });
    const anchors = within(desktopNav).getAllByRole("link");

    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") ?? "";
      // No empty or placeholder targets: every nav item must resolve somewhere.
      expect(href).not.toBe("");
      expect(href).not.toBe("#");
      expect(anchor.textContent?.trim()).not.toBe("");
    }
  });

  it("labels the home link for screen readers, since the logo carries no text", () => {
    render(<MarketingHeader />);

    const home = screen.getByRole("link", { name: "Review & More home" });
    expect(home.getAttribute("href")).toBe("/");
  });
});
