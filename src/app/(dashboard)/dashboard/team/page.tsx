import { EmptyState } from "@/components/dashboard/empty-state";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
export default async function TeamPage() { await requireOrganizationManagementContext(); return <div className="grid gap-7"><h1 className="text-3xl font-bold">Team</h1><EmptyState title="Invitations are backend-ready" description="Secure hashed invitation tokens, expiration, revocation, and single-use acceptance are ready. Email delivery and team management UI are intentionally deferred." /></div>; }
