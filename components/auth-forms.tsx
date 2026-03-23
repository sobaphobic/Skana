import type { ReactNode } from "react";

const formControlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

export function FormField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-crm-cream/95">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={formControlClass}
      />
    </div>
  );
}

export function FormSelect({
  id,
  name,
  label,
  required = true,
  children,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-crm-cream/95">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        className={`${formControlClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f2e8cf' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        }}
      >
        {children}
      </select>
    </div>
  );
}

export function FormTextarea({
  id,
  name,
  label,
  placeholder,
  rows = 4,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-crm-cream/95">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        className={`${formControlClass} min-h-[6rem] resize-y`}
      />
    </div>
  );
}

export function PrimarySubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-2 w-full rounded-xl border-2 border-white/35 bg-white px-4 py-3.5 text-sm font-bold tracking-wide text-crm-bg shadow-[0_6px_24px_rgba(0,0,0,0.22)] transition hover:border-crm-cream hover:bg-crm-cream hover:shadow-[0_8px_28px_rgba(0,0,0,0.28)] active:scale-[0.99]"
    >
      {children}
    </button>
  );
}
