import type { Entry, IsoDate, PageCheck, TraderBundle } from "../types.ts";
import { addDays, daysBetween, maxDate, minDate, monthKey, weekStart, weekday } from "../dates.ts";
import { cleanLabel, normalizeItem } from "../text.ts";
import { coefficientOfVariation, mean, median, slope, sum } from "../stats.ts";
import { buildLedger } from "../organize/ledger.ts";
import { pageChecks } from "../refine/validate.ts";
import { corroborate, type Corroboration } from "./corroborate.ts";
import { evidenceStrength, type Strength } from "./strength.ts";

/**
 * Understand: the business profile.
 *
 * AI reads, code counts. Every figure here is computed from counted lines
 * (see organize/ledger.ts) and carries the ids of the lines behind it.
 */

export interface WeekRow {
  key: IsoDate;
  start: IsoDate;
  end: IsoDate;
  sales: number;
  expenses: number;
  activeDays: number;
  daysInPeriod: number;
  partial: boolean;
  gap: boolean;
  entryIds: string[];
}

export interface MonthRow {
  key: string;
  sales: number;
  expenses: number;
  activeDays: number;
  entryIds: string[];
}

export interface ItemRow {
  key: string;
  label: string;
  sales: number;
  lines: number;
  share: number;
  entryIds: string[];
}

export interface WeekdayRow {
  day: number;
  total: number;
  days: number;
  avgSales: number;
}

export type TrendDirection = "growing" | "stable" | "declining";

export interface Trend {
  direction: TrendDirection;
  /** Change over four weeks, relative to the average week (0.08 = +8%). */
  pctPer4Weeks: number;
  weeksUsed: number;
  recent?: number;
  previous?: number;
  weekKeys: IsoDate[];
}

export type ConsistencyLabel = "very_steady" | "steady" | "variable" | "volatile";

export interface FailingCheck {
  sourceId: string;
  check: PageCheck;
}

export interface Profile {
  today: IsoDate;
  hasData: boolean;
  period: { start: IsoDate; end: IsoDate; days: number; weeks: number } | null;
  counts: {
    pages: number;
    pagesRead: number;
    pagesConfirmed: number;
    pagesAwaitingReview: number;
    entriesCounted: number;
    entriesPending: number;
    entriesRejected: number;
    corrections: number;
    traderAdded: number;
    momo: number;
    momoDuplicates: number;
    excludedDuplicates: number;
  };
  sales: {
    total: number;
    avgWeekly: number;
    medianWeekly: number;
    weeklyBasis: "full" | "partial" | "none";
    fullWeeks: number;
    avgPerActiveDay: number;
    activeDays: number;
    activeDaysPerWeek: number;
    bestWeek: { key: IsoDate; sales: number } | null;
    entryIds: string[];
  };
  expenses: { total: number; entryIds: string[] };
  net: number;
  trend: Trend | null;
  consistency: { cv: number; label: ConsistencyLabel; weekKeys: IsoDate[] } | null;
  weeks: WeekRow[];
  months: MonthRow[];
  items: ItemRow[];
  weekdays: WeekdayRow[];
  momo: Corroboration;
  checks: { passed: number; total: number; failing: FailingCheck[]; passingSourceIds: string[] };
  integrity: {
    blockedDuplicates: number;
    crossTraderAttempts: number;
    nearDuplicatesKept: string[];
    excludedDuplicateIds: string[];
    overlaps: { earlier: string; later: string; matches: number }[];
    correctedIds: string[];
    traderAddedIds: string[];
    momoDuplicateIds: string[];
  };
  strength: Strength;
}

export const TREND_THRESHOLD = 0.05;
export const MIN_WEEKS_FOR_TREND = 4;
export const MIN_WEEKS_FOR_CONSISTENCY = 3;

