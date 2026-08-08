"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { navigationForRole } from "@/features/dashboard/navigation";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import type { Database } from "@/types/database";

type AppRole = Database["public"]["Enums"]["app_role"];

function NavItem({
  href,
  label,
  isActive,
  isPending,
  onNavigate,
  icon,
  isArabic,
}: {
  href: string;
  label: string;
  isActive: boolean;
  isPending: boolean;
  onNavigate: () => void;
  icon: string;
  isArabic: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      scroll={false}
      aria-current={isActive ? "page" : undefined}
      aria-busy={isPending}
      onClick={onNavigate}
      className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ${
        isActive
          ? "bg-white/15 text-white shadow-sm"
          : "text-blue-100/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute start-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-white" />
      )}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-5 shrink-0 opacity-70"
        aria-hidden="true"
      >
        {icon === "overview" && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>}
        {icon === "locations" && <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/></>}
        {icon === "surveys" && <><path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>}
        {icon === "responses" && <><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>}
        {icon === "alerts" && <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>}
        {icon === "kpi" && <><path d="M12 20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M6 20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>}
        {icon === "reports" && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>}
        {icon === "correctiveActions" && <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>}
        {icon === "evidence" && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>}
        {icon === "investigations" && <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 16v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="8" r="1" fill="currentColor"/></>}
        {icon === "team" && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>}
        {icon === "settings" && <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/></>}
        {icon === "account" && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></>}
        {icon === "platform" && <><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></>}
        {icon === "channels" && <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>}
      </svg>
      <span>{label}</span>
      {isPending ? (
        <span
          className="ms-auto size-3 animate-pulse rounded-full bg-white/80"
          aria-label={isArabic ? "جارٍ التحميل" : "Loading"}
        />
      ) : null}
    </Link>
  );
}

export function DashboardSidebar({ role, locale }: { role: AppRole; locale: Locale }) {
  const pathname = usePathname();
  const [pendingNavigation, setPendingNavigation] = useState<{ href: string; fromPathname: string } | null>(null);
  const messages = getMessages(locale);
  const items = navigationForRole(role);
  const isArabic = locale === "ar";

  return (
    <aside
      className="fixed inset-y-0 start-0 z-30 flex w-64 flex-col border-e border-blue-950/20 bg-brand print:hidden"
      aria-label={isArabic ? "القائمة الرئيسية" : "Dashboard navigation"}
    >
      {/* Brand header */}
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <Image src="/brand/instaview-logo-official.png" alt="InstaView by Review & More" width={186} height={55} priority className="h-auto w-[172px] rounded bg-white px-2 py-1" />
        <div className="min-w-0">
          <p className="sr-only">{messages["app.name"]}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <div className="grid gap-1">
          {items.map((item) => {
            const iconKey = item.label.replace("nav.", "");
            const isCurrent = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            const hasUnresolvedPending = pendingNavigation?.fromPathname === pathname;
            const isPending = hasUnresolvedPending && pendingNavigation.href === item.href;
            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={messages[item.label]}
                isActive={hasUnresolvedPending ? isPending : isCurrent}
                isPending={isPending}
                onNavigate={() => {
                  if (!isCurrent) setPendingNavigation({ href: item.href, fromPathname: pathname });
                }}
                icon={iconKey}
                isArabic={isArabic}
              />
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-white/10">
            <svg viewBox="0 0 24 24" fill="none" className="size-4 text-blue-200">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xs font-medium text-blue-200/80">
            {isArabic ? "جميع البيانات محمية" : "All data protected"}
          </span>
        </div>
      </div>
    </aside>
  );
}
