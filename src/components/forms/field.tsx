"use client";

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

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function PasswordField({ label, id, name, className, ...props }: PasswordFieldProps) {
  const fieldId = id ?? name;
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor={fieldId}>
      {label}
      <div className="relative">
        <input
          {...props}
          id={fieldId}
          name={name}
          type="password"
          className={`${inputClass} w-full pe-10`}
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute inset-y-0 end-0 flex items-center px-3 text-muted hover:text-foreground"
          aria-label="Toggle password visibility"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
            input.type = input.type === "password" ? "text" : "password";
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      </div>
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
