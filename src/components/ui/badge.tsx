import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export type Tone = "neutral" | "brand" | "good" | "warn" | "danger" | "info" | "marker";

const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  marker: "bg-marker text-ink",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium leading-none whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={13} strokeWidth={2} /> : null}
      {children}
    </span>
  );
}
