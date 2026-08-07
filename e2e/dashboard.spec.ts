import { expect, test } from "@playwright/test";

const OWNER_CREDENTIALS = { email: "owner@demo.kuwait-feedback.test", password: "Test1234!" };

test.describe("Dashboard analytics", () => {
  test("logs in and renders the dashboard with analytics", async ({ page }) => {
    // Navigate to login (baseURL from config)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill in credentials
    await page.fill('input[name="email"]', OWNER_CREDENTIALS.email);
    await page.fill('input[name="password"]', OWNER_CREDENTIALS.password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Verify the page renders without errors
    await expect(page.locator("h1")).toContainText("Feedback overview");
  });

  test("dashboard shows KPI cards with data", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[name="email"]', OWNER_CREDENTIALS.email);
    await page.fill('input[name="password"]', OWNER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Check for KPI cards
    await expect(page.locator("text=All-time responses")).toBeVisible();
    await expect(page.locator("text=Responses in range")).toBeVisible();
    await expect(page.locator("text=Average rating")).toBeVisible();
    await expect(page.locator("text=Low-score responses")).toBeVisible();
    await expect(page.locator("text=Open alerts")).toBeVisible();
  });

  test("no browser console errors when loading dashboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    // Login
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[name="email"]', OWNER_CREDENTIALS.email);
    await page.fill('input[name="password"]', OWNER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Wait for charts and data to render
    await page.waitForTimeout(3000);

    // Check no analytics-related errors
    const analyticsErrors = errors.filter(
      (e) => e.toLowerCase().includes("analytics") || e.toLowerCase().includes("unable to load")
    );
    expect(analyticsErrors).toHaveLength(0);
  });
});
