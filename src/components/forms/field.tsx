import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const inputClass = "min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/15";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, id, name, ...props }: FieldProps) {
  const fieldId = id ?? name;
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor={fieldId}>
      {label}
      <input {...props} id={fieldId} name={name} className={inputClass} />
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: React.ReactNode;
};

export function SelectField({ label, id, name, children, ...props }: SelectFieldProps) {
  const fieldId = id ?? name;
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor={fieldId}>
      {label}
      <select {...props} id={fieldId} name={name} className={inputClass}>
        {children}
      </select>
    </label>
  );
}
