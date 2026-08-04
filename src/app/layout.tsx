import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});

/**
 * Root metadata — the fallback for every route in the app.
 *
 * Individual routes override `title`/`description` (the marketing homepage sets
 * its own canonical + Open Graph data). Icons are intentionally NOT declared
 * here: `src/app/favicon.ico`, `icon.png` and `apple-icon.png` are picked up by
 * the App Router file convention and hashed for cache-busting automatically.
 */
export const metadata: Metadata = {
  title: {
    default: "Review & More | Customer Feedback and Experience Management",
    template: "%s | Review & More",
  },
  description:
    "Collect and manage customer feedback through kiosks, QR codes and employee email signatures. Connect every response to the right employee, location, survey and channel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className={`h-full antialiased ${inter.variable} ${notoSansArabic.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
