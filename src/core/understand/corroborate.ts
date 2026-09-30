import type { Entry, IsoDate, MomoTx } from "../types.ts";
import { addDays } from "../dates.ts";

/**
 * Understand: do the mobile money records back up the notebook?
 *
 * Customer payments received by mobile money are part of a day's sales, so a
 * day's notebook sales should be at least as large as the payments received
 * that day. Matching runs in three passes:
 *   1. exact: a payment equals a single notebook sale on the same day
 *   2. covered: the day's remaining recorded sales can absorb the payment
 *   3. adjacent: a payment after 20:00 may be written on the next day's page,
 *      and one before 07:00 on the previous day's
 * Deposits (the trader's own cash-in) are never treated as sales.
 */

const LATE_HOUR = 20;
const EARLY_HOUR = 7;

export interface Corroboration {
  inflowIds: string[];
  corroboratedIds: string[];
  unmatchedIds: string[];
  outsidePeriodIds: string[];
  depositIds: string[];
  outflowIds: string[];
  exact: { momoId: string; entryId: string }[];
  inflowAmount: number;
  corroboratedAmount: number;
  rateCount: number;
  rateAmount: number;
  shareOfSales: number;
  daysWithoutRecords: IsoDate[];
}

const CUSTOMER_INFLOW = new Set(["received", "payment_in", "unknown"]);

export function corroborate(
  counted: Entry[],
  momo: MomoTx[],
  period: { start: IsoDate; end: IsoDate } | null,
): Corroboration {
  const sales = counted.filter((e) => e.type === "sale");
  const capacity = new Map<IsoDate, number>();
  for (const e of sales) capacity.set(e.date, (capacity.get(e.date) ?? 0) + e.amount);
  const used = new Map<IsoDate, number>();
  const room = (d: IsoDate) => (capacity.get(d) ?? 0) - (used.get(d) ?? 0);
  const take = (d: IsoDate, amount: number) => used.set(d, (used.get(d) ?? 0) + amount);

  const depositIds = momo.filter((m) => m.direction === "in" && m.kind === "deposit").map((m) => m.id);
  const outflowIds = momo.filter((m) => m.direction === "out").map((m) => m.id);
  const inflowsAll = momo
    .filter((m) => m.direction === "in" && CUSTOMER_INFLOW.has(m.kind))
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

  const windowStart = period ? addDays(period.start, -1) : "";
  const windowEnd = period ? addDays(period.end, 1) : "";
  const inPeriod = (d: IsoDate) => Boolean(period) && d >= windowStart && d <= windowEnd;

  const inflows = inflowsAll.filter((m) => inPeriod(m.date));
  const outsidePeriodIds = inflowsAll.filter((m) => !inPeriod(m.date)).map((m) => m.id);

  const matched = new Set<string>();
  const exact: Corroboration["exact"] = [];
  const usedEntries = new Set<string>();

  // Pass 1: exact single-line matches.
  for (const m of inflows) {
    const hit = sales.find((e) => e.date === m.date && e.amount === m.amount && !usedEntries.has(e.id));
    if (hit && room(m.date) >= m.amount) {
      usedEntries.add(hit.id);
      take(m.date, m.amount);
      matched.add(m.id);
      exact.push({ momoId: m.id, entryId: hit.id });
    }
  }

  // Pass 2: same-day coverage, smallest payments first so the most are covered.
  const remaining = inflows.filter((m) => !matched.has(m.id)).sort((a, b) => a.amount - b.amount);
  for (const m of remaining) {
    if (room(m.date) >= m.amount) {
      take(m.date, m.amount);
      matched.add(m.id);
    }
  }

  // Pass 3: payments near midnight may sit on the neighbouring day's page.
  // Only the clock justifies this; otherwise large unrelated transfers on a
  // closed day would be absorbed by the day before.
  for (const m of remaining) {
    if (matched.has(m.id) || !m.time) continue;
    const hour = Number(m.time.slice(0, 2));
    const neighbour = hour >= LATE_HOUR ? addDays(m.date, 1) : hour < EARLY_HOUR ? addDays(m.date, -1) : null;
    if (neighbour && room(neighbour) >= m.amount) {
      take(neighbour, m.amount);
      matched.add(m.id);
    }
  }

  const corroborated = inflows.filter((m) => matched.has(m.id));
  const unmatched = inflows.filter((m) => !matched.has(m.id));
  const inflowAmount = inflows.reduce((s, m) => s + m.amount, 0);
  const corroboratedAmount = corroborated.reduce((s, m) => s + m.amount, 0);
  const salesTotal = sales.reduce((s, e) => s + e.amount, 0);
  const daysWithoutRecords = [...new Set(unmatched.map((m) => m.date).filter((d) => !capacity.has(d)))].sort();

  return {
    inflowIds: inflows.map((m) => m.id),
    corroboratedIds: corroborated.map((m) => m.id),
    unmatchedIds: unmatched.map((m) => m.id),
    outsidePeriodIds,
    depositIds,
    outflowIds,
    exact,
    inflowAmount,
    corroboratedAmount,
    rateCount: inflows.length ? corroborated.length / inflows.length : 0,
    rateAmount: inflowAmount ? corroboratedAmount / inflowAmount : 0,
    shareOfSales: salesTotal ? corroboratedAmount / salesTotal : 0,
    daysWithoutRecords,
  };
}
