import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { listTemplates } from "@/features/email-signature/templates";
import { SignatureForm } from "./signature-form";

export default async function NewTemplatePage() {
  const [templatesResult] = await Promise.all([listTemplates()]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Email Signatures</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">New Signature Template</h1>
        <p className="mt-1 text-sm text-muted">Configure an email signature feedback block for your team</p>
      </div>
      <SignatureForm surveys={templatesResult.surveys} />
    </div>
  );
}
