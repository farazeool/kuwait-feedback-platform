import Link from "next/link";

import { navigationForRole } from "@/features/dashboard/navigation";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import type { Database } from "@/types/database";

type AppRole = Database["public"]["Enums"]["app_role"];

export function DashboardSidebar({ role, locale }: { role: AppRole; locale: Locale }) {
  const messages = getMessages(locale);
  return (
    <aside className="border-b border-border bg-brand text-white print:hidden lg:fixed lg:inset-y-0 lg:start-0 lg:w-64 lg:border-b-0 lg:border-e lg:border-emerald-950/20">
      <div className="flex h-16 items-center px-5 text-lg font-bold tracking-tight lg:h-20">{messages["app.name"]}</div>
      <nav aria-label="Dashboard" className="flex flex-wrap gap-1 px-3 pb-3 lg:flex-col lg:gap-0.5 lg:px-3 lg:pb-4">
        {navigationForRole(role).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {messages[item.label]}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
