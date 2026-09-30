"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl bg-sunken p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-lg font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-9 px-3.5 text-[13.5px]",
              active ? "bg-surface text-ink shadow-soft" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
