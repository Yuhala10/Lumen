import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3/80 shadow-soft transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-medium text-ink-2">
      <span>{children}</span>
      {hint ? <span className="text-[12px] font-normal text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-32 py-3 leading-6", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(CONTROL, "h-11 appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[12.5px] leading-5 text-ink-3">{children}</p>;
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12.5px] font-medium leading-5 text-danger">
      {children}
    </p>
  );
}
