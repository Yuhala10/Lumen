"use client";

import { useState } from "react";
import type { Entry, MomoTx, Source, TrustEvent } from "@/core/types";
import type { Profile } from "@/core/understand/profile";
import { weekday } from "@/core/dates";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useEvidence } from "@/components/evidence/evidence-provider";
import { useI18n } from "@/lib/i18n/context";
import { formatCompact, formatDate, formatDateTime, formatMoney, formatPct } from "@/lib/format";
import { cn } from "@/lib/cn";

/* ---------------- What sells ---------------- */

export function ItemsCard({ profile }: { profile: Profile }) {
  const { t, locale } = useI18n();
  const evidence = useEvidence();
  const top = profile.items.slice(0, 6);
  const rest = profile.items.slice(6);
  const max = Math.max(1, ...top.map((i) => i.sales));
  return (
    <Card className="print-break">
      <CardHeader title={t.profile.items} subtitle={t.profile.itemsSub} />
      <ul className="space-y-1 px-3 pb-4 pt-3 sm:px-4">
        {top.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              onClick={() => evidence.open({ type: "entries", title: it.label, ids: it.entryIds })}
              className="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="truncate font-medium">{it.label}</span>
                <span className="shrink-0 tabular text-ink-2">
                  {formatMoney(it.sales, locale)} <span className="text-ink-3">· {formatPct(it.share, locale)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full" style={{ background: "color-mix(in oklab, var(--chart-1) 14%, transparent)" }}>
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${(it.sales / max) * 100}%` }} />
              </div>
            </button>
          </li>
        ))}
        {rest.length ? (
          <li>
            <button
              type="button"
              onClick={() => evidence.open({ type: "entries", title: t.profile.others(rest.length), ids: rest.flatMap((r) => r.entryIds) })}
              className="w-full rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              {t.profile.others(rest.length)} · {formatMoney(rest.reduce((s, r) => s + r.sales, 0), locale)}
            </button>
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

/* ---------------- Best days ---------------- */

export function WeekdaysCard({ profile, entries }: { profile: Profile; entries: Entry[] }) {
  const { t, locale } = useI18n();
  const evidence = useEvidence();
  const days = profile.weekdays.filter((d) => d.days > 0);
  const max = Math.max(1, ...days.map((d) => d.avgSales));
  const best = days.reduce((b, d) => (!b || d.avgSales > b.avgSales ? d : b), days[0]);
  const counted = new Set(profile.sales.entryIds);
  return (
    <Card className="print-break">
      <CardHeader title={t.profile.weekdays} subtitle={t.profile.weekdaysSub} />
      <ul className="space-y-1 px-3 pb-4 pt-3 sm:px-4">
        {days.map((d) => (
          <li key={d.day}>
            <button
              type="button"
              onClick={() =>
                evidence.open({
                  type: "entries",
                  title: t.weekdays[d.day],
                  ids: entries.filter((e) => counted.has(e.id) && weekday(e.date) === d.day).map((e) => e.id),
                })
              }
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="w-10 shrink-0 text-[13px] font-medium text-ink-2">{t.weekdaysShort[d.day]}</span>
              <span className="h-2 flex-1 rounded-full" style={{ background: "color-mix(in oklab, var(--chart-1) 14%, transparent)" }}>
                <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(d.avgSales / max) * 100}%` }} />
              </span>
              <span className={cn("w-16 shrink-0 text-right text-[13px] tabular", d === best ? "font-semibold text-ink" : "text-ink-3")}>
                {formatCompact(d.avgSales, locale)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Mobile money ---------------- */

export function MomoCard({ profile, momo }: { profile: Profile; momo: MomoTx[] }) {
  const { t, locale } = useI18n();
  const evidence = useEvidence();
  const m = profile.momo;
  const byId = new Map(momo.map((x) => [x.id, x]));
  const unmatchedAmount = m.inflowAmount - m.corroboratedAmount;
  const backedShare = m.inflowAmount ? m.corroboratedAmount / m.inflowAmount : 0;
  const outTotal = m.outflowIds.reduce((s, id) => s + (byId.get(id)?.amount ?? 0), 0);

  if (!momo.length) {
    return (
      <Card className="print-break">
        <CardHeader title={t.profile.momoTitle} subtitle={t.profile.kpi.momoNone} />
        <div className="h-5" />
      </Card>
    );
  }

  return (
    <Card className="print-break">
      <CardHeader
        title={t.profile.momoTitle}
        subtitle={t.profile.momoSubtitle}
        action={
          <Button variant="ghost" size="sm" iconRight="chevronRight" onClick={() => evidence.open({ type: "momoList", title: t.profile.momoTitle, ids: momo.filter((x) => !x.duplicateOf).map((x) => x.id) })}>
            {t.common.seeAll}
          </Button>
        }
      />
      <div className="px-5 pb-5 pt-4 sm:px-6">
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${formatPct(backedShare, locale)} ${t.profile.momoBacked}`}>
          {m.corroboratedAmount ? <div className="h-full rounded-l-full bg-chart-1" style={{ width: `${backedShare * 100}%` }} /> : null}
          {unmatchedAmount ? <div className="h-full flex-1 rounded-r-full bg-chart-2" /> : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => evidence.open({ type: "momoList", title: t.profile.momoBacked, ids: m.corroboratedIds })}
            className="flex items-start gap-2.5 rounded-xl p-2 text-left hover:bg-surface-2"
          >
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-chart-1" />
            <span>
              <span className="block text-[13px] text-ink-3">{t.profile.momoBacked}</span>
              <span className="block text-[16px] font-semibold tabular">
                {formatMoney(m.corroboratedAmount, locale)} <span className="text-[13px] font-normal text-ink-3">· {formatPct(backedShare, locale)}</span>
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => evidence.open({ type: "momoList", title: t.profile.momoNotBacked, subtitle: t.profile.momoNotBackedHint, ids: m.unmatchedIds })}
            className="flex items-start gap-2.5 rounded-xl p-2 text-left hover:bg-surface-2"
          >
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-chart-2" />
            <span>
              <span className="block text-[13px] text-ink-3">{t.profile.momoNotBacked}</span>
              <span className="block text-[16px] font-semibold tabular">
                {formatMoney(unmatchedAmount, locale)} <span className="text-[13px] font-normal text-ink-3">· {m.unmatchedIds.length}</span>
              </span>
            </span>
          </button>
        </div>
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px] text-ink-2">
          {m.exact.length ? <Fact icon="check" text={t.profile.momoExact(m.exact.length)} /> : null}
          {m.depositIds.length ? (
            <Fact icon="wallet" text={t.profile.momoDeposits(m.depositIds.length)} onClick={() => evidence.open({ type: "momoList", title: t.evidence.kinds.deposit, ids: m.depositIds })} />
          ) : null}
          {m.outflowIds.length ? (
            <Fact
              icon="arrowLeft"
              text={t.profile.momoOut(m.outflowIds.length, formatMoney(outTotal, locale))}
              onClick={() => evidence.open({ type: "momoList", title: t.evidence.direction.out, ids: m.outflowIds })}
            />
          ) : null}
          {m.daysWithoutRecords.length ? (
            <Fact icon="calendar" text={`${t.profile.momoClosedDay}: ${m.daysWithoutRecords.map((d) => formatDate(d, locale)).join(", ")}`} />
          ) : null}
        </ul>
      </div>
    </Card>
  );
}

function Fact({ icon, text, onClick, tone }: { icon: IconName; text: string; onClick?: () => void; tone?: "good" | "warn" }) {
  const inner = (
    <>
      <Icon name={icon} size={16} className={cn("mt-0.5", tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : "text-ink-3")} />
      <span className="flex-1">{text}</span>
      {onClick ? <Icon name="chevronRight" size={15} className="mt-0.5 text-ink-3" /> : null}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2 rounded-lg px-2 py-1 text-left hover:bg-surface-2">
          {inner}
        </button>
      ) : (
        <div className="flex items-start gap-2 py-1">{inner}</div>
      )}
    </li>
  );
}

/* ---------------- Integrity ---------------- */

export function IntegrityCard({ profile, sources }: { profile: Profile; sources: Source[] }) {
  const { t } = useI18n();
  const evidence = useEvidence();
  const i = profile.integrity;
  const c = profile.checks;
  const failing = c.failing[0];
  const sourceTotalBox = failing ? sources.find((s) => s.id === failing.sourceId)?.reading?.writtenTotals.find((w) => w.type === failing.check.type)?.box : undefined;

  return (
    <Card className="print-break">
      <CardHeader title={t.profile.integrity} subtitle={t.profile.integritySub} />
      <ul className="space-y-1 px-5 pb-5 pt-3 text-[13.5px] text-ink-2 sm:px-6">
        <Fact icon="shield" tone="good" text={t.profile.allRead} />
        {c.total ? (
          <Fact
            icon={c.failing.length ? "alert" : "checkCircle"}
            tone={c.failing.length ? "warn" : "good"}
            text={t.profile.checksOk(c.passed, c.total)}
            onClick={failing ? () => evidence.open({ type: "source", id: failing.sourceId, totalBox: sourceTotalBox }) : undefined}
          />
        ) : (
          <Fact icon="info" text={t.profile.checksNone} />
        )}
        {i.correctedIds.length ? (
          <Fact icon="pencil" text={t.profile.corrections(i.correctedIds.length)} onClick={() => evidence.open({ type: "entries", title: t.review.corrected, ids: i.correctedIds })} />
        ) : null}
        {i.traderAddedIds.length ? (
          <Fact icon="plus" text={t.profile.added(i.traderAddedIds.length)} onClick={() => evidence.open({ type: "entries", title: t.review.addedByYou, ids: i.traderAddedIds })} />
        ) : null}
        <Fact icon="layers" tone={i.blockedDuplicates ? "good" : undefined} text={i.blockedDuplicates ? t.profile.dupBlocked(i.blockedDuplicates) : t.profile.dupNone} />
        {i.excludedDuplicateIds.length ? (
          <Fact icon="layers" tone="warn" text={t.profile.dupLines(i.excludedDuplicateIds.length)} onClick={() => evidence.open({ type: "entries", title: t.profile.dupLines(i.excludedDuplicateIds.length), ids: i.excludedDuplicateIds })} />
        ) : null}
        {i.momoDuplicateIds.length ? <Fact icon="message" text={t.profile.dupMomo(i.momoDuplicateIds.length)} /> : null}
        {i.crossTraderAttempts ? <Fact icon="alert" tone="warn" text={t.profile.crossTrader(i.crossTraderAttempts)} /> : null}
      </ul>
    </Card>
  );
}

/* ---------------- Audit trail ---------------- */

export function ActivityCard({ events, limit = 8 }: { events: TrustEvent[]; limit?: number }) {
  const { t, locale } = useI18n();
  const [all, setAll] = useState(false);
  const ordered = [...events].reverse();
  const shown = all ? ordered : ordered.slice(0, limit);

  const detail = (e: TrustEvent): string | null => {
    if (e.type === "page_read" && typeof e.detail?.lines === "number") return t.eventDetail.lines(e.detail.lines);
    if (e.type === "page_confirmed" && typeof e.detail?.lines === "number") return t.eventDetail.lines(e.detail.lines);
    if (e.type === "messages_added" && typeof e.detail?.found === "number") return t.eventDetail.found(e.detail.found);
    if (e.type === "entry_corrected" && typeof e.detail?.from === "number" && typeof e.detail?.to === "number" && e.detail.from !== e.detail.to) {
      return t.eventDetail.corrected(formatCompact(e.detail.from, locale), formatCompact(e.detail.to, locale));
    }
    return null;
  };

  const icon = (type: string): IconName =>
    type.startsWith("photo_duplicate") ? "layers" : type.startsWith("photo") ? "camera" : type.startsWith("page_read") ? "sparkle" : type.startsWith("consent") ? "lock" : type.startsWith("messages") ? "message" : type.startsWith("entry") ? "pencil" : "checkCircle";

  return (
    <Card className="print-break">
      <CardHeader title={t.profile.activity} subtitle={t.profile.activitySub} />
      <ol className="relative px-5 pb-4 pt-4 sm:px-6">
        {shown.map((e, idx) => (
          <li key={e.id} className="relative flex gap-3 pb-3.5 last:pb-0">
            {idx < shown.length - 1 ? <span className="absolute left-[13px] top-7 h-[calc(100%-18px)] w-px bg-line" aria-hidden /> : null}
            <span
              className={cn(
                "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-surface",
                e.type === "photo_duplicate_blocked" || e.type === "page_read_failed" ? "bg-warn-soft text-warn" : "bg-sunken text-ink-2",
              )}
            >
              <Icon name={icon(e.type)} size={14} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13.5px] font-medium">
                {t.events[e.type] ?? e.type}
                {detail(e) ? <span className="font-normal text-ink-3"> · {detail(e)}</span> : null}
              </p>
              <p className="text-[12px] text-ink-3">{formatDateTime(e.at, locale)}</p>
            </div>
          </li>
        ))}
      </ol>
      {ordered.length > limit ? (
        <div className="no-print px-5 pb-5 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? t.common.showLess : `${t.common.seeAll} (${ordered.length})`}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
