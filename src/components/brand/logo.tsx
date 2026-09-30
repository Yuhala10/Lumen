import { cn } from "@/lib/cn";

/**
 * The mark: a page of three written lines, the middle one highlighted.
 * It is the product in one picture: the exact line of evidence.
 */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <rect x="7" y="14" width="18" height="5.5" rx="2" fill="#f7cc3e" />
      <path d="M9 10h14M9 16.75h11M9 23h8" stroke="var(--brand-ink)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[26px] leading-none tracking-[-0.02em] text-ink">Trust</span>
    </span>
  );
}
