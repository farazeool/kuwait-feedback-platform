import { expect, test } from "@playwright/test";

const publicPath = "/feedback/demo-salmiya-customer-satisfaction-2026";

test("renders the public survey in English and Arabic RTL", async ({ page }) => {
  await page.goto(publicPath);
  await expect(page.getByRole("heading", { name: "Customer Satisfaction" })).toBeVisible();
  await page.getByRole("button", { name: "ع" }).click();
  await expect(page.getByRole("heading", { name: "رضا العملاء" })).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
});

test("submits one valid anonymous response through the protected endpoint", async ({ page }) => {
  await page.goto(publicPath);
  await page.locator("fieldset").first().getByText("5", { exact: true }).click();
  await page.getByText("Friendly staff", { exact: true }).click();
  await page.waitForTimeout(1_600);
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
});

test("protects dashboard, export, and local QR routes", async ({ page, request }) => {
  await page.goto("/dashboard/surveys");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  const target = encodeURIComponent(`http://127.0.0.1:3100${publicPath}`);
  const response = await request.get(`/api/qr?format=svg&value=${target}`);
  expect(response.status()).toBe(401);
  const exportResponse = await request.get("/api/exports/responses?preset=7d");
  expect(exportResponse.status()).toBe(401);
});

test("renders the invitation-compatible account flow in Arabic RTL", async ({ page }) => {
  await page.goto("/signup?lang=ar&next=%2Finvite%2Fabcdef");
  await expect(page.getByRole("heading", { name: "إنشاء حساب" })).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
});
