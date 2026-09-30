import Link from "next/link";
import type { Trader } from "@/core/types";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { Dict } from "@/lib/i18n";

/** Shared header for the trader's own screens, with the four steps as tabs. */
export function TraderHeader({
  trader,
  t,
  active,
  pending,
}: {
  trader: Trader;
  t: Dict;
  active: "hub" | "capture" | "review" | "profile" | "share";
  pending?: number;
}) {
  const tabs = [
    { key: "capture", href: "capture", label: t.hub.capture.title, icon: "camera" as const },
    { key: "review", href: "review", label: t.hub.review.title, icon: "checkCircle" as const },
    { key: "profile", href: "profile", label: t.hub.profile.title, icon: "chart" as const },
    { key: "share", href: "share", label: t.hub.share.title, icon: "link" as const },
  ];
  return (
    <div className="no-print border-b border-line bg-surface/60">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <Link href={`/trader/${trader.id}`} className="group inline-flex items-center gap-3 rounded-xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-[13px] font-semibold text-brand">
            {initials(trader.name)}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[15px] font-semibold group-hover:text-brand">
              {trader.name}
              {trader.demo ? <Badge className="h-5 px-2 text-[11px]">{t.common.demo}</Badge> : null}
            </span>
            <span className="block text-[12.5px] text-ink-3">
              {trader.business} · {trader.market}, {trader.city}
            </span>
          </span>
        </Link>
        <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none]" aria-label={trader.name}>
          {tabs.map((tab) => {
            const on = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={`/trader/${trader.id}/${tab.href}`}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-medium transition-colors",
                  on ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink",
                )}
              >
                <Icon name={tab.icon} size={16} />
                {tab.label}
                {tab.key === "review" && pending ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warn-soft px-1.5 text-[11px] font-semibold text-warn">{pending}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
