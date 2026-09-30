import { Portfolio, type PortfolioRow } from "@/components/lender/portfolio";
import { getServerDict } from "@/lib/i18n/server";
import { listSummaries } from "@/server/services";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerDict();
  return { title: t.lender.title };
}

export default async function LenderPage() {
  const { t } = await getServerDict();
  const rows: PortfolioRow[] = (await listSummaries())
    .filter((s) => s.trader.consent.granted)
    .map((s) => ({
      trader: {
        id: s.trader.id,
        name: s.trader.name,
        business: s.trader.business,
        market: s.trader.market,
        city: s.trader.city,
        demo: s.trader.demo,
        consent: s.trader.consent,
      },
      strength: s.strength,
      avgWeekly: s.avgWeekly,
      trend: s.trend,
      period: s.period ? { start: s.period.start, end: s.period.end } : null,
      momoRate: s.momoRate,
      momoInflows: s.momoInflows,
      lastActivity: s.lastActivity,
    }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <div className="rise mb-8">
        <h1 className="font-display text-[38px] leading-tight sm:text-[46px]">{t.lender.title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{t.lender.subtitle}</p>
      </div>
      <Portfolio rows={rows} />
    </div>
  );
}
