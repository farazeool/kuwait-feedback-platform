import { EmptyState } from "@/components/dashboard/empty-state";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
export default async function SettingsPage() { await requireOrganizationManagementContext(); return <div className="grid gap-7"><h1 className="text-3xl font-bold">Settings</h1><EmptyState title="Organization settings" description="The secure shell is ready for organization profile and localization settings in a future milestone." /></div>; }
