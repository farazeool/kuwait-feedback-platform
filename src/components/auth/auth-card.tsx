import Link from "next/link";
import { getMessages, type Locale } from "@/lib/i18n/messages";

export function AuthCard({
  title,
  description,
  children,
  footer,
  locale = "en",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: { label: string; href: string; linkLabel: string };
  locale?: Locale;
}) {
  const messages = getMessages(locale);
  return (
    <main lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 sm:p-8">
        <Link href="/" className="text-sm font-bold text-brand">
          {messages["app.name"]}
        </Link>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
        <div className="mt-6">{children}</div>
        {footer ? (
          <p className="mt-6 text-center text-sm text-muted">
            {footer.label}{" "}
            <Link className="font-semibold text-brand hover:underline" href={footer.href}>
              {footer.linkLabel}
            </Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
