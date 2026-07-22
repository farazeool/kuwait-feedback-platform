import { saveRatingScale } from "@/features/rating-scales/actions";
import { getRatingScale } from "@/features/rating-scales/server";
import { getMessages } from "@/lib/i18n/messages";

interface Props {
  params: Promise<{ scaleKey?: string }>;
}

export default async function RatingScaleFormPage({ params }: Props) {
  const { scaleKey } = await params;
  const m = getMessages("en");
  const existing = scaleKey ? await getRatingScale(scaleKey).catch(() => null) : null;
  const input = "rounded-lg border border-border px-3 py-2 text-sm";
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{scaleKey ? "Edit rating scale" : "New rating scale"}</h1>
      <form action={saveRatingScale} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
        {scaleKey ? <input type="hidden" name="key" value={scaleKey} /> : <label className="grid gap-2 font-semibold">Key<input name="key" className={input} /></label>}
        <label className="grid gap-2 font-semibold">English name<input name="nameEn" defaultValue={existing?.scale?.name_en ?? ""} className={input} required /></label>
        <label className="grid gap-2 font-semibold">Arabic name<input name="nameAr" defaultValue={existing?.scale?.name_ar ?? ""} dir="rtl" className={input} /></label>
        <label className="grid gap-2 font-semibold">Scale min<input type="number" name="scaleMin" defaultValue={existing?.scale?.scale_min ?? 1} className={input} required /></label>
        <label className="grid gap-2 font-semibold">Scale max<input type="number" name="scaleMax" defaultValue={existing?.scale?.scale_max ?? 5} className={input} required /></label>
        <label className="grid gap-2 font-semibold">Satisfied min<input type="number" name="satisfiedMin" defaultValue={existing?.scale?.satisfied_min ?? 4} className={input} required /></label>
        <label className="grid gap-2 font-semibold">Negative max<input type="number" name="negativeMax" defaultValue={existing?.scale?.negative_max ?? 2} className={input} required /></label>
        <label className="grid gap-2 font-semibold">Active<select name="isActive" defaultValue={existing?.scale?.is_active ? "true" : "false"} className={input}><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <div className="md:col-span-2">
          <p className="text-sm font-semibold mb-2">Points</p>
          <div className="grid gap-2">
            {[1, 2, 3, 4, 5].map((val) => {
              const pt = existing?.points?.find((p: { value: number; label_en: string; label_ar: string }) => p.value === val);
              return (
                <div key={val} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                  <span className="text-sm font-medium w-12">{val}</span>
                  <input name={`point_label_en_${val}`} defaultValue={pt?.label_en ?? ""} placeholder="Label EN" className={input} />
                  <input name={`point_label_ar_${val}`} defaultValue={pt?.label_ar ?? ""} placeholder="Label AR" dir="rtl" className={input} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-2"><button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">{m["common.save"]}</button></div>
      </form>
    </div>
  );
}
