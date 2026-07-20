import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, id, name, ...props }: FieldProps) {
  const fieldId = id ?? name;
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor={fieldId}>
      {label}
      <input
        {...props}
        id={fieldId}
        name={name}
        className="min-h-11 rounded-xl border border-border bg-white px-3 py-2 font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
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
    <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor={fieldId}>
      {label}
      <select
        {...props}
        id={fieldId}
        name={name}
        className="min-h-11 rounded-xl border border-border bg-white px-3 py-2 font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        {children}
      </select>
    </label>
  );
}
