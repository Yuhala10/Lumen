import { cn } from "@/lib/cn";

/** A thin meter. The track is a lighter step of the fill's own colour. */
export function Meter({
  value,
  tone = "brand",
  className,
  label,
}: {
  value: number;
  tone?: "brand" | "good" | "warn" | "danger" | "chart";
  className?: string;
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = {
    brand: "var(--brand)",
    good: "var(--good)",
    warn: "var(--warn)",
    danger: "var(--danger)",
    chart: "var(--chart-1)",
  }[tone];
  return (
    <div
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", className)}
      style={{ background: `color-mix(in oklab, ${fill} 16%, transparent)` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${pct}%`, background: fill }}
      />
    </div>
  );
}
