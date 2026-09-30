"use client";

import { useState } from "react";
import type { TrustEvent } from "@/core/types";
import { EvidenceProvider, useEvidence, type EvidenceData } from "@/components/evidence/evidence-provider";
import { StrengthCard } from "./strength-card";
import { StatTile } from "./stat-tile";
import { WeeklyChart } from "./weekly-chart";
import { ActivityCard, IntegrityCard, ItemsCard, MomoCard, WeekdaysCard } from "./cards";
import { AskCard } from "./ask-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { formatDate, formatDecimal, formatMoney, formatPct, formatRange, initials } from "@/lib/format";

export interface ReportData extends EvidenceData {
  events: TrustEvent[];
}

/** The profile a lender reads. Used unchanged for the trader's own preview. */
export function ProfileReport({ data, mode, aiConfigured }: { data: ReportData; mode: "trader" | "lender"; aiConfigured: boolean }) {
  return (
    <EvidenceProvider data={data}>
      <ReportBody data={data} mode={mode} aiConfigured={aiConfigured} />
    </EvidenceProvider>
  );
}

function ReportBody({ data, mode, aiConfigured }: { data: ReportData; mode: "trader" | "lender"; aiConfigured: boolean }) {
  const { t, locale } = useI18n();
  const evidence = useEvidence();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const { trader, profile: p } = data;

  const trendColor =
    p.trend?.direction === "growing" ? "var(--good)" : p.trend?.direction === "declining" ? "var(--danger)" : "var(--ink)";
  const trendIcon = p.trend?.direction === "growing" ? "trendUp" : p.trend?.direction === "declining" ? "trendDown" : "trendFlat";
  const basisWeeks = p.weeks.filter((w) => !w.gap && (!w.partial || p.sales.weeklyBasis !== "full"));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast(t.common.copied);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      {/* ---------- header ---------- */}
      <header className="rise flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-[19px] font-semibold text-brand sm:h-16 sm:w-16">
            {initials(trader.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={mode === "lender" ? "info" : "brand"} icon={mode === "lender" ? "scale" : "eye"}>
                {mode === "lender" ? t.profile.lenderView : t.profile.yourProfile}
              </Badge>
              {trader.demo ? <Badge>{t.common.demo}</Badge> : null}
            </div>
            <h1 className="font-display mt-1.5 text-[34px] leading-[1.05] sm:text-[44px]">{trader.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
              <span>{trader.business}</span>
              <span className="text-ink-3">·</span>
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" size={15} className="text-ink-3" />
                {trader.market}, {trader.city}
              </span>
              {trader.providers.map((pr) => (
                <Badge key={pr} tone="neutral" icon="wallet">
                  {t.providers[pr]}
                </Badge>
              ))}
            </p>
          </div>
        </div>
        <div className="no-print flex gap-2">
          {mode === "lender" ? (
            <Button variant="secondary" icon={copied ? "check" : "link"} onClick={copyLink}>
              {t.profile.copyLink}
            </Button>
          ) : null}
          <Button variant="secondary" icon="printer" onClick={() => window.print()}>
            {t.profile.print}
          </Button>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-3">
        {p.period ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="calendar" size={15} />
            {t.profile.records(formatRange(p.period.start, p.period.end, locale))} · {t.common.pages(p.counts.pagesConfirmed)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Icon name="lock" size={15} />
          {trader.consent.granted && trader.consent.grantedAt
            ? t.profile.sharedOn(formatDate(trader.consent.grantedAt.slice(0, 10), locale, "long"))
            : t.profile.notShared}
        </span>
        {mode === "trader" ? <span>{t.profile.preview}</span> : null}
      </div>

      {p.counts.entriesPending ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-3 text-[13.5px] text-warn">
          <Icon name="history" size={17} className="mt-px" />
          {t.profile.pendingNote(p.counts.entriesPending)}
        </p>
      ) : null}

      {!p.hasData ? (
        <div className="mt-10 rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center">
          <Icon name="notebook" size={32} className="mx-auto text-ink-3" />
          <p className="mt-3 text-[17px] font-semibold">{t.profile.noData}</p>
          <p className="mx-auto mt-1 max-w-sm text-[14px] text-ink-3">{t.profile.noDataBody}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-12">
          {/* strength first on phones */}
          <div className="lg:hidden">
            <StrengthCard strength={p.strength} />
          </div>

          <div className="space-y-5 lg:col-span-8">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="col-span-2 sm:col-span-1">
                <StatTile
                  hero
                  label={t.profile.kpi.avgWeekly}
                  value={formatMoney(p.sales.avgWeekly, locale)}
                  sub={
                    p.sales.weeklyBasis === "full"
                      ? t.profile.kpi.avgWeeklySub(formatMoney(p.sales.medianWeekly, locale), p.sales.fullWeeks)
                      : t.profile.kpi.avgWeeklyPartial
                  }
                  onClick={() =>
                    evidence.open({ type: "entries", title: t.profile.kpi.avgWeekly, ids: basisWeeks.flatMap((w) => w.entryIds) })
                  }
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <StatTile
                  label={t.profile.kpi.trend}
                  icon={p.trend ? trendIcon : undefined}
                  accent={p.trend ? trendColor : undefined}
                  value={p.trend ? `${formatPct(p.trend.pctPer4Weeks, locale, { sign: true })}` : "—"}
                  sub={
                    p.trend
                      ? `${t.trend[p.trend.direction]} ${t.trend.per4} · ${
                          p.trend.recent !== undefined && p.trend.previous !== undefined
                            ? t.profile.kpi.trendSub(formatMoney(p.trend.recent, locale), formatMoney(p.trend.previous, locale))
                            : t.profile.kpi.trendSubShort(p.trend.weeksUsed)
                        }`
                      : t.profile.kpi.trendNone
                  }
                  onClick={
                    p.trend
                      ? () =>
                          evidence.open({
                            type: "entries",
                            title: t.profile.kpi.trend,
                            ids: p.weeks.filter((w) => p.trend?.weekKeys.includes(w.key)).flatMap((w) => w.entryIds),
                          })
                      : undefined
                  }
                />
              </div>
              <StatTile
                label={t.profile.kpi.tradingDays}
                value={t.profile.kpi.tradingDaysValue(formatDecimal(p.sales.activeDaysPerWeek, locale))}
                sub={t.profile.kpi.tradingDaysSub(p.sales.activeDays, formatMoney(p.sales.avgPerActiveDay, locale))}
                onClick={() => evidence.open({ type: "entries", title: t.profile.totalSales, ids: p.sales.entryIds })}
              />
              <StatTile
                label={t.profile.kpi.momo}
                value={p.momo.inflowIds.length ? formatPct(p.momo.rateAmount, locale) : "—"}
                sub={
                  p.momo.inflowIds.length
                    ? t.profile.kpi.momoSub(formatMoney(p.momo.corroboratedAmount, locale), formatMoney(p.momo.inflowAmount, locale))
                    : t.profile.kpi.momoNone
                }
                onClick={
                  p.momo.inflowIds.length
                    ? () => evidence.open({ type: "momoList", title: t.profile.kpi.momo, ids: p.momo.inflowIds })
                    : undefined
                }
              />
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface-2 px-5 py-3.5 text-[13px]">
              <button type="button" className="text-left" onClick={() => evidence.open({ type: "entries", title: t.profile.totalSales, ids: p.sales.entryIds })}>
                <span className="block text-ink-3">{t.profile.totalSales}</span>
                <span className="block text-[15px] font-semibold tabular">{formatMoney(p.sales.total, locale)}</span>
              </button>
              <button type="button" className="text-left" onClick={() => evidence.open({ type: "entries", title: t.profile.totalExpenses, ids: p.expenses.entryIds })}>
                <span className="block text-ink-3">{t.profile.totalExpenses}</span>
                <span className="block text-[15px] font-semibold tabular">{formatMoney(p.expenses.total, locale)}</span>
              </button>
              <div>
                <span className="block text-ink-3">{t.profile.net}</span>
                <span className="block text-[15px] font-semibold tabular">{formatMoney(p.net, locale)}</span>
              </div>
              {p.consistency ? (
                <div>
                  <span className="block text-ink-3">{t.chart.title}</span>
                  <span className="block text-[15px] font-semibold">{t.consistency[p.consistency.label]}</span>
                </div>
              ) : null}
            </div>

            <WeeklyChart weeks={p.weeks} />

            <div className="grid gap-5 md:grid-cols-2">
              <ItemsCard profile={p} />
              <WeekdaysCard profile={p} entries={data.entries} />
            </div>

            <MomoCard profile={p} momo={data.momo} />
            <IntegrityCard profile={p} sources={data.sources} />

            <div className="lg:hidden">
              <AskCard traderId={trader.id} profile={p} entries={data.entries} momo={data.momo} aiConfigured={aiConfigured} />
            </div>

            <ActivityCard events={data.events} />
          </div>

          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-24 space-y-5">
              <StrengthCard strength={p.strength} />
              <AskCard traderId={trader.id} profile={p} entries={data.entries} momo={data.momo} aiConfigured={aiConfigured} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