function consistencyLabel(cv: number): ConsistencyLabel {
  if (cv < 0.15) return "very_steady";
  if (cv < 0.3) return "steady";
  if (cv < 0.5) return "variable";
  return "volatile";
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function buildProfile(bundle: TraderBundle, today: IsoDate): Profile {
  const ledger = buildLedger(bundle);
  const counted = ledger.counted;
  const sales = counted.filter((e) => e.type === "sale");
  const expenses = counted.filter((e) => e.type === "expense");

  const dates = counted.map((e) => e.date);
  const start = minDate(dates);
  const end = maxDate(dates);
  const period =
    start && end
      ? {
          start,
          end,
          days: daysBetween(start, end) + 1,
          weeks: Math.floor(daysBetween(weekStart(start), weekStart(end)) / 7) + 1,
        }
      : null;

  /* ---------- weeks ---------- */
  const weeks: WeekRow[] = [];
  if (period) {
    const byWeek = new Map<IsoDate, Entry[]>();
    for (const e of counted) {
      const k = weekStart(e.date);
      const list = byWeek.get(k);
      if (list) list.push(e);
      else byWeek.set(k, [e]);
    }
    for (let ws = weekStart(period.start); ws <= period.end; ws = addDays(ws, 7)) {
      const we = addDays(ws, 6);
      const inStart = ws < period.start ? period.start : ws;
      const inEnd = we > period.end ? period.end : we;
      const daysInPeriod = daysBetween(inStart, inEnd) + 1;
      const list = byWeek.get(ws) ?? [];
      const saleDays = new Set(list.filter((e) => e.type === "sale").map((e) => e.date));
      weeks.push({
        key: ws,
        start: ws,
        end: we,
        sales: sum(list.filter((e) => e.type === "sale").map((e) => e.amount)),
        expenses: sum(list.filter((e) => e.type === "expense").map((e) => e.amount)),
        activeDays: saleDays.size,
        daysInPeriod,
        partial: daysInPeriod < 6,
        gap: saleDays.size === 0,
        entryIds: list.map((e) => e.id),
      });
    }
  }

  const fullRecorded = weeks.filter((w) => !w.partial && !w.gap);
  const recorded = weeks.filter((w) => !w.gap);
  const basisWeeks = fullRecorded.length ? fullRecorded : recorded;
  const weeklyBasis: Profile["sales"]["weeklyBasis"] = fullRecorded.length
    ? "full"
    : recorded.length
      ? "partial"
      : "none";

  /* ---------- months ---------- */
  const monthMap = new Map<string, MonthRow>();
  const monthDays = new Map<string, Set<IsoDate>>();
  for (const e of counted) {
    const k = monthKey(e.date);
    let row = monthMap.get(k);
    if (!row) {
      row = { key: k, sales: 0, expenses: 0, activeDays: 0, entryIds: [] };
      monthMap.set(k, row);
      monthDays.set(k, new Set());
    }
    if (e.type === "sale") {
      row.sales += e.amount;
      monthDays.get(k)?.add(e.date);
    } else row.expenses += e.amount;
    row.entryIds.push(e.id);
  }
  const months = [...monthMap.values()]
    .map((m) => ({ ...m, activeDays: monthDays.get(m.key)?.size ?? 0 }))
    .sort((a, b) => a.key.localeCompare(b.key));

  /* ---------- items ---------- */
  const salesTotal = sum(sales.map((e) => e.amount));
  const itemMap = new Map<string, { sales: number; ids: string[]; labels: Map<string, number> }>();
  for (const e of sales) {
    const key = normalizeItem(e.description);
    let item = itemMap.get(key);
    if (!item) {
      item = { sales: 0, ids: [], labels: new Map() };
      itemMap.set(key, item);
    }
    item.sales += e.amount;
    item.ids.push(e.id);
    const label = cleanLabel(e.description);
    item.labels.set(label, (item.labels.get(label) ?? 0) + 1);
  }
  const items: ItemRow[] = [...itemMap.entries()]
    .map(([key, v]) => ({
      key,
      label: [...v.labels.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0],
      sales: v.sales,
      lines: v.ids.length,
      share: salesTotal ? round3(v.sales / salesTotal) : 0,
      entryIds: v.ids,
    }))
    .sort((a, b) => b.sales - a.sales);

  /* ---------- weekdays ---------- */
  const dayTotals = new Map<IsoDate, number>();
  for (const e of sales) dayTotals.set(e.date, (dayTotals.get(e.date) ?? 0) + e.amount);
  const weekdays: WeekdayRow[] = [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const totals = [...dayTotals.entries()].filter(([d]) => weekday(d) === day).map(([, v]) => v);
    return { day, total: sum(totals), days: totals.length, avgSales: totals.length ? Math.round(mean(totals)) : 0 };
  });

  /* ---------- trend & consistency ---------- */
  let trend: Trend | null = null;
  if (fullRecorded.length >= MIN_WEEKS_FOR_TREND) {
    const values = fullRecorded.map((w) => w.sales);
    const avg = mean(values);
    const pct = avg ? (slope(values) * 4) / avg : 0;
    const direction: TrendDirection = pct > TREND_THRESHOLD ? "growing" : pct < -TREND_THRESHOLD ? "declining" : "stable";
    trend = {
      direction,
      pctPer4Weeks: round3(pct),
      weeksUsed: values.length,
      weekKeys: fullRecorded.map((w) => w.key),
    };
    if (values.length >= 8) {
      trend.recent = Math.round(mean(values.slice(-4)));
      trend.previous = Math.round(mean(values.slice(-8, -4)));
    }
  }
  const consistency =
    fullRecorded.length >= MIN_WEEKS_FOR_CONSISTENCY
      ? (() => {
          const cv = round3(coefficientOfVariation(fullRecorded.map((w) => w.sales)));
          return { cv, label: consistencyLabel(cv), weekKeys: fullRecorded.map((w) => w.key) };
        })()
      : null;

  /* ---------- written totals ---------- */
  const confirmedPages = bundle.sources.filter((s) => s.confirmedAt && s.reading?.writtenTotals.length);
  const failing: FailingCheck[] = [];
  const passingSourceIds: string[] = [];
  let passed = 0;
  let totalChecks = 0;
  for (const s of confirmedPages) {
    const pageEntries = bundle.entries.filter((e) => e.sourceId === s.id);
    for (const check of pageChecks(pageEntries, s.reading?.writtenTotals ?? [], s.reading?.pageDate)) {
      totalChecks++;
      if (check.ok) {
        passed++;
        if (!passingSourceIds.includes(s.id)) passingSourceIds.push(s.id);
      } else failing.push({ sourceId: s.id, check });
    }
  }

  /* ---------- mobile money ---------- */
  const momo = corroborate(counted, ledger.momo, period);

  /* ---------- integrity ---------- */
  const blockedDuplicates = bundle.events.filter((e) => e.type === "photo_duplicate_blocked").length;
  const crossTraderAttempts = bundle.events.filter(
    (e) => (e.type === "photo_duplicate_blocked" || e.type === "photo_duplicate_flagged") && e.detail?.crossTrader === true,
  ).length;
  const correctedIds = counted.filter((e) => e.original).map((e) => e.id);
  const traderAddedIds = counted.filter((e) => e.origin === "trader").map((e) => e.id);

  const pagesRead = bundle.sources.filter((s) => s.status === "read" && (s.kind === "notebook" || s.kind === "receipt"));
  const pagesConfirmed = pagesRead.filter((s) => s.confirmedAt);

  const activeDays = dayTotals.size;
  const strength = evidenceStrength({
    weeksSpan: weeks.length,
    recordedWeeks: recorded.length,
    fullRecordedWeeks: fullRecorded.length,
    confirmed: counted.length,
    pending: ledger.pending.length,
    momoInflows: momo.inflowIds.length,
    corroborationRate: momo.rateAmount,
    checksPassed: passed,
    checksTotal: totalChecks,
    entriesCounted: counted.length,
    duplicateLines: ledger.excludedAsDuplicate.length,
    blockedDuplicates,
    crossTraderAttempts,
  });

  const best = basisWeeks.reduce<WeekRow | null>((b, w) => (!b || w.sales > b.sales ? w : b), null);

  return {
    today,
    hasData: counted.length > 0,
    period,
    counts: {
      pages: bundle.sources.filter((s) => s.kind === "notebook" || s.kind === "receipt").length,
      pagesRead: pagesRead.length,
      pagesConfirmed: pagesConfirmed.length,
      pagesAwaitingReview: pagesRead.length - pagesConfirmed.length,
      entriesCounted: counted.length,
      entriesPending: ledger.pending.length,
      entriesRejected: ledger.rejected.length,
      corrections: correctedIds.length,
      traderAdded: traderAddedIds.length,
      momo: ledger.momo.length,
      momoDuplicates: ledger.momoDuplicates.length,
      excludedDuplicates: ledger.excludedAsDuplicate.length,
    },
    sales: {
      total: salesTotal,
      avgWeekly: Math.round(mean(basisWeeks.map((w) => w.sales))),
      medianWeekly: Math.round(median(basisWeeks.map((w) => w.sales))),
      weeklyBasis,
      fullWeeks: fullRecorded.length,
      avgPerActiveDay: activeDays ? Math.round(salesTotal / activeDays) : 0,
      activeDays,
      activeDaysPerWeek: period ? Math.round((activeDays / (period.days / 7)) * 10) / 10 : 0,
      bestWeek: best ? { key: best.key, sales: best.sales } : null,
      entryIds: sales.map((e) => e.id),
    },
    expenses: { total: sum(expenses.map((e) => e.amount)), entryIds: expenses.map((e) => e.id) },
    net: salesTotal - sum(expenses.map((e) => e.amount)),
    trend,
    consistency,
    weeks,
    months,
    items,
    weekdays,
    momo,
    checks: { passed, total: totalChecks, failing, passingSourceIds },
    integrity: {
      blockedDuplicates,
      crossTraderAttempts,
      nearDuplicatesKept: bundle.sources.filter((s) => s.duplicateKept).map((s) => s.id),
      excludedDuplicateIds: ledger.excludedAsDuplicate.map((e) => e.id),
      overlaps: ledger.overlaps.map((o) => ({ earlier: o.earlier, later: o.later, matches: o.matches })),
      correctedIds,
      traderAddedIds,
      momoDuplicateIds: ledger.momoDuplicates.map((m) => m.id),
    },
    strength,
  };
}
