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
  icons: {
    icon: [
      { url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230f6b4d'><circle cx='12' cy='12' r='10'/><path d='M8 12.5l3 3 7-7' stroke='white' stroke-width='2.5' fill='none'/></svg>", type: "image/svg+xml" },
    ],
  },
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
