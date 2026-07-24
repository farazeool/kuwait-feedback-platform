import { listTemplates } from "@/features/distribution/templates";
import { SignatureForm } from "./signature-form";

export default async function NewEmailTemplatePage() {
  const [templatesResult] = await Promise.all([listTemplates("email")]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Email Signatures</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">New Email Signature Template</h1>
        <p className="mt-1 text-sm text-muted">Configure an email signature feedback block (uses the generic distribution template system)</p>
      </div>
      <SignatureForm surveys={templatesResult.surveys} />
    </div>
  );
}
