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

export const metadata: Metadata = {
  title: {
    default: "Kuwait Feedback Platform",
    template: "%s | Kuwait Feedback Platform",
  },
  description:
    "Multi-tenant customer feedback and branch insights for businesses in Kuwait.",
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
