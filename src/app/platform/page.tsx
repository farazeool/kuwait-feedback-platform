import Link from "next/link";
import { getPlatformOverview } from "@/features/platform/server";
import { getMessages } from "@/lib/i18n/messages";

export default async function PlatformPage() { const result = await getPlatformOverview(); const m = getMessages(result.context.profile.locale); return <div className="grid gap-7"><h1 className="text-3xl font-bold">{m["platform.title"]}</h1><div className="grid gap-4 sm:grid-cols-2"><article className="rounded-3xl border border-border bg-white p-6"><p className="text-sm text-muted">Active organizations</p><p className="mt-2 text-4xl font-bold">{result.overview.active_organizations}</p></article><article className="rounded-3xl border border-border bg-white p-6"><p className="text-sm text-muted">Inactive organizations</p><p className="mt-2 text-4xl font-bold">{result.overview.inactive_organizations}</p></article></div><Link className="font-bold text-brand" href="/platform/organizations">{m["platform.organizations"]} →</Link></div>; }
