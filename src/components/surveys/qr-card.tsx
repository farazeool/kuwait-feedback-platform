import Image from "next/image";

import { CopyLinkButton } from "@/components/surveys/copy-link-button";

type QrCardProps = {
  locationNameEn: string;
  locationNameAr: string;
  feedbackUrl: string;
  primaryColor: string | null;
  status: "draft" | "active" | "archived";
};

export function QrCard({ locationNameEn, locationNameAr, feedbackUrl, primaryColor, status }: QrCardProps) {
  const qr = `/api/qr?value=${encodeURIComponent(feedbackUrl)}`;
  const isActive = status === "active";
  return (
    <article
      style={{ borderTopColor: primaryColor ?? undefined }}
      className="grid gap-5 rounded-3xl border border-t-4 border-border bg-white p-6 print:break-inside-avoid"
    >
      <div>
        <p className="font-bold">{locationNameEn}</p>
        <p dir="rtl" className="text-sm text-muted">
          {locationNameAr}
        </p>
        <p className={`mt-2 text-sm font-semibold ${isActive ? "text-emerald-700" : "text-amber-700"}`}>
          {isActive ? "Active and accepting feedback · نشط ويستقبل الملاحظات" : "Not currently active · غير نشط حالياً"}
        </p>
      </div>
      <Image
        unoptimized
        width={256}
        height={256}
        className="mx-auto aspect-square w-64"
        src={`${qr}&format=svg`}
        alt={`QR code for ${locationNameEn}`}
      />
      <div className="break-all rounded-xl bg-background p-3 text-xs">{feedbackUrl}</div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <CopyLinkButton
          value={feedbackUrl}
          labelEn="Copy link"
          labelAr="نسخ الرابط"
          copiedLabelEn="Copied"
          copiedLabelAr="تم النسخ"
        />
        <a
          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
          href={`${qr}&format=svg&download=1`}
        >
          Download SVG · تنزيل SVG
        </a>
        <a
          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
          href={`${qr}&format=png&download=1`}
        >
          Download PNG · تنزيل PNG
        </a>
      </div>
    </article>
  );
}
