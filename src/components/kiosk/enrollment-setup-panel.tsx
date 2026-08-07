"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Enrollment = { state: string; expiresAt?: string | null; openedAt?: string | null; usedAt?: string | null } | null;

export function EnrollmentSetupPanel({ kioskId, kioskName, open, onClose, onUpdated }: { kioskId: string; kioskName: string; open: boolean; onClose: () => void; onUpdated?: () => void }) {
  const [details, setDetails] = useState<Enrollment>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [regenerateConfirmed, setRegenerateConfirmed] = useState(false);
  const [revokeConfirmed, setRevokeConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch(`/api/admin/kiosks/${kioskId}/enrollment`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json() as { session?: Enrollment };
        setDetails(data.session ?? null);
        setRegenerateConfirmed(false);
        setRevokeConfirmed(false);
      }
    } catch {
      // Do nothing
    }
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void fetch(`/api/admin/kiosks/${kioskId}/enrollment`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const data = await response.json() as { session?: Enrollment };
        if (!cancelled) setDetails(data.session ?? null);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [open, kioskId]);
  if (!open) return null;

  async function issue(regenerate = false) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/kiosks/${kioskId}/enrollment${regenerate ? "/regenerate" : ""}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(regenerate ? { confirm: true } : {}) });
      if (!response.ok) throw new Error("Unable to create a setup link. Please try again.");
      const data = await response.json() as { setupUrl?: string };
      if (!data.setupUrl) throw new Error("Unable to create a setup link. Please try again.");
      setSetupUrl(data.setupUrl);
      setQr(await QRCode.toDataURL(data.setupUrl, { width: 360, margin: 2, errorCorrectionLevel: "M" }));
      await load(); onUpdated?.();
    } catch { setMessage("Unable to create a setup link. Please try again."); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!revokeConfirmed) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/kiosks/${kioskId}/enrollment`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      if (!response.ok) throw new Error("Unable to revoke the setup link. Please try again.");
      setSetupUrl(null); setQr(null); await load(); onUpdated?.();
    } catch { setMessage("Unable to revoke the setup link. Please try again."); }
    finally { setBusy(false); }
  }
  const copySetupUrl = async () => {
    if (!setupUrl) return;
    try {
      await navigator.clipboard.writeText(setupUrl);
      setMessage("Setup link copied. It is only available while this panel remains open.");
    } catch {
      setMessage("Unable to copy the setup link. Scan the QR code instead.");
    }
  };

  return <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="enrollment-title">
    <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:mx-auto sm:max-w-xl sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4"><div><Image src="/brand/review-and-more-logo-on-dark.png" alt="Review and More" width={156} height={32} className="mb-5 h-auto w-auto rounded bg-slate-950 p-2" /><h2 id="enrollment-title" className="text-xl font-bold">Set up {kioskName}</h2><p className="mt-1 text-sm text-slate-600">Create a one-time link, then scan it on the iPad. Links cannot be recovered after this panel closes.</p></div><button onClick={onClose} className="min-h-11 min-w-11 rounded-md border px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Close setup panel">Close</button></div>
      <div aria-live="polite" className="mt-4">{message && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>}</div>
      {setupUrl && qr ? <div className="mt-5 space-y-4"><div className="mx-auto w-fit rounded-xl border p-3"><Image src={qr} width={360} height={360} alt="QR code for this kiosk setup link" unoptimized /></div><button onClick={() => void copySetupUrl()} className="min-h-11 w-full rounded-md border px-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Copy setup link</button><p className="text-sm text-amber-800">This is the only time this setup link is shown. Complete setup on the iPad before closing this panel.</p></div> : <div className="mt-5 rounded-lg border p-4 text-sm"><p>Current status: <strong>{details?.state ?? "No setup link"}</strong>{details?.expiresAt ? ` · expires ${new Date(details.expiresAt).toLocaleString()}` : ""}</p>{details && <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={regenerateConfirmed} onChange={e => setRegenerateConfirmed(e.target.checked)} className="mt-1 size-4" />I understand generating a new link invalidates the current link.</label>}<button onClick={() => void issue(Boolean(details))} disabled={busy || (Boolean(details) && !regenerateConfirmed)} className="mt-4 min-h-11 w-full rounded-md bg-blue-700 px-4 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{busy ? "Working…" : details ? "Regenerate setup link" : "Create setup link"}</button></div>}
      {details && <div className="mt-5 border-t pt-4"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={revokeConfirmed} onChange={e => setRevokeConfirmed(e.target.checked)} className="mt-1 size-4" />I understand revoking prevents this setup link from being used.</label><button onClick={() => void revoke()} disabled={busy || !revokeConfirmed} className="mt-3 min-h-11 w-full rounded-md border border-red-300 px-4 text-red-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Revoke setup link</button></div>}
    </section></div>;
}