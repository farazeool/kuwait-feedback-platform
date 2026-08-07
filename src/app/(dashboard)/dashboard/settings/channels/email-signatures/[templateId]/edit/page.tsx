import { notFound } from "next/navigation";

import { getTemplate } from "@/features/distribution/templates";
import { SignatureForm } from "../../new-template/signature-form";

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = await getTemplate(templateId);
  if (!template || template.channel !== "email") notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Email Signatures</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Edit Email Signature Template</h1>
        <p className="mt-1 text-sm text-muted">Update this email signature feedback block</p>
      </div>
      <SignatureForm template={template} />
    </div>
  );
}
