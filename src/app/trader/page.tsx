import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { StrengthRing } from "@/components/profile/strength-card";
import { getServerDict } from "@/lib/i18n/server";
import { formatMoney, initials } from "@/lib/format";
import { listSummaries } from "@/server/services";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerDict();
  return { title: t.traders.title };
}

export default async function TradersPage() {
  const { t, locale } = await getServerDict();
  const summaries = await listSummaries();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <div className="rise">
        <h1 className="font-display text-[38px] leading-tight sm:text-[46px]">{t.traders.title}</h1>
        <p className="mt-2 text-[15px] text-ink-2">{t.traders.subtitle}</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/trader/new"
          className="group flex min-h-48 flex-col justify-between rounded-2xl border border-dashed border-line-strong bg-surface/50 p-5 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand hover:bg-surface"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-soft transition-transform group-hover:scale-105">
            <Icon name="plus" size={22} />
          </span>
          <span>
            <span className="block text-[16px] font-semibold">{t.traders.new}</span>
            <span className="mt-1 block text-[13.5px] text-ink-3">{t.traders.newHint}</span>
          </span>
        </Link>

        {summaries.map((s, i) => (
          <Link
            key={s.trader.id}
            href={`/trader/${s.trader.id}`}
            className="rise group flex min-h-48 flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
            style={{ animationDelay: `${60 + i * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[15px] font-semibold text-brand">
                  {initials(s.trader.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-semibold">{s.trader.name}</span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {s.trader.business} · {s.trader.city}
                  </span>
                </span>
              </div>
              <StrengthRing score={s.strength.score} grade={s.strength.grade} size={46} />
            </div>
            <div className="mt-5">
              <div className="flex flex-wrap gap-1.5">
                {s.trader.demo ? <Badge>{t.common.demo}</Badge> : null}
                <Badge tone={s.trader.consent.granted ? "brand" : "neutral"} icon={s.trader.consent.granted ? "link" : "lock"}>
                  {s.trader.consent.granted ? t.traders.shared : t.traders.notShared}
                </Badge>
                {s.entriesPending ? (
                  <Badge tone="warn" icon="pencil">
                    {t.traders.waiting(s.entriesPending)}
                  </Badge>
                ) : s.pages ? (
                  <Badge tone="good" icon="check">
                    {t.traders.allChecked}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                <span className="text-[12.5px] text-ink-3">
                  {s.pages ? t.common.pages(s.pages) : t.traders.empty}
                </span>
                {s.avgWeekly ? (
                  <span className="text-[14px] font-semibold tabular">
                    {formatMoney(s.avgWeekly, locale)}
                    <span className="font-normal text-ink-3"> / {t.common.weekShort}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
