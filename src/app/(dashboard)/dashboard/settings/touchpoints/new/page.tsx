import { listTouchpoints } from "@/features/touchpoints/server";
import { saveTouchpoint } from "@/features/touchpoints/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function NewTouchpointPage() {
  const result = await listTouchpoints();
  const m = getMessages(result.context.profile.locale);
  const input = "rounded-lg border border-border px-3 py-2 text-sm";
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">New touchpoint</h1>
      <form action={saveTouchpoint} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
        <label className="grid gap-2 font-semibold">English name<input required name="nameEn" className={input} /></label>
        <label className="grid gap-2 font-semibold">Arabic name<input name="nameAr" dir="rtl" className={input} /></label>
        <label className="grid gap-2 font-semibold">Slug<input required name="slug" className={input} /></label>
        <label className="grid gap-2 font-semibold">Channel<select name="channel" className={input}><option value="qr">QR</option><option value="kiosk">Kiosk</option><option value="web">Web</option></select></label>
        <label className="grid gap-2 font-semibold">Location<select name="locationId" defaultValue={result.locations[0]?.id ?? ""} className={input}>{result.locations.map((loc) => <option key={loc.id} value={loc.id}>{result.context.profile.locale === "ar" ? loc.name_ar : loc.name_en}</option>)}</select></label>
        <label className="grid gap-2 font-semibold">Department<select name="departmentId" defaultValue={result.departments[0]?.id ?? ""} className={input}>{result.departments.map((dept) => <option key={dept.id} value={dept.id}>{result.context.profile.locale === "ar" ? dept.name_ar : dept.name_en}</option>)}</select></label>
        <label className="grid gap-2 font-semibold">Survey<select name="surveyId" className={input}><option value="">None</option>{result.surveys.map((s) => <option key={s.id} value={s.id}>{result.context.profile.locale === "ar" ? s.title_ar : s.title_en}</option>)}</select></label>
        <label className="grid gap-2 font-semibold">Status<select name="status" className={input}><option value="active">Active</option><option value="archived">Archived</option></select></label>
        <div className="md:col-span-2"><button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">{m["common.save"]}</button></div>
      </form>
    </div>
  );
}
