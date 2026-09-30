"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** A figure with its label; tapping it opens the evidence behind it. */
export function StatTile({
  label,
  value,
  sub,
  icon,
  accent,
  onClick,
  hero = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  accent?: string;
  onClick?: () => void;
  hero?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
        {onClick ? <Icon name="chevronRight" size={16} className="text-ink-3 transition-transform group-hover:translate-x-0.5" /> : null}
      </div>
      <p
        className={cn("mt-2 flex items-center gap-1.5 font-semibold tracking-[-0.025em] text-ink", hero ? "text-[30px] sm:text-[34px]" : "text-[22px] sm:text-[24px]")}
        style={accent ? { color: accent } : undefined}
      >
        {icon ? <Icon name={icon} size={hero ? 26 : 22} strokeWidth={2} /> : null}
        <span className="min-w-0 truncate">{value}</span>
      </p>
      {sub ? <p className="mt-1.5 text-[12.5px] leading-5 text-ink-3">{sub}</p> : null}
    </>
  );
  const cls = "group block h-full w-full rounded-2xl border border-line bg-surface p-4 text-left shadow-card sm:p-5";
  if (!onClick) return <div className={cls}>{content}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(cls, "transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong active:translate-y-0")}>
      {content}
    </button>
  );
}
